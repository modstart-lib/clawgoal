/**
 * WecomChannelAdapter — 企业微信消息渠道适配器（Webhook 模式）
 *
 * 接收消息：企业微信通过 HTTP GET/POST 推送事件到 /api/webhook/channel/wecom/:channelId
 * 发送消息：调用企业微信消息发送 API
 *
 * 配置字段（存储在 claw_channel.config JSON）：
 *   corpId       — 企业 ID
 *   corpSecret   — 应用 Secret
 *   agentId      — 应用 AgentId
 *   token        — 企业微信消息接收 Token（用于 URL 验证）
 *   encodingAesKey — 消息加解密 Key（43位）
 *   toUser       — 默认推送的用户 ID（@all 表示全员）
 *   toParty      — 默认推送的部门 ID
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

const logger = createLogger('wecom')

const WECOM_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin'

export class WecomChannelAdapter extends ChannelAdapterBase {
  readonly channelType = 'wecom'

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
    if (!cfg['corpId'] || !cfg['corpSecret']) {
      throw new Error(
        `Channel "${row.title}" (id=${row.id}) missing corpId or corpSecret`
      )
    }
    super(row.id, row.title, row.is_global === 1, row.user_id, defaultAgentId)
    const toUser = cfg['toUser'] ?? ''
    if (toUser) this.allowedChatId = this._userIdToNumber(toUser)
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
      `[channel:${this.channelId}] "${this.channelTitle}" 企业微信适配器已启动`
    )
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this._stopTokenRefresh()
    this._teardownEventBus()
    this.running = false
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" 企业微信适配器已停止`
    )
  }

  // ── Webhook 入口（由 webhookRouter 调用）─────────────────────────────────

  /**
   * 处理企业微信 GET 请求（URL 验证）
   * 返回 echostr 明文
   */
  handleVerify(query: Record<string, string>): string | null {
    const { msg_signature, timestamp, nonce, echostr } = query
    if (!msg_signature || !timestamp || !nonce || !echostr) return null

    const token = this.channelConfig['token'] ?? ''
    const encodingAesKey = this.channelConfig['encodingAesKey'] ?? ''

    if (!token || !encodingAesKey) {
      // 无加密配置，直接返回 echostr
      return echostr
    }

    // 验证签名
    const expectedSign = this._sha1(
      [token, timestamp, nonce, echostr].sort().join('')
    )
    if (expectedSign !== msg_signature) {
      logger.warn(`[channel:${this.channelId}] 企业微信 URL 验证签名不匹配`)
      return null
    }

    // 解密 echostr
    try {
      const decrypted = this._aesDecrypt(echostr, encodingAesKey)
      return decrypted
    } catch (err) {
      logger.warn(
        { err },
        `[channel:${this.channelId}] 企业微信 echostr 解密失败`
      )
      return null
    }
  }

  /**
   * 处理企业微信 POST 请求（接收消息）
   */
  async handleWebhook(
    body: string,
    query: Record<string, string>
  ): Promise<void> {
    const { msg_signature, timestamp, nonce } = query
    const token = this.channelConfig['token'] ?? ''
    const encodingAesKey = this.channelConfig['encodingAesKey'] ?? ''

    // 解析 XML
    let xmlContent = body
    if (msg_signature && token && encodingAesKey) {
      // 从 XML 中提取 Encrypt 字段
      const encryptMatch = body.match(
        /<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/
      )
      if (encryptMatch) {
        const encrypted = encryptMatch[1]
        const expectedSign = this._sha1(
          [token, timestamp, nonce, encrypted].sort().join('')
        )
        if (expectedSign !== msg_signature) {
          logger.warn(`[channel:${this.channelId}] 企业微信消息签名验证失败`)
          return
        }
        try {
          xmlContent = this._aesDecrypt(encrypted, encodingAesKey)
        } catch (err) {
          logger.warn(
            { err },
            `[channel:${this.channelId}] 企业微信消息解密失败`
          )
          return
        }
      }
    }

    // 解析消息内容
    const msgType = this._extractXml(xmlContent, 'MsgType')
    if (msgType !== 'text') {
      logger.debug(`[channel:${this.channelId}] 忽略非文本消息类型: ${msgType}`)
      return
    }

    const text = this._extractXml(xmlContent, 'Content').trim()
    const fromUser = this._extractXml(xmlContent, 'FromUserName')

    if (!text) return

    this.lastActivity = new Date()
    const numericChatId = this._userIdToNumber(fromUser)

    // 首次消息自动绑定 toUser
    if (!this.allowedChatId) {
      this.allowedChatId = numericChatId
      this.channelConfig['toUser'] = fromUser
      try {
        clawDb.updateChannel(this.channelId, {
          config: this.channelConfig as Record<string, string>,
          status: 'success',
        })
        logger.info(`[channel:${this.channelId}] 自动绑定 toUser=${fromUser}`)
      } catch (err) {
        logger.error({ err }, `[channel:${this.channelId}] 持久化 toUser 失败`)
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
      `[channel:${this.channelId}] 企业微信消息 from=${fromUser} → agent=${effectiveAgentId}: ${text.slice(0, 60)}`
    )

    clawEventBus.emit('message:incoming', {
      agentId: effectiveAgentId,
      chatId: numericChatId,
      content: clawMessage.text(text),
      userId: this.userId,
      username: fromUser,
      messageId: Date.now(),
      timestamp: new Date(),
      channelId: this.channelId,
      sessionId: sessionResult.sessionId,
    })
  }

  // ── ChannelAdapterBase: send primitives ───────────────────────────────────

  protected async _sendText(chatId: number, text: string): Promise<void> {
    await this._sendWecomMessage(chatId, text)
  }

  protected async _sendTyping(_chatId: number): Promise<void> {
    // 企业微信不支持 typing 指示器
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

  // ── 企业微信 API 调用 ─────────────────────────────────────────────────────

  private async _sendWecomMessage(chatId: number, text: string): Promise<void> {
    if (!this.accessToken) {
      logger.warn(
        `[channel:${this.channelId}] 企业微信 access_token 未就绪，跳过发送`
      )
      return
    }

    const toUser = this._numberToUserId(chatId)
    const agentId = this.channelConfig['agentId'] ?? ''
    const toParty = this.channelConfig['toParty'] ?? ''

    if (!agentId) {
      logger.warn(
        `[channel:${this.channelId}] 企业微信未配置 agentId，无法发送消息`
      )
      return
    }

    const url = `${WECOM_API_BASE}/message/send?access_token=${this.accessToken}`
    const body: Record<string, unknown> = {
      agentid: parseInt(agentId, 10),
      msgtype: 'text',
      text: { content: text },
      safe: 0,
    }

    if (toUser) body['touser'] = toUser
    else if (toParty) body['toparty'] = toParty
    else body['touser'] = '@all'

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify(body),
    })
    const data = (await resp.json()) as { errcode: number; errmsg: string }
    if (data.errcode !== 0) {
      this.errorCount++
      logger.error(
        `[channel:${this.channelId}] 企业微信发送消息失败: ${data.errmsg}`
      )
    }
  }

  private async _refreshAccessToken(): Promise<void> {
    const url = `${WECOM_API_BASE}/gettoken?corpid=${this.channelConfig['corpId']}&corpsecret=${this.channelConfig['corpSecret']}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': getUserAgent() },
    })
    const data = (await resp.json()) as {
      errcode: number
      errmsg: string
      access_token?: string
      expires_in?: number
    }
    if (data.errcode === 0 && data.access_token) {
      this.accessToken = data.access_token
      this.tokenExpiresAt =
        Date.now() + (data.expires_in ?? 7200) * 1000 - 60_000
      logger.info(`[channel:${this.channelId}] 企业微信 access_token 已刷新`)
    } else {
      logger.error(
        `[channel:${this.channelId}] 企业微信获取 access_token 失败: ${data.errmsg}`
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
              `[channel:${this.channelId}] 企业微信 token 刷新失败`
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

  private _sha1(str: string): string {
    return crypto.createHash('sha1').update(str).digest('hex')
  }

  /** 企业微信 AES-256-CBC 解密（PKCS7 padding） */
  private _aesDecrypt(encrypted: string, encodingAesKey: string): string {
    const aesKey = Buffer.from(encodingAesKey + '=', 'base64')
    const iv = aesKey.slice(0, 16)
    const buf = Buffer.from(encrypted, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv)
    decipher.setAutoPadding(false)
    const decrypted = Buffer.concat([decipher.update(buf), decipher.final()])
    // 去掉前 16 字节随机串和 4 字节长度
    const msgLen = decrypted.readUInt32BE(16)
    return decrypted.slice(20, 20 + msgLen).toString('utf8')
  }

  private _extractXml(xml: string, tag: string): string {
    const match = xml.match(
      new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`)
    )
    return match ? match[1] : ''
  }

  private _userIdToNumber(userId: string): number {
    if (/^\d+$/.test(userId)) return parseInt(userId, 10)
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = (Math.imul(31, hash) + userId.charCodeAt(i)) | 0
    }
    return Math.abs(hash) || 1
  }

  private _numberToUserId(num: number): string {
    const toUser = this.channelConfig['toUser'] ?? ''
    if (toUser && this._userIdToNumber(toUser) === num) return toUser
    return String(num)
  }
}
