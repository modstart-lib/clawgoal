/**
 * DingtalkChannelAdapter — 钉钉消息渠道适配器（Webhook 模式）
 *
 * 接收消息：钉钉通过 HTTP POST 推送事件到 /api/webhook/channel/dingtalk/:channelId
 * 发送消息：调用钉钉机器人 Webhook 或企业内部应用消息 API
 *
 * 配置字段（存储在 claw_channel.config JSON）：
 *   appKey       — 企业内部应用 AppKey
 *   appSecret    — 企业内部应用 AppSecret
 *   agentId      — 应用 AgentId（发送工作通知必填）
 *   robotCode    — 机器人 robotCode（企业内部机器人）
 *   chatId       — 默认推送的群聊 openConversationId
 *   userId       — 默认推送的用户 userId（staffId）
 */

import crypto from 'crypto'
import { getUserAgent } from '../../../../backend/src/utils/utils.js'
import { getByUserId } from '../../../../backend/src/utils/tenant.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import { createLogger } from '../../kernel/logger.js'
import { clawDb } from '../../storage/store/index.js'
import type { ChannelRow } from '../../storage/store/index.js'
import type { Agent } from '../../types/index.js'
import { clawMessage } from '../../types/index.js'
import { resolveIncomingSession } from '../../storage/sessionManager.js'
import { ChannelAdapterBase } from '../adapterBase.js'
import { config } from '../../../../backend/src/config/index.js'

const logger = createLogger('dingtalk')

const DINGTALK_API_BASE = 'https://api.dingtalk.com/v1.0'
const DINGTALK_OAPI_BASE = 'https://oapi.dingtalk.com'

export class DingtalkChannelAdapter extends ChannelAdapterBase {
  readonly channelType = 'dingtalk'

  get primaryChatId(): number | undefined {
    return this.allowedChatId
  }

  private channelConfig: Record<string, string>
  private accessToken = ''
  private tokenExpiresAt = 0
  private _tokenRefreshTimer: ReturnType<typeof setInterval> | null = null

  constructor(row: ChannelRow, defaultAgentId: number) {
    const cfg = row.config
      ? (JSON.parse(row.config) as Record<string, string>)
      : {}
    if (!cfg['appKey'] || !cfg['appSecret']) {
      throw new Error(
        `Channel "${row.title}" (id=${row.id}) missing appKey or appSecret`
      )
    }
    super(row.id, row.title, row.is_global === 1, row.user_id, defaultAgentId)
    const chatId = cfg['chatId'] ?? cfg['userId'] ?? ''
    if (chatId) this.allowedChatId = this._chatIdToNumber(chatId)
    this.channelConfig = { ...cfg }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return
    await this._refreshAccessToken()
    this._startTokenRefresh()
    this._setupEventBus()
    this.running = true
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" 钉钉适配器已启动`
    )
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this._stopTokenRefresh()
    this._teardownEventBus()
    this.running = false
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" 钉钉适配器已停止`
    )
  }

  // ── Webhook 入口（由 webhookRouter 调用）─────────────────────────────────

  async handleWebhook(
    body: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<{ success: boolean }> {
    // 验证签名（钉钉企业内部机器人）
    const timestamp = headers['timestamp'] ?? ''
    const sign = headers['sign'] ?? ''
    if (timestamp && sign && this.channelConfig['appSecret']) {
      if (!this._verifySign(timestamp, sign)) {
        logger.warn(`[channel:${this.channelId}] 钉钉签名验证失败`)
        return { success: false }
      }
    }

    const msgType = body['msgtype'] as string | undefined
    if (msgType !== 'text') {
      logger.debug(`[channel:${this.channelId}] 忽略非文本消息类型: ${msgType}`)
      return { success: true }
    }

    const textContent =
      (body['text'] as Record<string, string> | undefined)?.['content'] ?? ''
    const senderStaffId = (body['senderStaffId'] as string) ?? ''
    const conversationId = (body['conversationId'] as string) ?? ''
    const text = textContent.trim()

    if (!text) return { success: true }

    this.lastActivity = new Date()
    const numericChatId = this._chatIdToNumber(conversationId || senderStaffId)

    // 首次消息自动绑定 chatId
    if (!this.allowedChatId) {
      this.allowedChatId = numericChatId
      this.channelConfig['chatId'] = conversationId || senderStaffId
      try {
        clawDb.updateChannel(this.channelId, {
          config: this.channelConfig as Record<string, string>,
          status: 'success',
        })
        logger.info(
          `[channel:${this.channelId}] 自动绑定 chatId=${conversationId || senderStaffId}`
        )
      } catch (err) {
        logger.error({ err }, `[channel:${this.channelId}] 持久化 chatId 失败`)
      }
    }

    const tenantId = getByUserId(this.userId).id
    const effectiveAgentId = this._getEffectiveAgentId()
    const sessionResult = resolveIncomingSession({
      tenantId,
      userId: this.userId,
      agentId: effectiveAgentId,
      channelId: this.channelId,
      text,
    })

    if (sessionResult.isCommand) return { success: true }

    logger.info(
      `[channel:${this.channelId}] 钉钉消息 conversation=${conversationId} sender=${senderStaffId} → agent=${effectiveAgentId}: ${text.slice(0, 60)}`
    )

    clawEventBus.emit('message:incoming', {
      agentId: effectiveAgentId,
      chatId: numericChatId,
      content: clawMessage.text(text),
      userId: this.userId,
      username: senderStaffId,
      messageId: Date.now(),
      timestamp: new Date(),
      channelId: this.channelId,
      sessionId: sessionResult.sessionId,
    })

    return { success: true }
  }

  // ── ChannelAdapterBase: send primitives ───────────────────────────────────

  protected async _sendText(chatId: number, text: string): Promise<void> {
    await this._sendDingtalkMessage(chatId, text)
  }

  protected async _sendTyping(_chatId: number): Promise<void> {
    // 钉钉不支持 typing 指示器
  }

  // ── ChannelAdapterBase: message building ──────────────────────────────────

  protected _buildOutgoingText(
    rawText: string,
    agentObj: Agent | undefined,
    showHeader: boolean
  ): string {
    if (rawText && agentObj?.title && showHeader) {
      return `【${agentObj.title}】\n\n${rawText}`
    }
    return rawText
  }

  protected _buildToolStartText(
    toolName: string,
    params: Record<string, unknown>
  ): string {
    const paramStr = Object.entries(params)
      .slice(0, 3)
      .map(([k, v]) => `  ${k}: ${String(v).slice(0, 100)}`)
      .join('\n')
    return `⚙️ ${toolName} 执行中...\n${paramStr}`
  }

  protected _buildToolMergedText(
    startText: string,
    _toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string {
    const icon = success ? '✅' : '❌'
    const isZh = config.lang !== 'en-US'
    const label = success ? (isZh ? '完成' : 'done') : isZh ? '失败' : 'failed'
    const lines = [
      startText,
      `${icon} ${label} (${(durationMs / 1000).toFixed(1)}s)`,
    ]
    if (result)
      lines.push(result.length > 500 ? result.slice(0, 500) + '…' : result)
    return lines.join('\n')
  }

  protected _buildToolEndText(
    toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string {
    const icon = success ? '✅' : '❌'
    const isZh = config.lang !== 'en-US'
    const label = success ? (isZh ? '完成' : 'done') : isZh ? '失败' : 'failed'
    const lines = [
      `${icon} ${toolName} ${label} (${(durationMs / 1000).toFixed(1)}s)`,
    ]
    if (result)
      lines.push(result.length > 500 ? result.slice(0, 500) + '…' : result)
    return lines.join('\n')
  }

  // ── ChannelAdapterBase: notifications ────────────────────────────────────

  protected async _notifyMaxRoundsReached(
    chatId: number,
    _agentId: number
  ): Promise<void> {
    await this._sendText(
      chatId,
      config.lang !== 'en-US'
        ? '⚠️ 已达到最大工具调用轮次，任务尚未完成，请回复"继续"以继续运行。'
        : '⚠️ Max tool call rounds reached, task not yet complete. Reply "continue" to keep running.'
    )
  }

  protected async _notifyPinChanged(
    chatId: number,
    agent: Agent | undefined,
    resolvedTools: string[]
  ): Promise<void> {
    const isZh2 = config.lang !== 'en-US'
    const title = agent?.title ?? (isZh2 ? '未知' : 'unknown')
    const toolsStr =
      resolvedTools.length > 0
        ? config.lang !== 'en-US'
          ? `

🛠 可用工具（${resolvedTools.length} 个）：${resolvedTools.slice(0, 5).join('、')}`
          : `

🛠 Tools (${resolvedTools.length}): ${resolvedTools.slice(0, 5).join(', ')}`
        : ''
    await this._sendText(chatId, `📍 已切换到 ${title}${toolsStr}`)
  }

  protected async _notifyPinExpired(
    chatId: number,
    agentTitle: string,
    supervisorTitle: string
  ): Promise<void> {
    await this._sendText(
      chatId,
      `⏰ 与 ${agentTitle} 的专属对话已结束，已恢复由 ${supervisorTitle} 接管。`
    )
  }

  // ── 钉钉 API 调用 ─────────────────────────────────────────────────────────

  private async _sendDingtalkMessage(
    chatId: number,
    text: string
  ): Promise<void> {
    if (!this.accessToken) {
      logger.warn(
        `[channel:${this.channelId}] 钉钉 access_token 未就绪，跳过发送`
      )
      return
    }

    const rawChatId = this._numberToRawId(chatId)
    const agentId = this.channelConfig['agentId'] ?? ''
    const robotCode = this.channelConfig['robotCode'] ?? ''

    // 优先使用机器人发送群消息
    if (robotCode && rawChatId) {
      await this._sendRobotGroupMessage(rawChatId, text, robotCode)
      return
    }

    // 使用工作通知发送给用户
    if (agentId && rawChatId) {
      await this._sendWorkNotice(rawChatId, text, agentId)
      return
    }

    logger.warn(
      `[channel:${this.channelId}] 钉钉未配置 agentId 或 robotCode，无法发送消息`
    )
  }

  /** 机器人发送群消息 */
  private async _sendRobotGroupMessage(
    openConversationId: string,
    text: string,
    robotCode: string
  ): Promise<void> {
    const url = `${DINGTALK_API_BASE}/robot/groupMessages/send`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-acs-dingtalk-access-token': this.accessToken,
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({
        robotCode,
        openConversationId,
        msgKey: 'sampleText',
        msgParam: JSON.stringify({ content: text }),
      }),
    })
    const data = (await resp.json()) as {
      processQueryKey?: string
      errcode?: number
      errmsg?: string
    }
    if (data.errcode && data.errcode !== 0) {
      this.errorCount++
      logger.error(
        `[channel:${this.channelId}] 钉钉机器人发送失败: ${data.errmsg}`
      )
    }
  }

  /** 工作通知发送给用户 */
  private async _sendWorkNotice(
    userId: string,
    text: string,
    agentId: string
  ): Promise<void> {
    const url = `${DINGTALK_OAPI_BASE}/topapi/message/corpconversation/asyncsend_v2?access_token=${this.accessToken}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({
        agent_id: agentId,
        userid_list: userId,
        msg: { msgtype: 'text', text: { content: text } },
      }),
    })
    const data = (await resp.json()) as { errcode: number; errmsg: string }
    if (data.errcode !== 0) {
      this.errorCount++
      logger.error(
        `[channel:${this.channelId}] 钉钉工作通知发送失败: ${data.errmsg}`
      )
    }
  }

  private async _refreshAccessToken(): Promise<void> {
    const url = `${DINGTALK_API_BASE}/oauth2/accessToken`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({
        appKey: this.channelConfig['appKey'],
        appSecret: this.channelConfig['appSecret'],
      }),
    })
    const data = (await resp.json()) as {
      accessToken?: string
      expireIn?: number
      errcode?: number
      errmsg?: string
    }
    if (data.accessToken) {
      this.accessToken = data.accessToken
      this.tokenExpiresAt = Date.now() + (data.expireIn ?? 7200) * 1000 - 60_000
      logger.info(`[channel:${this.channelId}] 钉钉 access_token 已刷新`)
    } else {
      logger.error(
        `[channel:${this.channelId}] 钉钉获取 access_token 失败: ${data.errmsg}`
      )
    }
  }

  private _startTokenRefresh(): void {
    this._stopTokenRefresh()
    this._tokenRefreshTimer = setInterval(
      async () => {
        if (Date.now() >= this.tokenExpiresAt) {
          await this._refreshAccessToken().catch((err) => {
            logger.error(
              { err },
              `[channel:${this.channelId}] 钉钉 token 刷新失败`
            )
          })
        }
      },
      100 * 60 * 1000
    )
  }

  private _stopTokenRefresh(): void {
    if (this._tokenRefreshTimer) {
      clearInterval(this._tokenRefreshTimer)
      this._tokenRefreshTimer = null
    }
  }

  /** 验证钉钉签名 */
  private _verifySign(timestamp: string, sign: string): boolean {
    const secret = this.channelConfig['appSecret'] ?? ''
    const stringToSign = `${timestamp}\n${secret}`
    const expected = crypto
      .createHmac('sha256', secret)
      .update(stringToSign)
      .digest('base64')
    return expected === sign
  }

  private _chatIdToNumber(chatId: string): number {
    if (/^\d+$/.test(chatId)) return parseInt(chatId, 10)
    let hash = 0
    for (let i = 0; i < chatId.length; i++) {
      hash = (Math.imul(31, hash) + chatId.charCodeAt(i)) | 0
    }
    return Math.abs(hash) || 1
  }

  private _numberToRawId(num: number): string {
    const chatId =
      this.channelConfig['chatId'] ?? this.channelConfig['userId'] ?? ''
    if (chatId && this._chatIdToNumber(chatId) === num) return chatId
    return String(num)
  }
}
