/**
 * ChannelManager — manages all channel adapter connections.
 *
 * On init, reads every enabled row from claw_channel, creates the appropriate
 * adapter (Telegram, Feishu, …), connects it, and keeps track of its lifecycle.
 *
 * All state changes are broadcast on clawEventBus:
 *   channel:connected     — adapter successfully connected
 *   channel:disconnected  — adapter stopped
 *   channel:error         — adapter encountered a runtime error
 *
 * Routing strategy: incoming messages from a channel are emitted with the
 * supervisor agentId so the existing gateway Model loop picks them up.
 * If no active supervisor is found the channel is still started but a warning is logged.
 */

import { agentManager } from '../agent'
import { clawEventBus, type OutgoingMessageEvent } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import { clawDb } from '../storage/store/index.js'
import type { AgentContext } from '../types'
import { clawMessage } from '../types'
import { getAgentLogger } from '../utils/logger.js'
import type { BaseChannelAdapter, ChannelAdapterStatus } from './base.js'
import { TelegramChannelAdapter } from './telegram'
import { FeishuChannelAdapter } from './feishu/channelAdapter.js'
import { DingtalkChannelAdapter } from './dingtalk/channelAdapter.js'
import { WecomChannelAdapter } from './wecom/channelAdapter.js'
import { DiscordChannelAdapter } from './discord/channelAdapter.js'
import { SlackChannelAdapter } from './slack/channelAdapter.js'
import { MSTeamsChannelAdapter } from './msteams/channelAdapter.js'
import { LineChannelAdapter } from './line/channelAdapter.js'
import { MatrixChannelAdapter } from './matrix/channelAdapter.js'
import { MattermostChannelAdapter } from './mattermost/channelAdapter.js'

const logger = createLogger('channel-manager')

export class ChannelManager {
  /** Active adapters keyed by channelId */
  private adapters = new Map<number, BaseChannelAdapter>()

  constructor() {
    // ─── Event-driven config reload ─────────────────────────────────────────
    // When a channel record is created or updated, automatically start/restart/stop
    // the adapter based on the latest enable state — callers only need to emit
    // the event; no direct channelManager calls required.
    clawEventBus.on('channel:configChanged', ({ channelId }) => {
      const row = clawDb.findChannelById(channelId)
      if (row?.enable) {
        this.startChannel(channelId).catch((err: unknown) => {
          logger.error(
            `[channel:${channelId}] Auto-restart after config change failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          )
        })
      } else {
        this.stopChannel(channelId).catch(() => {
          /* adapter may not be running */
        })
      }
    })

    // When a channel is deleted, stop the adapter if it is currently running.
    clawEventBus.on('channel:configDeleted', ({ channelId }) => {
      this.stopChannel(channelId).catch(() => {
        /* adapter may not be running */
      })
    })

    // Route outgoing messages to the appropriate channel adapter(s)
    clawEventBus.on('message:outgoing', (evt) => this._dispatchOutgoing(evt))
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Start all enabled channels from the database.
   * Individual failures are logged but do not abort other channels.
   */
  async startAll(): Promise<void> {
    const channels = clawDb.findAllEnabledChannels()
    logger.info(`Starting ${channels.length} channel(s) from database...`)

    const results = await Promise.allSettled(
      channels.map((ch) =>
        this._startChannel(ch.id, this._resolveDefaultAgentId(ch.id))
      )
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    logger.info(
      `Channel manager ready: ${results.length - failed} connected, ${failed} failed`
    )
  }

  /**
   * Start (or restart) a single channel by its DB id.
   * If the channel is already running it is stopped first.
   */
  async startChannel(channelId: number): Promise<void> {
    if (this.adapters.has(channelId)) {
      await this.stopChannel(channelId)
    }
    await this._startChannel(channelId, this._resolveDefaultAgentId(channelId))
  }

  /** Stop a running channel adapter */
  async stopChannel(channelId: number): Promise<void> {
    const adapter = this.adapters.get(channelId)
    if (!adapter) return

    await adapter.stop()
    this.adapters.delete(channelId)

    clawEventBus.emit('channel:disconnected', {
      channelId,
      channelTitle: adapter.channelTitle,
      channelType: adapter.channelType,
    })
    logger.info(`[channel:${channelId}] "${adapter.channelTitle}" disconnected`)
  }

  /** Stop all running channel adapters */
  async stopAll(): Promise<void> {
    const ids = [...this.adapters.keys()]
    logger.info(`Stopping ${ids.length} channel(s)...`)
    await Promise.allSettled(ids.map((id) => this.stopChannel(id)))
    logger.info('All channels stopped')
  }

  // ─── Observability ────────────────────────────────────────────────────────

  /** Snapshot of all adapter statuses */
  getStatuses(): ChannelAdapterStatus[] {
    return [...this.adapters.values()].map((a) => a.getStatus())
  }

  /** 获取指定 channelId 的适配器实例（供 Webhook 路由使用） */
  getAdapter(channelId: number): BaseChannelAdapter | undefined {
    return this.adapters.get(channelId)
  }

  /** Human-readable health summary */
  healthReport(): string {
    const statuses = this.getStatuses()
    if (statuses.length === 0) return '⚠️  No active channels'
    const lines = statuses.map((s) => {
      const icon = s.connected ? '🟢' : '🔴'
      const last = s.lastActivity
        ? s.lastActivity.toLocaleTimeString()
        : 'never'
      return `  ${icon} [${s.channelType}] "${s.channelTitle}" | errors: ${s.errorCount} | last: ${last}`
    })
    return `Channel Manager (${statuses.length} channels):\n${lines.join('\n')}`
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private async _startChannel(
    channelId: number,
    defaultAgentId: number
  ): Promise<void> {
    const row = clawDb.findChannelById(channelId)
    if (!row) throw new Error(`Channel id=${channelId} not found in database`)

    if (!row.enable) {
      logger.debug(
        `Channel "${row.title}" (id=${channelId}) is disabled, skipping`
      )
      return
    }

    let adapter: BaseChannelAdapter

    if (row.type === 'telegram') {
      adapter = new TelegramChannelAdapter(row, defaultAgentId)
    } else if (row.type === 'feishu') {
      adapter = new FeishuChannelAdapter(row, defaultAgentId)
    } else if (row.type === 'dingtalk') {
      adapter = new DingtalkChannelAdapter(row, defaultAgentId)
    } else if (row.type === 'wecom') {
      adapter = new WecomChannelAdapter(row, defaultAgentId)
    } else if (row.type === 'discord') {
      adapter = new DiscordChannelAdapter(row, defaultAgentId)
    } else if (row.type === 'slack') {
      adapter = new SlackChannelAdapter(row, defaultAgentId)
    } else if (row.type === 'msteams') {
      adapter = new MSTeamsChannelAdapter(row, defaultAgentId)
    } else if (row.type === 'line') {
      adapter = new LineChannelAdapter(row, defaultAgentId)
    } else if (row.type === 'matrix') {
      adapter = new MatrixChannelAdapter(row, defaultAgentId)
    } else if (row.type === 'mattermost') {
      adapter = new MattermostChannelAdapter(row, defaultAgentId)
    } else {
      throw new Error(
        `Unsupported channel type "${row.type}" for channel "${row.title}" (id=${channelId})`
      )
    }

    try {
      await adapter.start()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(
        `Failed to start channel "${row.title}" (id=${channelId}): ${msg}`
      )
      clawEventBus.emit('channel:error', {
        channelId: row.id,
        channelTitle: row.title,
        error: msg,
      })
      throw err
    }

    this.adapters.set(channelId, adapter)

    // Mark channel as connected in the DB
    clawDb.markChannelSuccess(channelId)

    clawEventBus.emit('channel:connected', {
      channelId: row.id,
      channelTitle: row.title,
      channelType: row.type,
    })
    logger.info(
      `[channel:${channelId}] "${row.title}" (${row.type}) connected → routing to agent "${defaultAgentId}"`
    )
  }

  /**
   * Resolve the default routing target for incoming channel messages.
   *
   * Priority:
   *   1. An active agent whose `channelIds` list includes this channelId.
   *   2. Any active agent (fallback when no explicit binding exists).
   *
   * Returns 'unrouted' when no active agent is available at all (rare at startup).
   * NOTE: This value is only used as the initial fallback stored on the adapter.
   * The adapter re-resolves the target dynamically on every message, so changes to
   * agent.channelIds are reflected in real time without restarting the channel.
   */
  private _resolveDefaultAgentId(channelId: number): number {
    const row = clawDb.findChannelById(channelId)
    if (!row) {
      logger.warn(`Channel ${channelId} not found when resolving default agent`)
      return 0
    }
    // SaaS 模式：只在该 Channel 所属用户的 agent 范围内路由
    const agents = agentManager.getAllByUser(row.user_id)
    // Prefer a agent explicitly bound to this channel
    const bound = agents.find(
      (m) => m.active && m.channelIds?.includes(channelId)
    )
    if (bound) return bound.id

    // If this channel is global, route to the first active agent without explicit channelIds
    if (row?.is_global === 1) {
      const global = agents.find(
        (m) => m.active && (!m.channelIds || m.channelIds.length === 0)
      )
      if (global) return global.id
    }

    // Fallback: any active agent belonging to the same user
    const any = agents.find((m) => m.active)
    if (any) return any.id

    logger.warn(
      `No active agent found for channel routing (channelId=${channelId}, userId=${row.user_id}). ` +
        'Incoming messages will be emitted with agentId=0 until a agent is available.'
    )
    return 0
  }

  /**
   * 将 message:outgoing 事件路由到正确的渠道适配器。
   *
   * cron/webhook 主动推送（chatId=0, 无 channelId）时，遍历所有适配器：
   *   - agent 明确绑定了该渠道 → 发送
   *   - agent 无特定渠道且该渠道是全局渠道 → 兜底发送
   * 正常渠道消息（有 channelId）时，直接找到对应适配器发送。
   */
  private _dispatchOutgoing(evt: OutgoingMessageEvent): void {
    if (evt.source === 'web') return

    const isCronOrWebhook = evt.channelId === undefined && evt.chatId === 0
    if (isCronOrWebhook) {
      const agentObj = agentManager.get(evt.agentId)
      if (!agentObj) return
      const hasSpecificChannels = (agentObj.channelIds?.length ?? 0) > 0
      for (const adapter of this.adapters.values()) {
        const chatId = adapter.primaryChatId
        if (!chatId) continue
        const isBound = agentObj.channelIds?.includes(adapter.channelId)
        if (!isBound && (!adapter.isGlobal || hasSpecificChannels)) continue
        adapter.deliverOutgoing(chatId, evt).catch((err) => {
          logger.error(
            { err },
            `[channel:${adapter.channelId}] Failed to deliver outgoing message`
          )
        })
      }
    } else if (evt.channelId !== undefined) {
      const adapter = this.adapters.get(evt.channelId)
      if (!adapter) return
      adapter.deliverOutgoing(evt.chatId, evt).catch((err) => {
        logger.error(
          { err },
          `[channel:${adapter.channelId}] Failed to deliver outgoing message`
        )
      })
    }
  }

  /**
   * 向所有已配置 primaryChatId 的渠道广播通知消息。
   * 用于系统级通知（登录、告警等），与 Agent 无关。
   */
  async broadcastNotification(text: string): Promise<void> {
    const targets = [...this.adapters.values()].filter(
      (a) => a.primaryChatId !== undefined
    )
    await Promise.allSettled(
      targets.map((a) => a.sendMessage(a.primaryChatId!, text))
    )
  }

  /**
   * 通过 Webhook Token 以 Agent 的身份发送消息。
   * 消息通过事件总线（message:outgoing）分发，与 cron 等内部消息走相同的事件驱动路径。
   */
  async sendByWebhookToken(
    token: string,
    text: string
  ): Promise<{ sent: number }> {
    const agent = agentManager
      .listAll()
      .find((m) => m.webhookEnable && m.webhookToken === token)
    if (!agent) {
      throw Object.assign(new Error('Invalid webhook token'), {
        code: 'INVALID_TOKEN',
      })
    }

    logger.info(
      `[webhook] agent="${agent.id}" title="${agent.title}" emitting message:outgoing`
    )

    // DB 持久化由 agentLog.ts 通过 message:outgoing 事件驱动
    // 通过事件总线分发，channel adapter 按 agent 绑定关系路由到对应渠道
    const webhookAgentContext: AgentContext = {
      logger: getAgentLogger(agent.roleName, agent.id, '0'),
      tenantId: agent.tenantId,
      userId: agent.userId,
      agentId: agent.id,
      sessionId: 0,
    }
    clawEventBus.emit('message:outgoing', {
      agentId: agent.id,
      chatId: 0,
      content: clawMessage.text(text),
      userId: agent.userId,
      source: 'webhook',
      agentContext: webhookAgentContext,
    })

    return { sent: 1 }
  }
}

/** Singleton channel manager — import this everywhere */
export const channelManager = new ChannelManager()
