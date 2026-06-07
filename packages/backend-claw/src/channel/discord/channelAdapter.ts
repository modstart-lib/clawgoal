/**
 * DiscordChannelAdapter — Discord 消息渠道适配器
 *
 * 接收消息：Discord 通过 HTTP POST 推送 Interaction 到 /api/webhook/channel/discord/:channelId
 *           或通过 Gateway WebSocket 长连接接收消息（本实现使用 Webhook 模式）
 * 发送消息：调用 Discord REST API 发送消息
 *
 * 配置字段（存储在 claw_channel.config JSON）：
 *   token          — Bot Token（必填）
 *   publicKey      — 应用公钥，用于验证 Interaction 签名（必填）
 *   channelId      — 默认发送消息的频道 ID
 *   guildId        — 服务器 ID（可选）
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

const logger = createLogger('discord')
const DISCORD_API = 'https://discord.com/api/v10'

export class DiscordChannelAdapter extends ChannelAdapterBase {
  readonly channelType = 'discord'

  get primaryChatId(): number | undefined {
    return this.allowedChatId
  }

  private channelConfig: Record<string, string>

  constructor(row: ChannelRow, defaultAgentId: number) {
    const cfg = row.config
      ? (JSON.parse(row.config) as Record<string, string>)
      : {}
    if (!cfg['token']) {
      throw new Error(
        `Channel "${row.title}" (id=${row.id}) missing Discord Bot Token`
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
      `[channel:${this.channelId}] "${this.channelTitle}" Discord 适配器已启动`
    )
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this._teardownEventBus()
    this.running = false
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" Discord 适配器已停止`
    )
  }

  // ── Webhook 入口 ──────────────────────────────────────────────────────────

  async handleWebhook(
    body: Record<string, unknown>,
    rawBody: string,
    headers: Record<string, string>
  ): Promise<{ type: number; data?: { content: string } } | null> {
    // 验证签名
    const publicKey = this.channelConfig['publicKey'] ?? ''
    if (publicKey) {
      const signature = headers['x-signature-ed25519'] ?? ''
      const timestamp = headers['x-signature-timestamp'] ?? ''
      if (!this._verifySignature(rawBody, signature, timestamp, publicKey)) {
        logger.warn(`[channel:${this.channelId}] Discord 签名验证失败`)
        return null
      }
    }

    const type = body['type'] as number
    // PING 握手
    if (type === 1) return { type: 1 }

    // APPLICATION_COMMAND 或 MESSAGE_COMPONENT
    if (type === 2 || type === 3) {
      const data = body['data'] as Record<string, unknown> | undefined
      const text =
        (data?.['options'] as Array<{ value: string }> | undefined)?.[0]
          ?.value ??
        (data?.['custom_id'] as string) ??
        ''
      const member = body['member'] as Record<string, unknown> | undefined
      const user = (member?.['user'] ?? body['user']) as
        | Record<string, unknown>
        | undefined
      const userId = (user?.['id'] as string) ?? ''
      const channelId = (body['channel_id'] as string) ?? ''

      if (text) await this._handleIncoming(text, channelId, userId)
      return { type: 4, data: { content: '✅' } }
    }

    // MESSAGE_CREATE（通过 Gateway 转发的消息，type=0 表示普通消息事件）
    if (type === 0 || !type) {
      const content = (body['content'] as string) ?? ''
      const channelId = (body['channel_id'] as string) ?? ''
      const author = body['author'] as Record<string, unknown> | undefined
      const userId = (author?.['id'] as string) ?? ''
      const botId = (author?.['bot'] as boolean) ?? false
      if (!botId && content)
        await this._handleIncoming(content, channelId, userId)
    }

    return { type: 1 }
  }

  private async _handleIncoming(
    text: string,
    channelId: string,
    userId: string
  ): Promise<void> {
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
    if (sessionResult.isCommand) return

    logger.info(
      `[channel:${this.channelId}] Discord 消息 channel=${channelId} user=${userId} → agent=${effectiveAgentId}: ${text.slice(0, 60)}`
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
    const channelId = this._numberToId(chatId, 'channelId')
    if (!channelId) return
    const url = `${DISCORD_API}/channels/${channelId}/messages`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${this.channelConfig['token']}`,
        'User-Agent': getUserAgent(),
      },
      body: JSON.stringify({ content: text.slice(0, 2000) }),
    })
    if (!resp.ok) {
      this.errorCount++
      logger.error(
        `[channel:${this.channelId}] Discord 发送失败: ${resp.status}`
      )
    }
  }

  protected async _sendTyping(chatId: number): Promise<void> {
    const channelId = this._numberToId(chatId, 'channelId')
    if (!channelId) return
    await fetch(`${DISCORD_API}/channels/${channelId}/typing`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${this.channelConfig['token']}`,
        'User-Agent': getUserAgent(),
      },
    }).catch(() => {})
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
    params: Record<string, unknown>
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

  private _verifySignature(
    body: string,
    signature: string,
    timestamp: string,
    publicKey: string
  ): boolean {
    try {
      const key = Buffer.from(publicKey, 'hex')
      const msg = Buffer.from(timestamp + body)
      const sig = Buffer.from(signature, 'hex')
      return crypto.verify(
        null,
        msg,
        { key, format: 'der', type: 'spki', dsaEncoding: 'ieee-p1363' },
        sig
      )
    } catch {
      return true // 无法验证时放行（公钥未配置）
    }
  }

  private _idToNumber(id: string): number {
    if (/^\d+$/.test(id)) {
      const n = parseInt(id, 10)
      return n > 2147483647 ? (n % 2147483647) + 1 : n
    }
    let hash = 0
    for (let i = 0; i < id.length; i++)
      hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0
    return Math.abs(hash) || 1
  }

  private _numberToId(num: number, key: string): string {
    const raw = this.channelConfig[key] ?? ''
    if (raw && this._idToNumber(raw) === num) return raw
    return String(num)
  }
}
