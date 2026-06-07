/**
 * MattermostChannelAdapter — Mattermost 消息渠道适配器（Webhook 模式）
 *
 * 接收消息：Mattermost Outgoing Webhook 推送到 /api/webhook/channel/mattermost/:channelId
 * 发送消息：调用 Mattermost REST API 发送消息
 *
 * 配置字段（存储在 claw_channel.config JSON）：
 *   serverUrl      — Mattermost 服务器地址（如 https://mattermost.example.com，必填）
 *   token          — Bot Token 或 Personal Access Token（必填）
 *   channelId      — 默认发送消息的频道 ID（可选）
 *   outgoingToken  — Outgoing Webhook Token，用于验证请求（可选）
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

const logger = createLogger('mattermost')

export class MattermostChannelAdapter extends ChannelAdapterBase {
  readonly channelType = 'mattermost'

  get primaryChatId(): number | undefined {
    return this.allowedChatId
  }

  private channelConfig: Record<string, string>

  constructor(row: ChannelRow, defaultAgentId: number) {
    const cfg = row.config
      ? (JSON.parse(row.config) as Record<string, string>)
      : {}
    if (!cfg['serverUrl'] || !cfg['token']) {
      throw new Error(
        `Channel "${row.title}" (id=${row.id}) missing Mattermost serverUrl or token`
      )
    }
    super(row.id, row.title, row.is_global === 1, row.user_id, defaultAgentId)
    if (cfg['channelId'])
      this.allowedChatId = this._idToNumber(cfg['channelId'])
    this.channelConfig = { ...cfg }
  }

  async start(): Promise<void> {
    if (this.running) return
    this._setupEventBus()
    this.running = true
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" Mattermost 适配器已启动`
    )
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this._teardownEventBus()
    this.running = false
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" Mattermost 适配器已停止`
    )
  }

  // ── Webhook 入口（Outgoing Webhook）──────────────────────────────────────

  async handleWebhook(
    body: Record<string, unknown>
  ): Promise<{ text?: string } | null> {
    // 验证 token
    const outgoingToken = this.channelConfig['outgoingToken'] ?? ''
    if (outgoingToken && body['token'] !== outgoingToken) {
      logger.warn(
        `[channel:${this.channelId}] Mattermost Webhook token 验证失败`
      )
      return null
    }

    const text = (body['text'] as string)?.trim() ?? ''
    if (!text) return {}

    const userId = (body['user_id'] as string) ?? ''
    const channelId = (body['channel_id'] as string) ?? ''

    this.lastActivity = new Date()
    const numericChatId = this._idToNumber(channelId)

    if (!this.allowedChatId) {
      this.allowedChatId = numericChatId
      this.channelConfig['channelId'] = channelId
      try {
        clawDb.updateChannel(this.channelId, {
          config: this.channelConfig as Record<string, string>,
          status: 'success',
        })
        logger.info(
          `[channel:${this.channelId}] 自动绑定 channelId=${channelId}`
        )
      } catch (err) {
        logger.error(
          { err },
          `[channel:${this.channelId}] 持久化 channelId 失败`
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
    if (sessionResult.isCommand) return {}

    logger.info(
      `[channel:${this.channelId}] Mattermost 消息 channel=${channelId} user=${userId} → agent=${effectiveAgentId}: ${text.slice(0, 60)}`
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

    return {}
  }

  protected async _sendText(chatId: number, text: string): Promise<void> {
    const channelId = this._numberToId(chatId)
    const serverUrl = (this.channelConfig['serverUrl'] ?? '').replace(/\/$/, '')
    const resp = await fetch(`${serverUrl}/api/v4/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.channelConfig['token']}`,
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({ channel_id: channelId, message: text }),
    })
    if (!resp.ok) {
      this.errorCount++
      logger.error(
        `[channel:${this.channelId}] Mattermost 发送失败: ${resp.status}`
      )
    }
  }

  protected async _sendTyping(_chatId: number): Promise<void> {
    // Mattermost 不支持 typing 指示器（需要 WebSocket）
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

  private _idToNumber(id: string): number {
    let hash = 0
    for (let i = 0; i < id.length; i++)
      hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0
    return Math.abs(hash) || 1
  }

  private _numberToId(num: number): string {
    const raw = this.channelConfig['channelId'] ?? ''
    if (raw && this._idToNumber(raw) === num) return raw
    return String(num)
  }
}
