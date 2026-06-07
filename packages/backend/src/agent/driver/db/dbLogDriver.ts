/**
 * Log DB driver
 * Implements ILogDriver based on Prisma + pino
 * Responsible for recording all execution logs to the database and log files
 */
import { agentTaskDb } from '../../../storage/store/agentTask.js'
import { logger } from '../../../utils/logger.js'
import type { AgentExecutor } from '../../agentExecutor.js'
import { AbstractLogDriver } from '../logDriver.js'

export class DbLogDriver extends AbstractLogDriver {
  constructor(executor: AgentExecutor) {
    super(executor)
  }

  protected async persist(
    title: string,
    content: unknown,
    _level: 'debug' | 'info' | 'warn' | 'error'
  ): Promise<void> {
    try {
      const contentStr =
        typeof content === 'string' ? content : JSON.stringify(content)
      await agentTaskDb.createAgentTaskLog({
        tenantId: this.executor.tenantId,
        userId: this.executor.userId,
        agentTaskId: this.executor.taskId,
        title,
        content: contentStr,
      })
    } catch (error) {
      logger.error(
        { taskId: this.executor.taskId, title, error },
        'log_driver_error'
      )
    }
  }
}
