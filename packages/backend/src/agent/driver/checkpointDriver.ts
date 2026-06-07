/**
 * Checkpoint driver abstract class
 * Responsible for persisting and restoring LangGraph state
 */
import pino from 'pino'
import type { AgentExecutor } from '../agentExecutor.js'
import type { AbstractCheckpointListener } from '../listener.js'
import { createAgentLogger } from '../logger.js'

export abstract class AbstractCheckpointDriver {
  protected executor: AgentExecutor
  protected logger: pino.Logger
  protected handlers: AbstractCheckpointListener[] = []

  constructor(executor: AgentExecutor) {
    this.executor = executor
    this.logger = createAgentLogger(this.executor, 'checkpoint')
  }

  /**
   * Register a checkpoint listener (for large field offloading/restoring)
   */
  registerHandler(handler: AbstractCheckpointListener): void {
    this.handlers.push(handler)
  }

  /**
   * Execute all beforeSave hooks in order, allowing large fields to be offloaded to files
   */
  protected async applyBeforeSave(state: any): Promise<any> {
    for (const handler of this.handlers) {
      if (handler.onBeforeSave) {
        state = await handler.onBeforeSave(state)
      }
    }
    return state
  }

  /**
   * Execute all afterLoad hooks in order, restoring offloaded large fields
   */
  protected async applyAfterLoad(state: any): Promise<any> {
    for (const handler of this.handlers) {
      if (handler.onAfterLoad) {
        state = await handler.onAfterLoad(state)
      }
    }
    return state
  }

  /**
   * Save checkpoint
   * Handles common logic: beforeSave hooks, serialization, logging; actual persistence is delegated to persist()
   */
  async save(checkpoint: any): Promise<void> {
    try {
      const state = await this.applyBeforeSave(checkpoint.state)
      const checkpointStr = JSON.stringify({ ...checkpoint, state })
      await this.persist(checkpointStr)
      await this.executor.log.logInfo('[CheckpointSaved]', {
        checkpoint: Object.keys(checkpoint),
      })
    } catch (error) {
      await this.executor.log.logError('[CheckpointSavedError]', { error })
      throw error
    }
  }

  /**
   * Actually persist the checkpoint string (implemented by subclasses, e.g., writing to DB / file)
   */
  protected abstract persist(checkpointStr: string): Promise<void>

  /**
   * Load the latest checkpoint; if it does not exist, return initialState
   * Data is pre-loaded by executor into this.executor.task, no direct DB access required
   */
  async load(): Promise<{ state: any; timestamp: number }> {
    try {
      const task = this.executor.task
      if (task.checkpoint && task.checkpoint.trim() !== '') {
        const checkpoint = JSON.parse(task.checkpoint)
        await this.executor.log.logInfo('[CheckpointLoad]-FromCheckpoint', {
          checkpoint: Object.keys(checkpoint),
        })
        const state = await this.applyAfterLoad(checkpoint.state)
        return { ...checkpoint, state }
      }
      const initialState = JSON.parse(task.initialState)
      await this.executor.log.logInfo('[CheckpointLoad]-FromInitialState', {
        initialState: Object.keys(initialState),
      })
      return {
        state: initialState,
        timestamp: Date.now(),
      }
    } catch (error) {
      await this.executor.log.logError('[CheckpointError]', { error })
      throw error
    }
  }
}
