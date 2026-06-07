import type { OutgoingMessageEvent } from '../kernel/eventBus.js'

/**
 * Base interface for channel adapters.
 * Each channel type (Telegram, Feishu...) implements this interface.
 *
 * Lifecycle:
 *   start()         → connect to the external service, register handlers
 *   stop()          → disconnect gracefully, clean up listeners
 *   sendMessage     → proactively push a message to a target (chatId / userId)
 *   deliverOutgoing → format and send a routed outgoing message to a specific chatId
 */

/** Runtime status reported by a channel adapter */
export interface ChannelAdapterStatus {
  channelId: number
  channelTitle: string
  channelType: string
  connected: boolean
  errorCount: number
  lastActivity?: Date
}

/** Common interface every channel adapter must implement */
export interface BaseChannelAdapter {
  readonly channelId: number
  readonly channelTitle: string
  readonly channelType: string

  /** Whether this channel is configured as the global/default fallback channel */
  readonly isGlobal: boolean

  /** The primary chat target for proactive messages (e.g. allowedChatId in Telegram). Undefined if not yet configured. */
  readonly primaryChatId?: number

  /** Connect to the external service and begin receiving messages */
  start(): Promise<void>

  /** Disconnect gracefully and release all resources */
  stop(): Promise<void>

  /** Send a proactive message to a specific chat / recipient */
  sendMessage(target: string | number, text: string): Promise<void>

  /**
   * Format and deliver a routed outgoing message to a specific chatId.
   * Called by ChannelManager after it has resolved which channel(s) should receive the event.
   */
  deliverOutgoing(chatId: number, evt: OutgoingMessageEvent): Promise<void>

  /** Returns a snapshot of current adapter runtime status */
  getStatus(): ChannelAdapterStatus
}
