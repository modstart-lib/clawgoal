/**
 * Generic tool listener interface
 * Used to listen to various events during Agent execution (file changes, state changes, etc.)
 */
import { AgentExecutor } from './agentExecutor.js'

/**
 * Base listener interface
 * All custom listeners should implement this interface
 */
export interface BaseListener {
  /**
   * Initialize the listener
   * @param executor Agent executor instance
   */
  initialize(executor: AgentExecutor): void

  /**
   * Clean up listener resources
   */
  cleanup?(): void
}

/**
 * Listener manager
 * Responsible for registering and managing all listeners
 */
export class ListenerManager {
  private listeners: BaseListener[] = []
  private executor: AgentExecutor

  constructor(executor: AgentExecutor) {
    this.executor = executor
  }

  /**
   * Register a listener
   */
  register(listener: BaseListener): void {
    this.listeners.push(listener)
    listener.initialize(this.executor)
  }

  /**
   * Register multiple listeners in batch
   */
  registerAll(listeners: BaseListener[]): void {
    listeners.forEach((listener) => this.register(listener))
  }

  /**
   * Clean up all listeners
   */
  async cleanup(): Promise<void> {
    for (const listener of this.listeners) {
      if (listener.cleanup) {
        await listener.cleanup()
      }
    }
    this.listeners = []
  }
}

/**
 * Checkpoint listener base class
 * Extend this class and implement beforeSave/afterLoad to intercept checkpoint save/load for large fields
 */
export abstract class AbstractCheckpointListener implements BaseListener {
  protected executor!: AgentExecutor

  initialize(executor: AgentExecutor): void {
    this.executor = executor
    executor.checkpoint.registerHandler(this)
  }

  /**
   * Called before checkpoint save; can offload large fields to files
   * @param state Original state
   * @returns Processed state (to be stored in checkpoint)
   */
  onBeforeSave?(state: any): Promise<any>

  /**
   * Called after checkpoint load; can restore fields offloaded to files
   * @param state State read from checkpoint
   * @returns Restored state
   */
  onAfterLoad?(state: any): Promise<any>
}

/**
 * File listener base class
 * Provides basic file change listening functionality
 */
export abstract class AbstractFileListener implements BaseListener {
  protected executor!: AgentExecutor

  initialize(executor: AgentExecutor): void {
    this.executor = executor
    this.executor.file.on('write', this.onWrite.bind(this))
  }

  /**
   * Handle file write events
   * Subclasses can override this method to handle specific files
   */
  protected async onWrite(_filename: string, _content: string): Promise<void> {}

  cleanup(): void {
    this.executor.file.removeListener('write', this.onWrite.bind(this))
  }
}
