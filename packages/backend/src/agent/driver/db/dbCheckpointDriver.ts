/**
 * Checkpoint DB driver
 * Implements AbstractCheckpointDriver based on Prisma, responsible only for writing serialized checkpoints to the database
 */
import { agentTaskDb } from '../../../storage/store/agentTask.js'
import type { AgentExecutor } from '../../agentExecutor.js'
import { AbstractCheckpointDriver } from '../checkpointDriver.js'

export class DbCheckpointDriver extends AbstractCheckpointDriver {
  constructor(executor: AgentExecutor) {
    super(executor)
  }

  /**
   * Write the serialized checkpoint string to the database
   */
  protected async persist(checkpointStr: string): Promise<void> {
    await agentTaskDb.updateAgentTask(this.executor.taskId, {
      checkpoint: checkpointStr,
    })
  }
}
