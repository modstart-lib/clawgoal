/**
 * MSTeamsChannelAdapter — Microsoft Teams 消息渠道适配器
 *
 * 接收消息：Teams Bot Framework 推送到 /api/webhook/channel/msteams/:channelId
 * 发送消息：调用 Bot Framework REST API 发送消息
 *
 * 配置字段（存储在 claw_channel.config JSON）：
 *   appId          — Azure Bot App ID（必填）
 *   appPassword    — Azure Bot App Password（必填）
 *   serviceUrl     — Bot Framework Service URL（首次收到消息后自动获取）
 *   conversationId — 默认会话 ID（首次收到消息后自动获取）
 */

import { getUserAgent } from '../../../../backend/src/utils/utils.js'
import { getByUserId } from '../../../../backend/src/utils/tenant.js'
import { config } from '../../../../backend/src/config/index.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import { createLogger } from '../../kernel/logger.js'
import { clawDb } from '../../storage/store/index.js'
import type { ChannelRow } from '../../storage/store/index.js'
import type { Agent } from '../../types/index.js'
import { clawMessage } from '../../types/index.js'
import { resolveIncomingSession } from '../../storage/sessionManager.js'
import { ChannelAdapterBase } from '../adapterBase.js'

const logger = createLogger('msteams')

export class MSTeamsChannelAdapter extends ChannelAdapterBase {
  readonly channelType = 'msteams'

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
    if (!cfg['appId'] || !cfg['appPassword']) {
      throw new Error(
        `Channel "${row.title}" (id=${row.id}) missing Teams appId or appPassword`
      )
    }
    super(row.id, row.title, row.is_global === 1, row.user_id, defaultAgentId)
    if (cfg['conversationId'])
      this.allowedChatId = this._idToNumber(cfg['conversationId'])
    this.channelConfig = { ...cfg }
  }

  async start(): Promise<void> {
    if (this.running) return
    await this._refreshAccessToken()
    this._startTokenRefresh()
    this._setupEventBus()
    this.running = true
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" MS Teams 适配器已启动`
    )
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this._stopTokenRefresh()
    this._teardownEventBus()
    this.running = false
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" MS Teams 适配器已停止`
    )
  }

  // ── Webhook 入口 ──────────────────────────────────────────────────────────

  async handleWebhook(body: Record<string, unknown>): Promise<void> {
    const activityType = body['type'] as string
    if (activityType !== 'message') return

    const text = (body['text'] as string)?.trim() ?? ''
    if (!text) return

    const from = body['from'] as Record<string, unknown> | undefined
    const userId = (from?.['id'] as string) ?? ''
    const conversation = body['conversation'] as
      | Record<string, unknown>
      | undefined
    const conversationId = (conversation?.['id'] as string) ?? ''
    const serviceUrl = (body['serviceUrl'] as string) ?? ''

    this.lastActivity = new Date()
    const numericChatId = this._idToNumber(conversationId)

    // 自动绑定 serviceUrl 和 conversationId
    if (!this.channelConfig['serviceUrl'] && serviceUrl) {
      this.channelConfig['serviceUrl'] = serviceUrl
    }
    if (!this.allowedChatId) {
      this.allowedChatId = numericChatId
      this.channelConfig['conversationId'] = conversationId
      try {
        clawDb.updateChannel(this.channelId, {
          config: this.channelConfig as Record<string, string>,
          status: 'success',
        })
        logger.info(
          `[channel:${this.channelId}] 自动绑定 conversationId=${conversationId}`
        )
      } catch (err) {
        logger.error(
          { err },
          `[channel:${this.channelId}] 持久化 conversationId 失败`
        )
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
      `[channel:${this.channelId}] Teams 消息 conversation=${conversationId} user=${userId} → agent=${effectiveAgentId}: ${text.slice(0, 60)}`
    )

    clawEventBus.emit('message:incoming', {
      agentId: effectiveAgentId,
      chatId: numericChatId,
      content: clawMessage.text(text),
      userId: this.userId,
      username: userId,
      messageId: Date.now(),
      timestamp: new Date(),
      channelId: this.channelId,
      sessionId: sessionResult.sessionId,
    })
  }

  protected async _sendText(chatId: number, text: string): Promise<void> {
    const serviceUrl =
      this.channelConfig['serviceUrl'] ?? 'https://smba.trafficmanager.net/apis'
    const conversationId = this._numberToId(chatId)
    if (!conversationId || !this.accessToken) return

    const url = `${serviceUrl}/v3/conversations/${encodeURIComponent(conversationId)}/activities`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({ type: 'message', text }),
    })
    if (!resp.ok) {
      this.errorCount++
      logger.error(`[channel:${this.channelId}] Teams 发送失败: ${resp.status}`)
    }
  }

  protected async _sendTyping(_chatId: number): Promise<void> {
    // Teams 不支持 typing 指示器
  }

  protected _buildOutgoingText(
    rawText: string,
    agentObj: Agent | undefined,
    showHeader: boolean
  ): string {
    if (rawText && agentObj?.title && showHeader)
      return `**[${agentObj.title}]**\n\n${rawText}`
    return rawText
  }

  protected _buildToolStartText(
    toolName: string,
    _params: Record<string, unknown>
  ): string {
    return `⚙️ **${toolName}** 执行中...`
  }

  protected _buildToolMergedText(
    _s: string,
    toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string {
    const isZh = config.lang !== 'en-US'
    const icon = success ? '✅' : '❌'
    return `${icon} **${toolName}** ${success ? (isZh ? '完成' : 'done') : isZh ? '失败' : 'failed'} (${(durationMs / 1000).toFixed(1)}s)${result ? '\n' + result.slice(0, 500) : ''}`
  }

  protected _buildToolEndText(
    toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string {
    const icon = success ? '✅' : '❌'
    return `${icon} **${toolName}** (${(durationMs / 1000).toFixed(1)}s)${result ? '\n' + result.slice(0, 500) : ''}`
  }

  protected async _notifyMaxRoundsReached(chatId: number): Promise<void> {
    const isZh = config.lang !== 'en-US'
    await this._sendText(
      chatId,
      isZh
        ? '⚠️ 已达到最大工具调用轮次，请回复"继续"以继续运行。'
        : '⚠️ Max tool call rounds reached. Reply "continue" to keep running.'
    )
  }

  protected async _notifyPinChanged(
    chatId: number,
    agent: Agent | undefined
  ): Promise<void> {
    const isZh = config.lang !== 'en-US'
    await this._sendText(
      chatId,
      isZh
        ? `📍 已切换到 **${agent?.title ?? '未知'}**`
        : `📍 Switched to **${agent?.title ?? 'unknown'}**`
    )
  }

  protected async _notifyPinExpired(
    chatId: number,
    agentTitle: string,
    supervisorTitle: string
  ): Promise<void> {
    await this._sendText(
      chatId,
      `⏰ 与 **${agentTitle}** 的专属对话已结束，已恢复由 **${supervisorTitle}** 接管。`
    )
  }

  private async _refreshAccessToken(): Promise<void> {
    const url = `https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token`
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.channelConfig['appId'] ?? '',
      client_secret: this.channelConfig['appPassword'] ?? '',
      scope: 'https://api.botframework.com/.default',
    })
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': getUserAgent(),
      },
      body: body.toString(),
    })
    const data = (await resp.json()) as {
      access_token?: string
      expires_in?: number
      error?: string
    }
    if (data.access_token) {
      this.accessToken = data.access_token
      this.tokenExpiresAt =
        Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000
      logger.info(`[channel:${this.channelId}] Teams access_token 已刷新`)
    } else {
      logger.error(
        `[channel:${this.channelId}] Teams 获取 access_token 失败: ${data.error}`
      )
    }
  }

  private _startTokenRefresh(): void {
    this._stopTokenRefresh()
    this._tokenRefreshTimer = setInterval(
      async () => {
        if (Date.now() >= this.tokenExpiresAt) {
          await this._refreshAccessToken().catch((err) =>
            logger.error({ err }, `Teams token 刷新失败`)
          )
        }
      },
      50 * 60 * 1000
    )
  }

  private _stopTokenRefresh(): void {
    if (this._tokenRefreshTimer) {
      clearInterval(this._tokenRefreshTimer)
      this._tokenRefreshTimer = null
    }
  }

  private _idToNumber(id: string): number {
    let hash = 0
    for (let i = 0; i < id.length; i++)
      hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0
    return Math.abs(hash) || 1
  }

  private _numberToId(num: number): string {
    const raw = this.channelConfig['conversationId'] ?? ''
    if (raw && this._idToNumber(raw) === num) return raw
    return String(num)
  }
}
