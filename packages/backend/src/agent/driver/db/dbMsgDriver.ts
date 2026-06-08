/**
 * Msg DB driver
 * Responsible only for message storage, updating and reading (based on Prisma)
 * All business logic is handled uniformly by AbstractMsgDriver
 */
import { agentTaskDb } from '../../../storage/store/agentTask.js'
import { logger } from '../../../utils/logger.js'
import type { AgentExecutor } from '../../agentExecutor.js'
import type { MessageItem } from '../../types.js'
import { AbstractMsgDriver } from '../msgDriver.js'
import { safeJsonParse } from '../../../utils/json.js'

export class DbMsgDriver extends AbstractMsgDriver {
  constructor(executor: AgentExecutor) {
    super(executor)
  }

  /**
   * Create a message record
   */
  protected async saveMsg(
    role: string,
    messageData: Partial<MessageItem>
  ): Promise<{ id: number }> {
    const saved = await agentTaskDb.createAgentTaskMsg({
      tenantId: this.executor.tenantId,
      userId: this.executor.userId,
      agentTaskId: this.executor.taskId,
      role,
      content: JSON.stringify(messageData),
    })
    logger.debug(
      {
        taskId: this.executor.taskId.toString(),
        msgId: saved.id.toString(),
        data: messageData,
      },
      'msg_create'
    )
    return saved
  }

  /**
   * Update message content by ID
   */
  protected async updateMsg(
    id: number,
    data: Partial<MessageItem>
  ): Promise<void> {
    await agentTaskDb.updateAgentTaskMsg(id, JSON.stringify(data))
  }

  /**
   * Find message content by ID, returns null if not found
   */
  protected async findMsg(id: number): Promise<Partial<MessageItem> | null> {
    const record = await agentTaskDb.findAgentTaskMsgById(id)
    if (!record) return null
    return safeJsonParse(
      record.content,
      {} as Partial<MessageItem>,
      'dbMsg.findMsg'
    ) as Partial<MessageItem>
  }

  /**
   * Save a user-initiated message (persistence only, no push)
   */
  async saveUserMsg(data: {
    text?: string
    images?: string[]
    files?: string[]
    meta?: Record<string, any>
  }): Promise<void> {
    await agentTaskDb.createAgentTaskMsg({
      tenantId: this.executor.tenantId,
      userId: this.executor.userId,
      agentTaskId: this.executor.taskId,
      role: 'user',
      content: JSON.stringify({
        role: 'user',
        content: data.text,
        images: data.images,
        files: data.files,
        meta: data.meta,
        timestamp: Date.now().toString(),
      }),
    })
  }

  /**
   * Delete a message record by ID
   */
  protected async deleteMsg(id: number): Promise<void> {
    await agentTaskDb.deleteAgentTaskMsg(id)
    logger.debug(
      {
        taskId: this.executor.taskId.toString(),
        msgId: id.toString(),
      },
      'msg_delete'
    )
  }

  /**
   * Query task message history
   * @param maxId Pagination cursor (lt), <= 0 means no limit
   */
  async queryHistory(maxId: number = -1): Promise<Array<Record<string, any>>> {
    const records = await agentTaskDb.findAgentTaskMsgs(
      this.executor.taskId,
      maxId > 0 ? { maxId: Number(maxId), limit: 100 } : { limit: 100 }
    )
    return records.map((m) => {
      const msg = safeJsonParse(m.content, {}, 'dbMsgMsg.queryHistory')
      return { ...msg, id: m.id.toString() }
    })
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await super.cleanup()
    logger.debug(
      { taskId: this.executor.taskId.toString() },
      'msg_driver_cleaned_up'
    )
  }
}
