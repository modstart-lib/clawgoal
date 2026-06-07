/**
 * Agent task executor
 * Responsible for executing LangGraph workflows and managing the task lifecycle
 */
import path from 'path'
import type pino from 'pino'
import { config } from '../config'
import { logger } from '../utils/logger.js'
import { generateId } from '../utils/utils.js'
import { agentEventBus } from './agentEventBus'
import type { AbstractCheckpointDriver } from './driver/checkpointDriver.js'
import { DbCheckpointDriver } from './driver/db/dbCheckpointDriver.js'
import { DbFileDriver } from './driver/db/dbFileDriver.js'
import { DbLogDriver } from './driver/db/dbLogDriver.js'
import { DbMsgDriver } from './driver/db/dbMsgDriver.js'
import type { AbstractFileDriver } from './driver/fileDriver.js'
import type { AbstractLogDriver } from './driver/logDriver.js'
import type { AbstractMsgDriver } from './driver/msgDriver.js'
import { BaseListener, ListenerManager } from './listener.js'
import { createAgentLogger } from './logger.js'
import { NodeContext } from './nodes'
import { EventItemType } from './types.js'
import { AgentUtil } from './util/agentUtil.js'

/**
 * GraphBuilder type definition
 * Accepts a context object containing the executor instance
 * Returns a compiled LangGraph graph
 */
export type GraphBuilder = (context: NodeContext) => any

/**
 * BizRunner type definition
 * Function signature for agent runners corresponding to biz types
 */
export type BizRunner = (
  taskId: number,
  param?: { userResponse?: any }
) => Promise<void>

/** Running task Map entry */
interface RunningTaskEntry {
  executor: AgentExecutor
  /** Timestamp (ms) of last activity, used for expiry detection */
  lastActiveAt: number
  /** Whether execute() is currently running; false means only the executor instance is cached */
  isExecuting: boolean
}

export class AgentExecutor {
  /** Running task Map, key is taskId string */
  private static runningTasks = new Map<string, RunningTaskEntry>()

  /** Task expiry time: entries inactive longer than this are removed from the Map (default: 1 minute) */
  private static readonly TASK_EXPIRE_MS = 60 * 1000

  /**
   * Biz-type runner registry
   * key: biz type string, value: corresponding agent runner function
   */
  private static bizRunnerRegistry = new Map<string, BizRunner>()

  /**
   * Register a biz-type runner
   * Register as needed in initAgent() to avoid hard-coding business types in agentExecutor
   */
  static registerBizRunner(biz: string, runner: BizRunner): void {
    this.bizRunnerRegistry.set(biz, runner)
  }

  /**
   * Create standard tool callbacks for invokeModelWithTools
   * Callbacks emit TaskToolsCallStart / TaskToolsCallEnd events to agentEventBus,
   * which msgDriver listens to and persists to the database.
   *
   * @param executor - AgentExecutor instance
   * @param title - Stage title displayed during Model call (default: "AI thinking")
   *
   * @example
   * ```typescript
   * const result = await invokeModelWithTools(executor.userId, {
   *     ...options,
   *     ...AgentExecutor.makeCallbacks(context.executor, 'Article generation'),
   * });
   * ```
   */
  static makeCallbacks(executor: AgentExecutor, title?: string) {
    return {
      onModelToolsStart: (name: string, args: any) => {
        agentEventBus.emit({
          id: generateId(),
          taskId: executor.taskId,
          event: EventItemType.TaskToolsCallStart,
          data: { name, args },
          timestamp: Date.now(),
        })
      },
      onModelToolsEnd: (
        name: string,
        status: 'success' | 'fail',
        result?: string,
        error?: string
      ) => {
        agentEventBus.emit({
          id: generateId(),
          taskId: executor.taskId,
          event: EventItemType.TaskToolsCallEnd,
          data: { name, status, success: result, error },
          timestamp: Date.now(),
        })
      },
      onModelCallStart: (model: string) => {
        agentEventBus.emit({
          id: generateId(),
          taskId: executor.taskId,
          event: EventItemType.TaskModelCallStart,
          data: { model, title },
          timestamp: Date.now(),
        })
      },
      onModelCallEnd: (
        model: string,
        status: 'success' | 'fail',
        duration?: number
      ) => {
        agentEventBus.emit({
          id: generateId(),
          taskId: executor.taskId,
          event: EventItemType.TaskModelCallEnd,
          data: { model, status, duration },
          timestamp: Date.now(),
        })
      },
    } as const
  }

  public task: any
  public taskId: number
  public userId: number
  public tenantId: number
  public runnerKey: string = ''

  public dir: string
  public logDir: string

  public file: AbstractFileDriver
  public log: AbstractLogDriver
  public checkpoint: AbstractCheckpointDriver
  public msg: AbstractMsgDriver
  public logger: pino.Logger
  private listenerManager: ListenerManager

  private _abortRequested = false
  private _abortReason = ''

  constructor(task: any) {
    this.task = task
    this.taskId = this.task.id
    this.userId = this.task.userId
    this.tenantId = this.task.tenantId

    this.dir = path.resolve(config.agentTask.path, this.taskId.toString())
    this.logDir = path.resolve(this.dir, 'logs')
    this.log = new DbLogDriver(this)

    this.file = new DbFileDriver(this)
    this.checkpoint = new DbCheckpointDriver(this)
    this.msg = new DbMsgDriver(this)
    this.logger = createAgentLogger(this, 'executor')
    this.listenerManager = new ListenerManager(this)
    this.msg.initialize()
  }

  /**
   * Check if this task is currently executing
   */
  isRunning(): boolean {
    return AgentExecutor.isTaskRunning(this.taskId)
  }

  /**
   * Signal the running execute loop to abort
   * @param reason The user's message or abort reason
   */
  abortRunning(reason?: string): void {
    this._abortRequested = true
    this._abortReason = reason || 'Task aborted by user'
    this.logger.info(
      { taskId: this.taskId, reason: this._abortReason },
      'AgentExecutor.AbortRequested'
    )
  }

  /**
   * Register multiple listeners in batch
   */
  registerListeners(listeners: BaseListener[]): void {
    this.listenerManager.registerAll(listeners)
  }

  /**
   * Execute a task (supports both initial start and resuming from checkpoint)
   * @param graph LangGraph graph instance
   * @param param Execution parameters, includes user response (used when resuming from checkpoint)
   */
  /**
   * Refresh the active timestamp of the current task in runningTasks
   * Called at the start of execute() so expiry detection is based on the most recent actual execution time
   */
  private refreshActivity(): void {
    const entry = AgentExecutor.runningTasks.get(this.taskId.toString())
    if (entry) {
      entry.lastActiveAt = Date.now()
    }
  }

  async execute(
    graph: any,
    param: {
      userResponse?: {
        text?: string
        images?: string[]
        files?: string[]
        meta?: Record<string, any>
        intent?: {
          action: string
          target?: string

          params?: Record<string, any>
          reason?: string
        }
      }
    }
  ): Promise<void> {
    param = Object.assign(
      {
        userResponse: {},
      },
      param
    )
    try {
      this.refreshActivity()
      await this.updateTaskStatus('running')
      const checkpoint = await this.checkpoint.load()
      const userResponseFields: any = {}
      if (param.userResponse) {
        userResponseFields.userResponse = param.userResponse
      }
      const state = {
        ...checkpoint.state,
        ...userResponseFields,
      }
      this.logger.info(
        { taskId: this.taskId, state },
        '========== AgentExecutor.Execute.Starting =========='
      )
      await this.log.logInfo(
        `========== [Event]-${EventItemType.TaskStart} ==========`,
        { state }
      )
      agentEventBus.emit({
        id: generateId(),
        taskId: this.taskId,
        event: EventItemType.TaskStart,
        data: { state },
        timestamp: Date.now(),
      })
      const config = {
        recursionLimit: 50,
        configurable: {
          thread_id: this.taskId.toString(),
        },
      }
      let accumulatedState: any = state
      for await (const event of await graph.stream(state, config)) {
        const partialUpdate = event[Object.keys(event)[0]]
        accumulatedState = {
          ...accumulatedState,
          ...partialUpdate,
        }
        await this.checkpoint.save({
          state: accumulatedState,
          timestamp: Date.now(),
        })
        if (this._abortRequested) {
          break
        }
      }

      if (this._abortRequested) {
        await this.onTaskCancelled()
        return
      }

      if (accumulatedState && accumulatedState.isPending === true) {
        await this.updateTaskPending(accumulatedState)
        await this.msg.cleanup()
        return
      }

      await this.onTaskComplete()
    } catch (error: any) {
      await this.handleError(error)
    }
  }

  /**
   * Pause task and save state
   */
  private async updateTaskPending(state: any): Promise<void> {
    try {
      await this.updateTaskStatus('ask')
      agentEventBus.emit({
        id: generateId(),
        taskId: this.taskId,
        event: EventItemType.TaskPending,
        data: { state },
        timestamp: Date.now(),
      })
    } catch (error: any) {
      logger.error({ taskId: this.taskId, error }, 'pause_for_user_error')
    }
  }

  /**
   * Task cancelled handler (user-initiated abort)
   */
  private async onTaskCancelled(): Promise<void> {
    try {
      await this.updateTaskStatus('failed')
      await this.log.logInfo('========== Task cancelled by user ==========')
      agentEventBus.emit({
        id: generateId(),
        taskId: this.taskId,
        event: EventItemType.TaskCancelled,
        data: { reason: this._abortReason },
        timestamp: Date.now(),
      })
    } catch (error: any) {
      logger.error({ taskId: this.taskId, error }, 'on_task_cancelled_error')
    } finally {
      await this.msg.cleanup()
      await this.listenerManager.cleanup()
      await this.file.cleanup()
    }
  }

  /**
   * Task completion handler
   */
  private async onTaskComplete(): Promise<void> {
    try {
      await this.updateTaskStatus('success')
      await this.log.log('========== Task completed ==========', {}, 'info')
      agentEventBus.emit({
        id: generateId(),
        taskId: this.taskId,
        event: EventItemType.TaskSuccess,
        data: {},
        timestamp: Date.now(),
      })
      await this.msg.cleanup()
      await this.listenerManager.cleanup()
      await this.file.cleanup()
    } catch (error: any) {
      logger.error({ taskId: this.taskId, error }, 'on_task_complete_error')
    }
  }

  /**
   * Error handler
   */
  private async handleError(error: Error): Promise<void> {
    try {
      await this.updateTaskStatus('failed')
      await this.log.logError('========== Task execution failed ==========', {
        error,
      })
      agentEventBus.emit({
        id: generateId(),
        taskId: this.taskId,
        event: EventItemType.TaskError,
        data: {
          message: error.message,
          stack: error.stack,
        },
        timestamp: Date.now(),
      })
    } catch (innerError: any) {
      logger.error({ taskId: this.taskId, innerError }, 'handle_error_failed')
    } finally {
      await this.msg.cleanup()
      await this.listenerManager.cleanup()
      await this.file.cleanup()
    }
  }

  /**
   * Update task status
   */
  private async updateTaskStatus(status: string): Promise<void> {
    await AgentUtil.updateTaskStatus(this.taskId, status)
  }

  /**
   * Start task execution
   * @param taskId Task ID
   * @param graphBuilder Graph builder function that accepts a context parameter and returns a compiled graph
   * @param param Execution parameters including listeners and user response (used when resuming from checkpoint)
   */
  static async run(
    taskId: number,
    graphBuilder: GraphBuilder,
    param: {
      listeners?: BaseListener[]
      userResponse?: any
      runnerKey?: string
    }
  ): Promise<void> {
    param = Object.assign(
      {
        listeners: [],
        userResponse: null,
        runnerKey: '',
      },
      param
    )
    logger.info({ taskId }, 'AgentExecutor.Run')
    try {
      if (!this.canStartNewTask()) {
        throw new Error(
          `Max concurrency reached (${config.agentTask.maxConcurrent})`
        )
      }
      if (this.isTaskRunning(taskId)) {
        throw new Error('Task is already running')
      }
      const executor = await this.getOrCreateExecutor(taskId)
      if (param.runnerKey) {
        executor.runnerKey = param.runnerKey
      }
      if (param.listeners?.length) {
        executor.registerListeners(param.listeners)
      }
      executor.logger.info({ taskId }, 'AgentExecutor.Run.Starting')
      const graph = graphBuilder({
        executor,
        logger: executor.logger,
      })
      const runKey = taskId.toString()
      const runEntry = this.runningTasks.get(runKey)
      if (runEntry) runEntry.isExecuting = true
      executor
        .execute(graph, {
          userResponse: param.userResponse,
        })
        .finally(() => {
          this.runningTasks.delete(runKey)
          executor.logger.info({ taskId }, 'AgentExecutor.Run.Finished')
        })
    } catch (error: any) {
      logger.error({ taskId, error: error.message }, 'AgentExecutor.Run.Error')
      throw error
    }
  }

  /**
   * Initialize AgentExecutor: register all agentEventBus event handlers
   * Call once at application startup
   */
  static async init(): Promise<void> {
    this.registerHandlers()
    logger.info('AgentEventHandlers registered')
  }

  private static registerHandlers(): void {
    agentEventBus.on([EventItemType.TaskMsgUser], async (event) => {
      const { taskId } = event.data
      try {
        const executor = await AgentExecutor.getOrCreateExecutor(Number(taskId))
        await executor.msg.handleTaskMsgUser(event)
      } catch (error: any) {
        logger.error(
          { taskId, error: error.message },
          'task_msg_user_handler_error'
        )
      }
    })
    agentEventBus.on([EventItemType.TaskRun], async (event) => {
      const { taskId, userResponse } = event.data
      try {
        if (AgentExecutor.isTaskRunning(Number(taskId))) {
          logger.warn({ taskId }, 'task_already_running_skip_resume')
          return
        }
        const executor = AgentExecutor.runningTasks.get(taskId.toString())
        const runnerKey = executor?.executor?.runnerKey ?? ''
        const runner = this.bizRunnerRegistry.get(runnerKey)
        if (runner) {
          await runner(Number(taskId), { userResponse })
        } else {
          logger.error({ taskId, runnerKey }, 'unsupported_runner_key_for_run')
        }
      } catch (error: any) {
        logger.error({ taskId, error: error.message }, 'task_run_handler_error')
      }
    })
    agentEventBus.on([EventItemType.TaskMsgHistoryRequest], async (event) => {
      const { taskId } = event.data
      try {
        const executor = await AgentExecutor.getOrCreateExecutor(Number(taskId))
        await executor.msg.handleTaskMsgHistoryRequest(event)
      } catch (error: any) {
        logger.error(
          { taskId, error: error.message },
          'task_msg_history_handler_error'
        )
      }
    })
  }

  /**
   * Clean up all expired task entries
   */
  private static cleanExpiredTasks(): void {
    const now = Date.now()
    for (const [key, entry] of this.runningTasks) {
      if (now - entry.lastActiveAt > this.TASK_EXPIRE_MS) {
        logger.warn({ taskId: key }, 'AgentExecutor.ExpiredTask.Removed')
        this.runningTasks.delete(key)
      }
    }
  }

  /**
   * Concurrency control: check if a new task can be started (also cleans up expired entries)
   */
  private static canStartNewTask(): boolean {
    this.cleanExpiredTasks()
    return this.runningTasks.size < config.agentTask.maxConcurrent
  }

  /**
   * Check whether the specified task is running (expired entries are treated as not running)
   */
  static isTaskRunning(taskId: number): boolean {
    const key = taskId.toString()
    const entry = this.runningTasks.get(key)
    if (!entry) return false
    if (!entry.isExecuting) return false
    if (Date.now() - entry.lastActiveAt > this.TASK_EXPIRE_MS) {
      logger.warn({ taskId: key }, 'AgentExecutor.ExpiredTask.Removed')
      this.runningTasks.delete(key)
      return false
    }
    return true
  }

  /**
   * Get or create task executor instance
   * Returns existing instance if available; otherwise loads from DB and creates a new one,
   * ensuring only one global instance exists per task
   */
  static async getOrCreateExecutor(taskId: number): Promise<AgentExecutor> {
    const key = taskId.toString()
    const existing = this.runningTasks.get(key)
    if (existing) {
      return existing.executor
    }
    const task = await AgentUtil.getTaskById(taskId)
    if (!task) {
      throw new Error('Task not found')
    }
    const executor = new AgentExecutor(task)
    this.runningTasks.set(key, {
      executor,
      lastActiveAt: Date.now(),
      isExecuting: false,
    })
    return executor
  }
}
