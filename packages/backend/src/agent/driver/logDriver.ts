/**
 * Log driver abstract class
 * Responsible for recording and persisting task execution logs
 */
import pino from 'pino'
import type { AgentExecutor } from '../agentExecutor.js'
import { createAgentLogger } from '../logger.js'

export abstract class AbstractLogDriver {
  protected executor: AgentExecutor
  protected logger: pino.Logger

  constructor(executor: AgentExecutor) {
    this.executor = executor
    this.logger = createAgentLogger(this.executor, 'log')
  }

  /**
   * Record a log entry: write to pino and call subclass persistence
   */
  async log(
    title: string,
    content: unknown,
    level: 'debug' | 'info' | 'warn' | 'error' = 'info'
  ): Promise<void> {
    this.logger[level](
      {
        taskId: this.executor.taskId.toString(),
        userId: this.executor.userId.toString(),
        content,
      },
      title
    )
    await this.persist(title, content, level)
  }

  /**
   * Persist log entry (implemented by subclasses, e.g., writing to database)
   */
  protected abstract persist(
    title: string,
    content: unknown,
    level: 'debug' | 'info' | 'warn' | 'error'
  ): Promise<void>

  /**
   * Record an error log entry
   * Extracts Error object fields before calling log()
   */
  async logError(
    title: string,
    content: { error?: Error | any; [key: string]: any }
  ): Promise<void> {
    const error =
      content.error instanceof Error
        ? content.error
        : new Error(content.error || 'UnknownError')
    const rest = { ...content }
    delete rest.error
    const errorData = {
      ...rest,
      message: error.message,
      stack: error.stack,
      name: error.name,
    }
    await this.log(title, errorData, 'error')
  }

  /**
   * Record an info-level log entry
   */
  async logInfo(title: string, content: unknown): Promise<void> {
    await this.log(title, content, 'info')
  }
}
