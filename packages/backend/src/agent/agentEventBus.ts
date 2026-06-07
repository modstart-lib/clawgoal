/**
 * EventBus
 * Global singleton managing event dispatch for all agent tasks
 */
import { logger } from '../utils/logger.js'
import type {
  EventItem,
  EventItemType,
  EventListener,
  EventSubscription,
} from './types.js'

/**
 * EventBus class
 */
export class EventBus {
  private static instance: EventBus | null = null
  private subscriptions: EventSubscription[] = []
  private eventHistory: EventItem[] = []
  private readonly MAX_HISTORY = 1000
  private queue: Array<{ event: EventItem; resolve: () => void }> = []
  private processing = false

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }

  /**
   * Publish an event — enqueues it and waits for all listeners to finish
   */
  async emit(event: EventItem): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push({ event, resolve })
      void this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true
    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      await this.processEvent(item.event)
      item.resolve()
    }
    this.processing = false
  }

  private async processEvent(event: EventItem): Promise<void> {
    try {
      this.addToHistory(event)
      logger.debug(
        {
          eventId: event.id,
          taskId: event.taskId.toString(),
          event: event.event,
          data: event.data,
        },
        `[Event]-${event.event}`
      )
      for (const subscription of this.subscriptions) {
        if (subscription.eventTypes.includes(event.event)) {
          try {
            await subscription.listener(event)
          } catch (error: any) {
            logger.error(
              {
                eventId: event.id,
                event: event.event,
                error: error.message,
              },
              'event_listener_error'
            )
          }
        }
      }
    } catch (error: any) {
      logger.error(
        {
          event: event.event,
          error: error.message,
        },
        'emit_event_error'
      )
    }
  }

  /**
   * Subscribe to events
   * @param eventTypes Array of event types
   * @param listener Listener function
   * @returns Unsubscribe function
   */
  on(eventTypes: EventItemType[], listener: EventListener): () => void {
    const subscription: EventSubscription = {
      eventTypes,
      listener,
    }

    this.subscriptions.push(subscription)

    return () => this.off(listener)
  }

  /**
   * Subscribe once to an event
   */
  once(eventTypes: EventItemType[], listener: EventListener): void {
    const wrappedListener: EventListener = (event: EventItem) => {
      listener(event)
      this.off(wrappedListener)
    }
    this.on(eventTypes, wrappedListener)
  }

  /**
   * Unsubscribe
   */
  off(listener: EventListener): void {
    this.subscriptions = this.subscriptions.filter(
      (sub) => sub.listener !== listener
    )
  }

  /**
   * Get event history for a task
   */
  getEventHistory(taskId: number, limit: number = 100): EventItem[] {
    return this.eventHistory
      .filter((event) => event.taskId === taskId)
      .slice(-limit)
  }

  /**
   * Get all event history
   */
  getAllEventHistory(limit: number = 100): EventItem[] {
    return this.eventHistory.slice(-limit)
  }

  /**
   * Clear event history for a task (call after task completion)
   */
  clearTaskHistory(taskId: number): void {
    this.eventHistory = this.eventHistory.filter(
      (event) => event.taskId !== taskId
    )
  }

  /**
   * Add to history
   */
  private addToHistory(event: EventItem): void {
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory = this.eventHistory.slice(-this.MAX_HISTORY)
    }
  }

  /**
   * Get subscription statistics
   */
  getStats(): { subscriptions: number; historySize: number } {
    return {
      subscriptions: this.subscriptions.length,
      historySize: this.eventHistory.length,
    }
  }

  /**
   * Clear all subscriptions (for testing only)
   */
  clearAll(): void {
    this.subscriptions = []
    this.eventHistory = []
  }
}

export const agentEventBus = EventBus.getInstance()
