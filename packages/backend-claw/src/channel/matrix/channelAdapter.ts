/**
 * MatrixChannelAdapter — Matrix 消息渠道适配器（长轮询模式）
 *
 * 接收消息：通过 Matrix Client-Server API 长轮询（/sync）接收消息
 * 发送消息：调用 Matrix Client-Server API 发送消息
 *
 * 配置字段（存储在 claw_channel.config JSON）：
 *   homeserverUrl  — Matrix 服务器地址（如 https://matrix.org，必填）
 *   accessToken    — 用户 Access Token（必填）
 *   roomId         — 默认房间 ID（!xxx:server，可选）
 */

import { getUserAgent } from '../../../../backend/src/utils/utils.js'
import { getByUserId } from '../../../../backend/src/utils/tenant.js'
import { config } from '../../../../backend/src/config/index.js'
import { safeJsonParse } from '../../../../backend/src/utils/json.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import { createLogger } from '../../kernel/logger.js'
import { clawDb } from '../../storage/store/index.js'
import type { ChannelRow } from '../../storage/store/index.js'
import type { Agent } from '../../types/index.js'
import { clawMessage } from '../../types/index.js'
import { resolveIncomingSession } from '../../storage/sessionManager.js'
import { ChannelAdapterBase } from '../adapterBase.js'

const logger = createLogger('matrix')

export class MatrixChannelAdapter extends ChannelAdapterBase {
  readonly channelType = 'matrix'

  get primaryChatId(): number | undefined {
    return this.allowedChatId
  }

  private channelConfig: Record<string, string>
  private _syncToken = ''
  private _syncTimer: ReturnType<typeof setTimeout> | null = null
  private _intentionalStop = false
  private _myUserId = ''

  constructor(row: ChannelRow, defaultAgentId: number) {
    const cfg = row.config
      ? safeJsonParse(
          row.config,
          {} as Record<string, string>,
          'channel.config'
        )
      : {}
    if (!cfg['homeserverUrl'] || !cfg['accessToken']) {
      throw new Error(
        `Channel "${row.title}" (id=${row.id}) missing Matrix homeserverUrl or accessToken`
      )
    }
    super(row.id, row.title, row.is_global === 1, row.user_id, defaultAgentId)
    if (cfg['roomId']) this.allowedChatId = this._idToNumber(cfg['roomId'])
    this.channelConfig = { ...cfg }
  }

  async start(): Promise<void> {
    if (this.running) return
    this._intentionalStop = false
    // 获取自己的 userId，用于过滤自己发的消息
    await this._fetchMyUserId()
    this._setupEventBus()
    this.running = true
    this._schedulePoll()
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" Matrix 适配器已启动`
    )
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this._intentionalStop = true
    if (this._syncTimer) {
      clearTimeout(this._syncTimer)
      this._syncTimer = null
    }
    this._teardownEventBus()
    this.running = false
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" Matrix 适配器已停止`
    )
  }

  private async _fetchMyUserId(): Promise<void> {
    try {
      const resp = await fetch(
        `${this._apiBase()}/_matrix/client/v3/account/whoami`,
        {
          headers: this._headers(),
        }
      )
      const data = (await resp.json()) as { user_id?: string }
      if (data.user_id) this._myUserId = data.user_id
    } catch (err) {
      logger.warn(
        { err },
        `[channel:${this.channelId}] Matrix 获取 userId 失败`
      )
    }
  }

  private _schedulePoll(): void {
    if (this._intentionalStop) return
    this._syncTimer = setTimeout(() => this._poll(), 0)
  }

  private async _poll(): Promise<void> {
    if (this._intentionalStop) return
    try {
      const timeout = 30000
      const url = new URL(`${this._apiBase()}/_matrix/client/v3/sync`)
      url.searchParams.set('timeout', String(timeout))
      if (this._syncToken) url.searchParams.set('since', this._syncToken)

      const resp = await fetch(url.toString(), {
        headers: this._headers(),
        signal: AbortSignal.timeout(timeout + 5000),
      })

      if (!resp.ok) {
        logger.warn(
          `[channel:${this.channelId}] Matrix sync 失败: ${resp.status}`
        )
        await new Promise((r) => setTimeout(r, 5000))
      } else {
        const data = (await resp.json()) as {
          next_batch: string
          rooms?: {
            join?: Record<
              string,
              { timeline?: { events?: Array<Record<string, unknown>> } }
            >
          }
        }
        this._syncToken = data.next_batch
        await this._processSync(data)
      }
    } catch (err) {
      if (!this._intentionalStop) {
        logger.warn({ err }, `[channel:${this.channelId}] Matrix sync 异常`)
        await new Promise((r) => setTimeout(r, 5000))
      }
    }
    if (!this._intentionalStop) this._schedulePoll()
  }

  private async _processSync(data: {
    rooms?: {
      join?: Record<
        string,
        { timeline?: { events?: Array<Record<string, unknown>> } }
      >
    }
  }): Promise<void> {
    const joinedRooms = data.rooms?.join ?? {}
    for (const [roomId, roomData] of Object.entries(joinedRooms)) {
      const events = roomData.timeline?.events ?? []
      for (const event of events) {
        if (event['type'] !== 'm.room.message') continue
        const content = event['content'] as Record<string, unknown> | undefined
        if (content?.['msgtype'] !== 'm.text') continue
        const text = (content['body'] as string)?.trim() ?? ''
        if (!text) continue
        const sender = (event['sender'] as string) ?? ''
        if (sender === this._myUserId) continue // 忽略自己发的消息

        this.lastActivity = new Date()
        const numericChatId = this._idToNumber(roomId)

        if (!this.allowedChatId) {
          this.allowedChatId = numericChatId
          this.channelConfig['roomId'] = roomId
          try {
            clawDb.updateChannel(this.channelId, {
              config: this.channelConfig as Record<string, string>,
              status: 'success',
            })
            logger.info(`[channel:${this.channelId}] 自动绑定 roomId=${roomId}`)
          } catch (err) {
            logger.error(
              { err },
              `[channel:${this.channelId}] 持久化 roomId 失败`
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
        if (sessionResult.isCommand) continue

        logger.info(
          `[channel:${this.channelId}] Matrix 消息 room=${roomId} sender=${sender} → agent=${effectiveAgentId}: ${text.slice(0, 60)}`
        )

        clawEventBus.emit('message:incoming', {
          agentId: effectiveAgentId,
          chatId: numericChatId,
          content: clawMessage.text(text),
          userId: this.userId,
          username: sender,
          messageId: Date.now(),
          timestamp: new Date(),
          channelId: this.channelId,
          sessionId: sessionResult.sessionId,
        })
      }
    }
  }

  protected async _sendText(chatId: number, text: string): Promise<void> {
    const roomId = this._numberToId(chatId)
    if (!roomId) return
    const txnId = `${Date.now()}`
    const url = `${this._apiBase()}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { ...this._headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'm.text', body: text }),
    })
    if (!resp.ok) {
      this.errorCount++
      logger.error(
        `[channel:${this.channelId}] Matrix 发送失败: ${resp.status}`
      )
    }
  }

  protected async _sendTyping(chatId: number): Promise<void> {
    const roomId = this._numberToId(chatId)
    if (!roomId || !this._myUserId) return
    await fetch(
      `${this._apiBase()}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/typing/${encodeURIComponent(this._myUserId)}`,
      {
        method: 'PUT',
        headers: { ...this._headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ typing: true, timeout: 10000 }),
      }
    ).catch(() => {})
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

  private _apiBase(): string {
    return (this.channelConfig['homeserverUrl'] ?? '').replace(/\/$/, '')
  }

  private _headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.channelConfig['accessToken']}`,
      'User-Agent': getUserAgent(),
    }
  }

  private _idToNumber(id: string): number {
    let hash = 0
    for (let i = 0; i < id.length; i++)
      hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0
    return Math.abs(hash) || 1
  }

  private _numberToId(num: number): string {
    const raw = this.channelConfig['roomId'] ?? ''
    if (raw && this._idToNumber(raw) === num) return raw
    return String(num)
  }
}
