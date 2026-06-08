import { agentManager } from '../agent/index.js'
import {
  clawEventBus,
  type IncomingMessageEvent,
  type MaxRoundsReachedEvent,
  type OutgoingMessageEvent,
  type ToolEndEvent,
  type ToolStartEvent,
  type TypingEvent,
} from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import { toolRegistry } from '../tools/index.js'
import type { Agent } from '../types/index.js'
import type { BaseChannelAdapter, ChannelAdapterStatus } from './base.js'

const logger = createLogger('channel')

/**
 * ChannelAdapterBase — abstract base class for all channel adapters.
 *
 * Handles all platform-agnostic logic so concrete adapters (Telegram, Feishu, …)
 * only need to implement message sending and platform-specific formatting.
 *
 * Subclass responsibilities:
 *   - Implement `_sendText(chatId, text)` and `_sendTyping(chatId)` for the platform.
 *   - Implement `_build*Text()` to format messages for the platform (HTML, Markdown, etc.).
 *   - Implement `_notify*()` for platform-specific rich notifications (buttons, cards, etc.).
 *   - Call `_setupEventBus()` in `start()` and `_teardownEventBus()` in `stop()`.
 */
export abstract class ChannelAdapterBase implements BaseChannelAdapter {
  readonly channelId: number
  readonly channelTitle: string
  abstract readonly channelType: string
  readonly isGlobal: boolean

  protected userId: number
  protected fallbackAgentId: number
  protected allowedChatId?: number
  protected ownerUserId?: number
  protected running = false
  protected errorCount = 0
  protected lastActivity?: Date
  protected activeChatIds = new Set<number>()
  protected busyAgentIds = new Set<number>()
  // ── Pin system ────────────────────────────────────────────────────────────
  protected pinnedAgentId?: number
  protected pinnedUntil?: Date
  private _pinTimer?: ReturnType<typeof setTimeout>
  private _pinChatId?: number
  private _pinSupervisorTitle?: string

  // Pending tool-start messages keyed by "agentId:toolName" for merge buffering
  private _pendingToolStarts = new Map<
    string,
    {
      timer: ReturnType<typeof setTimeout>
      chatId: number
      startText: string
    }
  >()

  // Bound event handlers retained for clean removal in _teardownEventBus()
  private _boundOnTyping!: (evt: TypingEvent) => void
  private _boundOnIncoming!: (evt: IncomingMessageEvent) => void
  private _boundOnToolStart!: (evt: ToolStartEvent) => void
  private _boundOnToolEnd!: (evt: ToolEndEvent) => void
  private _boundOnMaxRoundsReached!: (evt: MaxRoundsReachedEvent) => void

  constructor(
    channelId: number,
    channelTitle: string,
    isGlobal: boolean,
    userId: number,
    fallbackAgentId: number
  ) {
    this.channelId = channelId
    this.channelTitle = channelTitle
    this.isGlobal = isGlobal
    this.userId = userId
    this.fallbackAgentId = fallbackAgentId
  }

  abstract get primaryChatId(): number | undefined
  abstract start(): Promise<void>
  abstract stop(): Promise<void>

  // ── Platform-specific: send primitives ───────────────────────────────────

  /** Send pre-formatted platform text (HTML/Markdown/plain) to a chat. */
  protected abstract _sendText(chatId: number, text: string): Promise<void>

  /** Send a typing indicator to a chat. */
  protected abstract _sendTyping(chatId: number): Promise<void>

  /**
   * Deliver a formatted outgoing reply.
   * Override to add platform controls (inline keyboards, cards, etc.).
   * Default: delegates to _sendText.
   */
  protected async _deliverReply(
    chatId: number,
    text: string,
    _agentObj?: Agent
  ): Promise<void> {
    await this._sendText(chatId, text)
  }

  // ── Platform-specific: message building ──────────────────────────────────

  /** Build the text for an outgoing reply (with optional agent header). */
  protected abstract _buildOutgoingText(
    rawText: string,
    agentObj: Agent | undefined,
    showHeader: boolean
  ): string

  /** Build the text shown when a tool execution starts (before result is known). */
  protected abstract _buildToolStartText(
    toolName: string,
    params: Record<string, unknown>
  ): string

  /** Build the merged start+end text when a tool finishes within the buffer window. */
  protected abstract _buildToolMergedText(
    startText: string,
    toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string

  /** Build the standalone end text when a tool result arrives after the start was already sent. */
  protected abstract _buildToolEndText(
    toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string

  // ── Platform-specific: notifications ─────────────────────────────────────

  /** Notify the user that the max tool rounds limit was reached (may include continue button). */
  protected abstract _notifyMaxRoundsReached(
    chatId: number,
    agentId: number,
    originalChatId?: number
  ): Promise<void>

  /** Notify the user that the pinned agent was changed (may include tool action keyboard). */
  protected abstract _notifyPinChanged(
    chatId: number,
    agent: Agent | undefined,
    resolvedTools: string[]
  ): Promise<void>

  /** Notify the user that the agent pin has expired and routing reverted to default. */
  protected abstract _notifyPinExpired(
    chatId: number,
    agentTitle: string,
    supervisorTitle: string
  ): Promise<void>

  // ── BaseChannelAdapter implementation ────────────────────────────────────

  async sendMessage(target: string | number, text: string): Promise<void> {
    const chatId = typeof target === 'string' ? parseInt(target, 10) : target
    await this._sendText(chatId, text)
  }

  async deliverOutgoing(
    chatId: number,
    evt: OutgoingMessageEvent
  ): Promise<void> {
    this.busyAgentIds.delete(evt.agentId)
    const rawText = evt.content.text ?? ''
    logger.debug(
      `[channel:${this.channelId}] [outgoing] agent=${evt.agentId} chat=${chatId} len=${rawText.length} text=${rawText.slice(0, 300)}`
    )
    const agentObj = agentManager.get(evt.agentId)
    const boundCount = agentManager
      .getAllByUser(this.userId)
      .filter((m) => m.channelIds?.includes(this.channelId)).length
    const showHeader = this.isGlobal || boundCount > 1
    const formatted = this._buildOutgoingText(rawText, agentObj, showHeader)
    await this._deliverReply(chatId, formatted, agentObj).catch((err) => {
      this.errorCount++
      logger.error(
        { err },
        `[channel:${this.channelId}] Failed to deliver outgoing message`
      )
    })
  }

  getStatus(): ChannelAdapterStatus {
    return {
      channelId: this.channelId,
      channelTitle: this.channelTitle,
      channelType: this.channelType,
      connected: this.running,
      errorCount: this.errorCount,
      lastActivity: this.lastActivity,
    }
  }

  // ── Agent resolution ──────────────────────────────────────────────────────

  protected _resolveAgentId(): number {
    const agents = agentManager.getAllByUser(this.userId)
    const bound = agents.find(
      (m) => m.active && m.channelIds?.includes(this.channelId)
    )
    if (bound) return bound.id
    if (this.isGlobal) {
      const global = agents.find(
        (m) => m.active && (!m.channelIds || m.channelIds.length === 0)
      )
      if (global) return global.id
    }
    return this.fallbackAgentId
  }

  protected _getEffectiveAgentId(): number {
    if (
      this.pinnedAgentId &&
      this.pinnedUntil &&
      this.pinnedUntil > new Date()
    ) {
      return this.pinnedAgentId
    }
    return this._resolveAgentId()
  }

  // ── Pin management ────────────────────────────────────────────────────────

  protected async _pinAgent(agentId: number, chatId: number): Promise<void> {
    const agent = agentManager.get(agentId)
    const defaultAgent = agentManager.get(this._resolveAgentId())
    this.pinnedAgentId = agentId
    this._pinChatId = chatId
    this._pinSupervisorTitle = defaultAgent?.title ?? 'Supervisor'
    logger.info(
      `[channel:${this.channelId}] Pinned agent "${agent?.title ?? agentId}" for chat ${chatId}`
    )
    const rawTools: string[] = agent?.config?.capabilities?.tools ?? []
    const resolvedTools = rawTools.filter((t) => t !== '*')
    await this._notifyPinChanged(chatId, agent, resolvedTools)
    this._extendPin()
  }

  protected _extendPin(): void {
    if (!this.pinnedAgentId || !this._pinChatId) return
    if (this._pinTimer) {
      clearTimeout(this._pinTimer)
      this._pinTimer = undefined
    }

    const PIN_DURATION_MS = 60 * 10 * 1000
    const agentId = this.pinnedAgentId
    const chatId = this._pinChatId
    const title = agentManager.get(agentId)?.title ?? String(agentId)
    const supervisorTitle = this._pinSupervisorTitle ?? 'Supervisor'
    this.pinnedUntil = new Date(Date.now() + PIN_DURATION_MS)
    logger.info(
      `[channel:${this.channelId}] Pin extended for agent "${title}" until ${this.pinnedUntil.toLocaleString()}`
    )

    this._pinTimer = setTimeout(async () => {
      this.pinnedAgentId = undefined
      this.pinnedUntil = undefined
      this._pinChatId = undefined
      this._pinSupervisorTitle = undefined
      this._pinTimer = undefined
      logger.info(
        `[channel:${this.channelId}] Pin expired for agent "${title}", reverting to ${supervisorTitle}`
      )
      await this._notifyPinExpired(chatId, title, supervisorTitle).catch(
        () => {}
      )
    }, PIN_DURATION_MS)
  }

  // ── Event bus lifecycle ───────────────────────────────────────────────────

  /**
   * Subscribe to all relevant event bus events.
   * Call this inside `start()` after the platform connection is ready.
   */
  protected _setupEventBus(): void {
    this._boundOnTyping = (evt: TypingEvent) => {
      if (evt.channelId !== this.channelId) return
      this._sendTyping(evt.chatId).catch(() => {})
    }

    this._boundOnIncoming = (evt: IncomingMessageEvent) => {
      this.busyAgentIds.add(evt.agentId)
    }

    this._boundOnToolStart = (evt: ToolStartEvent) => {
      if (evt.channelId !== this.channelId) return
      const startText = this._buildToolStartText(evt.toolName, evt.params ?? {})
      const key = `${evt.agentId}:${evt.toolName}`
      const timer = setTimeout(() => {
        this._pendingToolStarts.delete(key)
        this._sendText(evt.chatId, startText).catch(() => {})
      }, 5000)
      this._pendingToolStarts.set(key, {
        timer,
        chatId: evt.chatId,
        startText,
      })
    }

    this._boundOnToolEnd = (evt: ToolEndEvent) => {
      if (evt.channelId !== this.channelId) return
      const key = `${evt.agentId}:${evt.toolName}`
      const pending = this._pendingToolStarts.get(key)
      if (pending) {
        clearTimeout(pending.timer)
        this._pendingToolStarts.delete(key)
        const merged = this._buildToolMergedText(
          pending.startText,
          evt.toolName,
          evt.success,
          evt.durationMs,
          evt.result
        )
        this._sendText(evt.chatId, merged).catch(() => {})
      } else {
        const endText = this._buildToolEndText(
          evt.toolName,
          evt.success,
          evt.durationMs,
          evt.result
        )
        this._sendText(evt.chatId, endText).catch(() => {})
      }
    }

    this._boundOnMaxRoundsReached = (evt: MaxRoundsReachedEvent) => {
      if (evt.channelId !== undefined && evt.channelId !== this.channelId)
        return
      const targetChatId = evt.chatId || this.allowedChatId
      if (!targetChatId) return
      if (
        evt.chatId &&
        !this.activeChatIds.has(evt.chatId) &&
        evt.chatId !== this.allowedChatId
      )
        return
      this._notifyMaxRoundsReached(targetChatId, evt.agentId, evt.chatId).catch(
        () => {}
      )
    }

    clawEventBus.on('message:typing', this._boundOnTyping)
    clawEventBus.on('message:incoming', this._boundOnIncoming)
    clawEventBus.on('tool:start', this._boundOnToolStart)
    clawEventBus.on('tool:end', this._boundOnToolEnd)
    clawEventBus.on('agent:maxRoundsReached', this._boundOnMaxRoundsReached)
  }

  /**
   * Unsubscribe from all event bus events and clean up pending state.
   * Call this inside `stop()` before returning.
   */
  protected _teardownEventBus(): void {
    clawEventBus.off('message:typing', this._boundOnTyping)
    clawEventBus.off('message:incoming', this._boundOnIncoming)
    clawEventBus.off('tool:start', this._boundOnToolStart)
    clawEventBus.off('tool:end', this._boundOnToolEnd)
    clawEventBus.off('agent:maxRoundsReached', this._boundOnMaxRoundsReached)

    for (const { timer } of this._pendingToolStarts.values())
      clearTimeout(timer)
    this._pendingToolStarts.clear()

    if (this._pinTimer) {
      clearTimeout(this._pinTimer)
      this._pinTimer = undefined
    }
    this.pinnedAgentId = undefined
    this.pinnedUntil = undefined
    this._pinChatId = undefined
    this._pinSupervisorTitle = undefined
    this.activeChatIds.clear()
    this.busyAgentIds.clear()
  }
}
