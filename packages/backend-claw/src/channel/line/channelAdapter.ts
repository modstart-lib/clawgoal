/**
 * LineChannelAdapter — LINE 消息渠道适配器
 *
 * 接收消息：LINE Messaging API Webhook 推送到 /api/webhook/channel/line/:channelId
 * 发送消息：调用 LINE Messaging API reply/push message
 *
 * 配置字段（存储在 claw_channel.config JSON）：
 *   channelAccessToken — Channel Access Token（必填）
 *   channelSecret      — Channel Secret，用于验证签名（必填）
 *   userId             — 默认推送的用户 ID 或群组 ID（可选）
 */

import crypto from 'crypto'
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

const logger = createLogger('line')
const LINE_API = 'https://api.line.me/v2/bot'

export class LineChannelAdapter extends ChannelAdapterBase {
  readonly channelType = 'line'

  get primaryChatId(): number | undefined {
    return this.allowedChatId
  }

  private channelConfig: Record<string, string>
  /** replyToken 缓存，用于回复最近一条消息 */
  private _lastReplyToken = ''

  constructor(row: ChannelRow, defaultAgentId: number) {
    const cfg = row.config
      ? (JSON.parse(row.config) as Record<string, string>)
      : {}
    if (!cfg['channelAccessToken']) {
      throw new Error(
        `Channel "${row.title}" (id=${row.id}) missing LINE channelAccessToken`
      )
    }
    super(row.id, row.title, row.is_global === 1, row.user_id, defaultAgentId)
    if (cfg['userId']) this.allowedChatId = this._idToNumber(cfg['userId'])
    this.channelConfig = { ...cfg }
  }

  async start(): Promise<void> {
    if (this.running) return
    this._setupEventBus()
    this.running = true
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" LINE 适配器已启动`
    )
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this._teardownEventBus()
    this.running = false
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" LINE 适配器已停止`
    )
  }

  // ── Webhook 入口 ──────────────────────────────────────────────────────────

  async handleWebhook(
    body: Record<string, unknown>,
    rawBody: string,
    headers: Record<string, string>
  ): Promise<void> {
    // 验证签名
    const secret = this.channelConfig['channelSecret'] ?? ''
    if (secret) {
      const signature = headers['x-line-signature'] ?? ''
      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64')
      if (expected !== signature) {
        logger.warn(`[channel:${this.channelId}] LINE 签名验证失败`)
        return
      }
    }

    const events = (body['events'] as Array<Record<string, unknown>>) ?? []
    for (const event of events) {
      if (event['type'] !== 'message') continue
      const message = event['message'] as Record<string, unknown> | undefined
      if (message?.['type'] !== 'text') continue

      const text = (message['text'] as string)?.trim() ?? ''
      if (!text) continue

      const source = event['source'] as Record<string, unknown> | undefined
      const userId = (source?.['userId'] as string) ?? ''
      const chatId = (source?.['groupId'] ??
        source?.['roomId'] ??
        source?.['userId'] ??
        '') as string
      const replyToken = (event['replyToken'] as string) ?? ''

      this.lastActivity = new Date()
      this._lastReplyToken = replyToken
      const numericChatId = this._idToNumber(chatId)

      if (!this.allowedChatId) {
        this.allowedChatId = numericChatId
        this.channelConfig['userId'] = chatId
        try {
          clawDb.updateChannel(this.channelId, {
            config: this.channelConfig as Record<string, string>,
            status: 'success',
          })
          logger.info(`[channel:${this.channelId}] 自动绑定 userId=${chatId}`)
        } catch (err) {
          logger.error(
            { err },
            `[channel:${this.channelId}] 持久化 userId 失败`
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
        `[channel:${this.channelId}] LINE 消息 chat=${chatId} user=${userId} → agent=${effectiveAgentId}: ${text.slice(0, 60)}`
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
  }

  protected async _sendText(chatId: number, text: string): Promise<void> {
    const token = this.channelConfig['channelAccessToken']
    // 优先使用 replyToken（有效期 30s），否则使用 push message
    if (this._lastReplyToken) {
      const replyToken = this._lastReplyToken
      this._lastReplyToken = ''
      const resp = await fetch(`${LINE_API}/message/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': getUserAgent(),
        },
        body: JSON.stringify({
          replyToken,
          messages: [{ type: 'text', text: text.slice(0, 5000) }],
        }),
      })
      if (resp.ok) return
    }

    // Fallback: push message
    const targetId = this._numberToId(chatId)
    if (!targetId) return
    const resp = await fetch(`${LINE_API}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({
        to: targetId,
        messages: [{ type: 'text', text: text.slice(0, 5000) }],
      }),
    })
    if (!resp.ok) {
      this.errorCount++
      logger.error(`[channel:${this.channelId}] LINE 发送失败: ${resp.status}`)
    }
  }

  protected async _sendTyping(_chatId: number): Promise<void> {
    // LINE 不支持 typing 指示器
  }

  protected _buildOutgoingText(
    rawText: string,
    agentObj: Agent | undefined,
    showHeader: boolean
  ): string {
    if (rawText && agentObj?.title && showHeader)
      return `【${agentObj.title}】\n\n${rawText}`
    return rawText
  }

  protected _buildToolStartText(
    toolName: string,
    _params: Record<string, unknown>
  ): string {
    return `⚙️ ${toolName} 执行中...`
  }

  protected _buildToolMergedText(
    _s: string,
    toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string {
    const icon = success ? '✅' : '❌'
    return `${icon} ${toolName} ${success ? (config.lang !== 'en-US' ? '完成' : 'done') : config.lang !== 'en-US' ? '失败' : 'failed'} (${(durationMs / 1000).toFixed(1)}s)${result ? '\n' + result.slice(0, 500) : ''}`
  }

  protected _buildToolEndText(
    toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string {
    const icon = success ? '✅' : '❌'
    return `${icon} ${toolName} (${(durationMs / 1000).toFixed(1)}s)${result ? '\n' + result.slice(0, 500) : ''}`
  }

  protected async _notifyMaxRoundsReached(chatId: number): Promise<void> {
    await this._sendText(
      chatId,
      config.lang !== 'en-US'
        ? '⚠️ 已达到最大工具调用轮次，请回复"继续"以继续运行。'
        : '⚠️ Max tool call rounds reached. Reply "continue" to keep running.'
    )
  }

  protected async _notifyPinChanged(
    chatId: number,
    agent: Agent | undefined
  ): Promise<void> {
    await this._sendText(chatId, `📍 已切换到 ${agent?.title ?? '未知'}`)
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

  private _idToNumber(id: string): number {
    let hash = 0
    for (let i = 0; i < id.length; i++)
      hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0
    return Math.abs(hash) || 1
  }

  private _numberToId(num: number): string {
    const raw = this.channelConfig['userId'] ?? ''
    if (raw && this._idToNumber(raw) === num) return raw
    return String(num)
  }
}
