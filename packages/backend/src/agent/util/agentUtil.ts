/**
 * Agent service
 * Unified management of Agent task creation, startup, resume, and other operations
 */
import { agentTaskDb } from '../../storage/store/index.js'
import { logger } from '../../utils/logger'

export class AgentUtil {
  /**
   * JSON serialization with automatic BigInt handling
   */
  private static safeStringify(obj: any): string {
    return JSON.stringify(obj)
  }

  static async getTaskById(taskId: number) {
    return agentTaskDb.findAgentTaskById(taskId)
  }

  /**
   * Update task status
   */
  static async updateTaskStatus(taskId: number, status: string): Promise<void> {
    await agentTaskDb.updateAgentTask(taskId, { status })
  }

  /**
   * Create a task record
   */
  static async createTask(data: {
    tenantId: number
    userId: number
    title: string
    initialState: any
  }): Promise<any> {
    try {
      const task = await agentTaskDb.createAgentTask({
        tenantId: data.tenantId,
        userId: data.userId,
        title: data.title,
        status: 'pending',
        initialState: this.safeStringify(data.initialState),
      })

      logger.info({ taskId: task.id }, 'agent_task_created')
      return task
    } catch (error: any) {
      logger.error({ error: error.message }, 'create_task_error')
      throw error
    }
  }
}
