/**
 * FeishuChannelAdapter — 飞书消息渠道适配器（Webhook 模式）
 *
 * 接收消息：飞书开放平台通过 HTTP POST 推送事件到 /api/webhook/channel/feishu/:channelId
 * 发送消息：调用飞书消息 API 发送文本消息
 *
 * 配置字段（存储在 claw_channel.config JSON）：
 *   appId        — 飞书应用 App ID
 *   appSecret    — 飞书应用 App Secret
 *   verifyToken  — 事件订阅验证 Token（用于 URL 验证）
 *   encryptKey   — 事件加密 Key（可选，留空则不加密）
 *   chatId       — 默认推送的群聊 chat_id（open_chat_id）
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
import { safeJsonParse } from '../../../../backend/src/utils/json.js'

const logger = createLogger('feishu')

/** 飞书消息 API 基础地址 */
const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis'

export class FeishuChannelAdapter extends ChannelAdapterBase {
  readonly channelType = 'feishu'

  get primaryChatId(): number | undefined {
    return this.allowedChatId
  }

  private channelConfig: Record<string, string>
  private accessToken = ''
  private tokenExpiresAt = 0
  private _tokenRefreshTimer: ReturnType<typeof setInterval> | null = null

  constructor(row: ChannelRow, defaultAgentId: number) {
    const cfg = row.config
      ? safeJsonParse(
          row.config,
          {} as Record<string, string>,
          'channel.config'
        )
      : {}
    if (!cfg['appId'] || !cfg['appSecret']) {
      throw new Error(
        `Channel "${row.title}" (id=${row.id}) missing appId or appSecret`
      )
    }
    super(row.id, row.title, row.is_global === 1, row.user_id, defaultAgentId)
    if (cfg['chatId']) this.allowedChatId = this._chatIdToNumber(cfg['chatId'])
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
      `[channel:${this.channelId}] "${this.channelTitle}" 飞书适配器已启动`
    )
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this._stopTokenRefresh()
    this._teardownEventBus()
    this.running = false
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" 飞书适配器已停止`
    )
  }

  // ── Webhook 入口（由 webhookRouter 调用）─────────────────────────────────

  async handleWebhook(
    body: Record<string, unknown>
  ): Promise<{ challenge?: string }> {
    // URL 验证握手
    if (body['type'] === 'url_verification') {
      const challenge = body['challenge'] as string
      logger.info(`[channel:${this.channelId}] 飞书 URL 验证握手`)
      return { challenge }
    }

    // 解密（如果配置了 encryptKey）
    let payload = body
    if (body['encrypt'] && this.channelConfig['encryptKey']) {
      try {
        payload = this._decrypt(body['encrypt'] as string)
      } catch (err) {
        logger.warn({ err }, `[channel:${this.channelId}] 飞书消息解密失败`)
        return {}
      }
    }

    // 处理事件
    const header = payload['header'] as Record<string, unknown> | undefined
    const eventType = header?.['event_type'] as string | undefined
    const event = payload['event'] as Record<string, unknown> | undefined

    if (eventType === 'im.message.receive_v1' && event) {
      await this._handleMessage(event)
    }

    return {}
  }

  // ── 消息处理 ──────────────────────────────────────────────────────────────

  private async _handleMessage(event: Record<string, unknown>): Promise<void> {
    const sender = event['sender'] as Record<string, unknown> | undefined
    const message = event['message'] as Record<string, unknown> | undefined
    if (!sender || !message) return

    const senderId =
      (sender['sender_id'] as Record<string, string> | undefined)?.[
        'open_id'
      ] ?? ''
    const chatId = (message['chat_id'] as string) ?? ''
    const msgType = message['message_type'] as string
    const msgContent = message['content'] as string

    if (!chatId || !msgContent) return

    // 只处理文本消息
    if (msgType !== 'text') {
      logger.debug(`[channel:${this.channelId}] 忽略非文本消息类型: ${msgType}`)
      return
    }

    let text = ''
    const parsed = safeJsonParse(msgContent, null, 'feishu.msgContent') as {
      text?: string
    } | null
    text = parsed?.text ?? msgContent

    if (!text.trim()) return

    this.lastActivity = new Date()
    const numericChatId = this._chatIdToNumber(chatId)

    // 首次消息自动绑定 chatId
    if (!this.allowedChatId) {
      this.allowedChatId = numericChatId
      this.channelConfig['chatId'] = chatId
      try {
        clawDb.updateChannel(this.channelId, {
          config: this.channelConfig as Record<string, string>,
          status: 'success',
        })
        logger.info(`[channel:${this.channelId}] 自动绑定 chatId=${chatId}`)
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

    if (sessionResult.isCommand) return

    logger.info(
      `[channel:${this.channelId}] 飞书消息 chat=${chatId} sender=${senderId} → agent=${effectiveAgentId}: ${text.slice(0, 60)}`
    )

    clawEventBus.emit('message:incoming', {
      agentId: effectiveAgentId,
      chatId: numericChatId,
      content: clawMessage.text(text),
      userId: this.userId,
      username: senderId,
      messageId: Date.now(),
      timestamp: new Date(),
      channelId: this.channelId,
      sessionId: sessionResult.sessionId,
    })
  }

  // ── ChannelAdapterBase: send primitives ───────────────────────────────────

  protected async _sendText(chatId: number, text: string): Promise<void> {
    const chatIdStr = this._numberToChatId(chatId)
    await this._sendFeishuMessage(chatIdStr, text)
  }

  protected async _sendTyping(_chatId: number): Promise<void> {
    // 飞书不支持 typing 指示器
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

  // ── 飞书 API 调用 ─────────────────────────────────────────────────────────

  private async _sendFeishuMessage(
    chatId: string,
    text: string
  ): Promise<void> {
    if (!this.accessToken) {
      logger.warn(
        `[channel:${this.channelId}] 飞书 access_token 未就绪，跳过发送`
      )
      return
    }
    const url = `${FEISHU_API_BASE}/im/v1/messages?receive_id_type=chat_id`
    const body = {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify(body),
    })
    const data = (await resp.json()) as { code: number; msg: string }
    if (data.code !== 0) {
      this.errorCount++
      logger.error(
        `[channel:${this.channelId}] 飞书发送消息失败: code=${data.code} msg=${data.msg}`
      )
    }
  }

  private async _refreshAccessToken(): Promise<void> {
    const url = `${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({
        app_id: this.channelConfig['appId'],
        app_secret: this.channelConfig['appSecret'],
      }),
    })
    const data = (await resp.json()) as {
      code: number
      tenant_access_token?: string
      expire?: number
    }
    if (data.code === 0 && data.tenant_access_token) {
      this.accessToken = data.tenant_access_token
      this.tokenExpiresAt = Date.now() + (data.expire ?? 7200) * 1000 - 60_000
      logger.info(`[channel:${this.channelId}] 飞书 access_token 已刷新`)
    } else {
      logger.error(
        `[channel:${this.channelId}] 飞书获取 access_token 失败: code=${data.code}`
      )
    }
  }

  private _startTokenRefresh(): void {
    this._stopTokenRefresh()
    // 每 100 分钟刷新一次（token 有效期 2 小时）
    this._tokenRefreshTimer = setInterval(
      async () => {
        if (Date.now() >= this.tokenExpiresAt) {
          await this._refreshAccessToken().catch((err) => {
            logger.error(
              { err },
              `[channel:${this.channelId}] 飞书 token 刷新失败`
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

  /** 解密飞书加密消息 */
  private _decrypt(encrypted: string): Record<string, unknown> {
    const key = this.channelConfig['encryptKey'] ?? ''
    const keyHash = crypto.createHash('sha256').update(key).digest()
    const buf = Buffer.from(encrypted, 'base64')
    const iv = buf.slice(0, 16)
    const content = buf.slice(16)
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, iv)
    const decrypted = Buffer.concat([
      decipher.update(content),
      decipher.final(),
    ])
    return safeJsonParse(
      decrypted.toString('utf8'),
      {} as Record<string, unknown>,
      'feishu.cardPayload'
    )
  }

  /** 将飞书 chat_id 字符串映射为数字（取哈希低 31 位保证正数） */
  private _chatIdToNumber(chatId: string): number {
    if (/^\d+$/.test(chatId)) return parseInt(chatId, 10)
    let hash = 0
    for (let i = 0; i < chatId.length; i++) {
      hash = (Math.imul(31, hash) + chatId.charCodeAt(i)) | 0
    }
    return Math.abs(hash) || 1
  }

  /** 将数字 chatId 还原为飞书 chat_id 字符串 */
  private _numberToChatId(num: number): string {
    // 优先从 config 中取原始 chatId
    const raw = this.channelConfig['chatId'] ?? ''
    if (raw && this._chatIdToNumber(raw) === num) return raw
    return String(num)
  }
}
