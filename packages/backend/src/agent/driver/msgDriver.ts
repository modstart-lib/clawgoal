/**
 * Msg driver abstract class
 * Responsible for converting Agent events to frontend messages and pushing them
 * Subclasses only need to implement storage-related methods: saveMsg / updateMsg / findMsg / queryHistory / saveUserMsg
 */
import pino from 'pino'
import { logger } from '../../utils/logger.js'
import { generateId } from '../../utils/utils'
import { agentEventBus } from '../agentEventBus.js'
import type { AgentExecutor } from '../agentExecutor.js'
import { createAgentLogger } from '../logger.js'
import { detectCancelIntent } from '../util/cancelContinueIntent.js'
import type {
  EventItem,
  MessageAsk,
  MessageItem,
  MessageStage,
} from '../types.js'
import { EventItemType as ET, EventItemType } from '../types.js'

/**
 * Sanitize error messages by removing HTML content, preventing gateway error pages (e.g., Cloudflare 502) from being displayed directly in the conversation.
 * Processing logic:
 * 1. If the message contains HTML tags, attempt to extract plain text before the first HTML tag as a summary
 * 2. If the extracted result is too short or empty, return a generic network error message
 * 3. If the final result exceeds 200 characters, truncate and append ellipsis
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return '未知错误'
  if (/<[a-zA-Z][\s\S]*?>/m.test(message)) {
    const beforeHtml = message.split(/<[a-zA-Z]/)[0].trim()
    const cleaned = beforeHtml
      .replace(/&[a-zA-Z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned.length > 5) {
      return cleaned.length > 200 ? cleaned.slice(0, 200) + '…' : cleaned
    }
    return '请求失败，服务暂时不可用（网关错误）'
  }
  return message.length > 500 ? message.slice(0, 500) + '…' : message
}

/**
 * Derive a human-readable title from tool call arguments.
 * Used to populate the `title` field of a stageItem so the UI can show what the tool is actually doing.
 */
function getToolTitle(args: any): string {
  if (!args || typeof args !== 'object') return ''
  if (typeof args.command === 'string' && args.command.length > 0)
    return args.command.slice(0, 120)
  if (typeof args.query === 'string' && args.query.length > 0)
    return args.query.slice(0, 120)
  if (typeof args.path === 'string' && args.path.length > 0)
    return args.path.slice(0, 120)
  if (typeof args.url === 'string' && args.url.length > 0)
    return args.url.slice(0, 120)
  if (typeof args.prompt === 'string' && args.prompt.length > 0)
    return args.prompt.slice(0, 120)
  if (typeof args.content === 'string' && args.content.length > 0)
    return args.content.slice(0, 100)
  const firstStr = (Object.values(args) as unknown[]).find(
    (v): v is string => typeof v === 'string' && v.length > 0
  )
  return firstStr ? firstStr.slice(0, 120) : ''
}

export abstract class AbstractMsgDriver {
  protected executor: AgentExecutor
  protected logger: pino.Logger

  private unsubscribe: (() => void) | null = null
  private eventQueue: EventItem[] = []
  private isProcessing: boolean = false

  /**
   * Progress message stack — tracks active node stage messages.
   * Each frame: msgId of the stage message, stage snapshot.
   * Tool calls create their own independent messages, not accumulated here.
   */
  private progressStack: Array<{
    msgId: number
    stage: MessageStage
  }> = []

  /** tool name → msgId for in-flight tool call messages */
  private _toolMsgMap = new Map<string, number>()

  constructor(executor: AgentExecutor) {
    this.executor = executor
    this.logger = createAgentLogger(this.executor, 'msg')
  }

  /**
   * Initialize and register event listeners
   * Excludes TaskMsgPush to prevent self-triggering loops
   */
  initialize(): void {
    if (this.unsubscribe) {
      logger.warn(
        { taskId: this.executor.taskId?.toString() },
        'msg_driver_already_initialized'
      )
      return
    }
    this.unsubscribe = agentEventBus.on(
      [
        ET.TaskStart,
        ET.TaskNodeStart,
        ET.TaskNodeSuccess,
        ET.TaskNodeError,
        ET.TaskNodeMessage,
        ET.TaskNodeAsksRequest,
        ET.TaskNodeAsksResponse,
        ET.TaskSuccess,
        ET.TaskError,
        ET.TaskPending,
        ET.TaskToolsCallStart,
        ET.TaskToolsCallEnd,
        ET.TaskModelCallStart,
        ET.TaskModelCallEnd,
        ET.TaskCancelled,
      ],
      this.handleEvent.bind(this)
    )
  }

  /**
   * Clean up resources (unsubscribe, clear queue, reset state)
   */
  async cleanup(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.eventQueue = []
    this.isProcessing = false
    this.progressStack = []
  }

  /**
   * Handle an event (add to queue)
   */
  private handleEvent(event: EventItem): void {
    if (event.taskId !== this.executor.taskId) {
      return
    }
    this.eventQueue.push(event)
    this.processQueue()
  }

  /**
   * Process events in the queue (guarantees sequential execution)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    if (this.eventQueue.length === 0) return
    this.isProcessing = true
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!
        await this.processEvent(event)
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process a single event, dispatch to specific handler methods
   */
  private async processEvent(event: EventItem): Promise<void> {
    try {
      switch (event.event) {
        case ET.TaskStart:
          await this.handleTaskStart(event)
          break
        case ET.TaskNodeStart:
          await this.handleTaskNodeStart(event)
          break
        case ET.TaskNodeSuccess:
          await this.handleTaskNodeSuccess(event)
          break
        case ET.TaskNodeError:
          await this.handleTaskNodeError(event)
          break
        case ET.TaskNodeMessage:
          await this.handleTaskNodeMessage(event)
          break
        case ET.TaskNodeAsksRequest:
          await this.handleTaskNodeAsksRequest(event)
          break
        case ET.TaskNodeAsksResponse:
          await this.handleTaskNodeAsksResponse(event)
          break
        case ET.TaskSuccess:
          await this.handleTaskSuccess(event)
          break
        case ET.TaskError:
          await this.handleTaskError(event)
          break
        case ET.TaskPending:
          await this.handleTaskPending(event)
          break
        case ET.TaskToolsCallStart:
          await this.handleTaskToolsCallStart(event)
          break
        case ET.TaskToolsCallEnd:
          await this.handleTaskToolsCallEnd(event)
          break
        case ET.TaskModelCallStart:
          await this.handleTaskLLMCallStart(event)
          break
        case ET.TaskModelCallEnd:
          await this.handleTaskLLMCallEnd(event)
          break
        case ET.TaskCancelled:
          await this.handleTaskCancelled(event)
          break
        default:
          logger.warn({ event: event.event }, 'unknown_event_type')
      }
    } catch (error: any) {
      logger.error(
        {
          taskId: this.executor.taskId?.toString(),
          event: event.event,
          error: error.message,
          trace: error.stack,
        },
        'handle_event_error'
      )
    }
  }

  protected async handleTaskStart(_event: EventItem): Promise<void> {
    const stage: MessageStage = { title: '任务开始执行', status: 'success' }
    const messageData: Partial<MessageItem> = {
      role: 'assistant',
      stage,
      timestamp: Date.now().toString(),
    }
    const saved = await this.saveMsg('assistant', messageData)
    await this.pushMsg(saved.id, messageData)
  }

  protected async handleTaskNodeStart(event: EventItem): Promise<void> {
    const nodeName = event.data.nodeName || event.data.node || '未知节点'
    const stage: MessageStage = { title: nodeName, status: 'running' }
    const messageData: Partial<MessageItem> = {
      role: 'assistant',
      stage,
      timestamp: Date.now().toString(),
    }
    const saved = await this.saveMsg('assistant', messageData)
    this.progressStack.push({ msgId: saved.id, stage })
    await this.pushMsg(saved.id, messageData)
  }

  protected async handleTaskNodeSuccess(event: EventItem): Promise<void> {
    const nodeName = event.data.nodeName || event.data.node || '未知节点'
    const frameIdx = this.findNodeFrameIndex(nodeName)
    if (frameIdx >= 0) {
      const frame = this.progressStack[frameIdx]
      if (nodeName === 'router') {
        try {
          await this.deleteMsg(frame.msgId)
        } catch {}
        await this.pushMsgRemove(frame.msgId)
      } else {
        this.progressStack[frameIdx].stage = {
          ...this.progressStack[frameIdx].stage,
          status: 'success',
        }
        await this.updateProgressMsgAt(frameIdx)
      }
      this.progressStack.splice(frameIdx)
    }
  }

  protected async handleTaskNodeMessage(event: EventItem): Promise<void> {
    const { nodeName, content, images, files, preview } = event.data
    const messageData: Partial<MessageItem> = {
      role: 'assistant',
      content: content || `✨ ${nodeName} 完成`,
      images,
      files,
      preview,
      timestamp: Date.now().toString(),
    }
    const saved = await this.saveMsg('assistant', messageData)
    await this.pushMsg(saved.id, messageData)
  }

  protected async handleTaskNodeError(event: EventItem): Promise<void> {
    const nodeName = event.data.nodeName || event.data.node || '未知节点'
    const rawErrorMessage = event.data.message || event.data.error || '执行失败'
    const errorMessage =
      rawErrorMessage.length > 200
        ? rawErrorMessage.slice(0, 200) + '...'
        : rawErrorMessage
    const frameIdx = this.findNodeFrameIndex(nodeName)
    if (frameIdx >= 0) {
      this.progressStack[frameIdx].stage = {
        ...this.progressStack[frameIdx].stage,
        status: 'error',
        error: errorMessage,
      }
      await this.updateProgressMsgAt(frameIdx)
      this.progressStack.splice(frameIdx)
    }
  }

  protected async handleTaskNodeAsksRequest(event: EventItem): Promise<void> {
    const { content, question, options } = event.data
    const asks: MessageAsk[] = [
      {
        id: event.data.toolCallId ?? '',
        question: question || '',
        options: options || ['确认'],
        optionActive: 1,
      },
    ]
    const messageData: Partial<MessageItem> = {
      role: 'assistant',
      content: content || '',
      asks,
      timestamp: Date.now().toString(),
    }
    const saved = await this.saveMsg('assistant', messageData)
    await this.pushMsg(saved.id, messageData)
  }

  protected async handleTaskNodeAsksResponse(event: EventItem): Promise<void> {
    const { text, meta } = event.data
    const asksMsgId: string | undefined = meta?.msgId
    if (asksMsgId) {
      try {
        const existingData = await this.findMsg(Number(asksMsgId))
        if (
          existingData?.asks &&
          (existingData.asks as MessageAsk[]).length > 0
        ) {
          const updatedAsks = (existingData.asks as MessageAsk[]).map(
            (ask, index) =>
              index === 0 ? { ...ask, optionSelected: text || '' } : ask
          )
          const updatedData = { ...existingData, asks: updatedAsks }
          await this.updateMsg(Number(asksMsgId), updatedData)
          await this.pushMsg(Number(asksMsgId), updatedData)
        }
      } catch (error: any) {
        logger.warn(
          { error: error.message, asksMsgId },
          'update_asks_msg_error'
        )
      }
    }
  }

  protected async handleTaskSuccess(_event: EventItem): Promise<void> {
    const messageData: Partial<MessageItem> = {
      role: 'assistant',
      content: '✅ 任务执行成功！',
      timestamp: Date.now().toString(),
    }
    const saved = await this.saveMsg('assistant', messageData)
    await this.pushMsg(saved.id, messageData)
  }

  protected async handleTaskError(event: EventItem): Promise<void> {
    const rawMessage = event.data.message || event.data.error || '未知错误'
    const errorMessage = sanitizeErrorMessage(rawMessage)
    const messageData: Partial<MessageItem> = {
      role: 'assistant',
      content: `❌ 任务执行失败：${errorMessage}`,
      timestamp: Date.now().toString(),
    }
    const saved = await this.saveMsg('assistant', messageData)
    await this.pushMsg(saved.id, messageData)
  }

  protected async handleTaskPending(event: EventItem): Promise<void> {
    const currentStage = event.data.state?.stage || 'unknown'
    logger.info(
      {
        taskId: this.executor.taskId?.toString(),
        stage: currentStage,
        isPending: true,
      },
      'task_pending_waiting_for_user'
    )
  }

  /**
   * Tool call start: create an independent stage message per call.
   */
  protected async handleTaskToolsCallStart(event: EventItem): Promise<void> {
    const { name, args } = event.data
    const toolTitle = getToolTitle(args)
    const title = toolTitle || name
    const toolMeta: Record<string, any> = {
      toolCallId: generateId(),
      toolName: name,
      label: name,
    }
    if (args) toolMeta.detail = JSON.stringify(args).slice(0, 500)
    const stage: MessageStage = { title, status: 'running' }
    const messageData: Partial<MessageItem> = {
      role: 'assistant',
      stage,
      meta: toolMeta,
      timestamp: Date.now().toString(),
    }
    const saved = await this.saveMsg('assistant', messageData)
    this._toolMsgMap.set(name, saved.id)
    await this.pushMsg(saved.id, messageData)
  }

  /**
   * Tool call end: update the corresponding stage message.
   */
  protected async handleTaskToolsCallEnd(event: EventItem): Promise<void> {
    const { name, status, success, error } = event.data
    const toolStatus = status === 'success' ? 'success' : 'error'
    const msgId = this._toolMsgMap.get(name)
    if (msgId != null) {
      this._toolMsgMap.delete(name)
      const existing = await this.findMsg(msgId)
      if (existing?.stage) {
        const updatedData: Partial<MessageItem> = {
          ...existing,
          stage: {
            ...existing.stage,
            status: toolStatus,
            success: success || undefined,
            error: error || undefined,
          },
        }
        await this.updateMsg(msgId, updatedData)
        await this.pushMsg(msgId, updatedData)
      }
    }
  }

  /**
   * Model call start: create a stage message for AI thinking.
   */
  protected async handleTaskLLMCallStart(event: EventItem): Promise<void> {
    const { title: customTitle } = event.data
    const title = customTitle || '正在AI思考'
    const stage: MessageStage = { title, status: 'running' }
    const messageData: Partial<MessageItem> = {
      role: 'assistant',
      stage,
      timestamp: Date.now().toString(),
    }
    const saved = await this.saveMsg('assistant', messageData)
    this.progressStack.push({ msgId: saved.id, stage })
    await this.pushMsg(saved.id, messageData)
  }

  /**
   * Model call end: mark the top stage as success and pop.
   */
  protected async handleTaskLLMCallEnd(_event: EventItem): Promise<void> {
    if (this.progressStack.length > 0) {
      const frameIdx = this.progressStack.length - 1
      this.progressStack[frameIdx].stage = {
        ...this.progressStack[frameIdx].stage,
        status: 'success',
      }
      await this.updateProgressMsgAt(frameIdx)
      this.progressStack.pop()
    }
  }

  /**
   * Update the top-of-stack progress message
   */
  private async updateTopProgressMsg(): Promise<void> {
    await this.updateProgressMsgAt(this.progressStack.length - 1)
  }

  /**
   * Update the stage message at the specified stack frame index
   */
  private async updateProgressMsgAt(frameIdx: number): Promise<void> {
    if (frameIdx < 0 || frameIdx >= this.progressStack.length) return
    const frame = this.progressStack[frameIdx]
    const existing = await this.findMsg(frame.msgId)
    if (!existing) return
    const updatedData = { ...existing, stage: frame.stage }
    await this.updateMsg(frame.msgId, updatedData)
    await this.pushMsg(frame.msgId, updatedData)
  }

  /**
   * Search from the top of the stack for the frame matching the node name.
   */
  private findNodeFrameIndex(nodeName: string): number {
    for (let i = this.progressStack.length - 1; i >= 0; i--) {
      if (this.progressStack[i].stage.title === nodeName) return i
    }
    return this.progressStack.length > 0 ? this.progressStack.length - 1 : -1
  }

  /**
   * Handle TaskMsgUser event: save user message and push to frontend, then emit TaskRun to continue execution
   */
  async handleTaskMsgUser(event: EventItem): Promise<void> {
    const { taskId, text, images, files, meta } = event.data

    // If the task is currently executing (not paused), only handle cancel intent
    if ((this.executor as any).isRunning()) {
      const userMsgData: Partial<MessageItem> = {
        role: 'user',
        content: text,
        images,
        files,
        timestamp: Date.now().toString(),
      }
      const saved = await this.saveMsg('user', userMsgData)
      await this.pushMsg(saved.id, userMsgData)

      if (text?.trim()) {
        const cancelResult = await detectCancelIntent(
          text,
          this.executor.userId,
          this.executor.tenantId
        )
        if (cancelResult.shouldCancel && cancelResult.confidence >= 0.7) {
          ;(this.executor as any).abortRunning(text)
        }
      }
      return
    }

    if (text || images || files) {
      agentEventBus.emit({
        id: generateId(),
        taskId: this.executor.taskId,
        event: EventItemType.TaskNodeAsksResponse,
        data: {
          text,
          images,
          files,
          meta,
        },
        timestamp: Date.now(),
      })
    }
    agentEventBus.emit({
      id: generateId(),
      taskId: this.executor.taskId,
      event: ET.TaskRun,
      data: {
        taskId: taskId ?? this.executor.taskId?.toString(),
        userResponse: { text, images, files, meta },
      },
      timestamp: Date.now(),
    })
  }

  /**
   * Handle TaskCancelled event: show user-initiated cancellation message
   */
  protected async handleTaskCancelled(_event: EventItem): Promise<void> {
    const messageData: Partial<MessageItem> = {
      role: 'assistant',
      content: '⏹️ 任务已被用户中止',
      timestamp: Date.now().toString(),
    }
    const saved = await this.saveMsg('assistant', messageData)
    await this.pushMsg(saved.id, messageData)
  }

  /**
   * Handle TaskMsgHistoryRequest event: query message history and return via TaskMsgHistoryResponse event
   */
  async handleTaskMsgHistoryRequest(event: EventItem): Promise<void> {
    const { taskId, maxId, requestId, socketId } = event.data
    const messages = await this.queryHistory(maxId)
    agentEventBus.emit({
      id: generateId(),
      taskId: this.executor.taskId,
      event: ET.TaskMsgHistoryResponse,
      data: { taskId, requestId, socketId, messages },
      timestamp: Date.now(),
    })
  }

  /** Persist a message and return its ID */
  protected abstract saveMsg(
    role: string,
    data: Partial<MessageItem>
  ): Promise<{ id: number }>

  /** Update message content by ID */
  protected abstract updateMsg(
    id: number,
    data: Partial<MessageItem>
  ): Promise<void>

  /** Find a message by ID, returns null if not found */
  protected abstract findMsg(id: number): Promise<Partial<MessageItem> | null>

  /** Delete a message by ID */
  protected abstract deleteMsg(id: number): Promise<void>

  /** Save a user-initiated message (persistence only, no push) */
  abstract saveUserMsg(data: {
    text?: string
    images?: string[]
    files?: string[]
    meta?: Record<string, any>
  }): Promise<void>

  /** Query task message history */
  abstract queryHistory(maxId?: number): Promise<Array<Record<string, any>>>

  public async pushMsgRemove(msgId: number): Promise<void> {
    agentEventBus.emit({
      id: generateId(),
      taskId: this.executor.taskId,
      event: EventItemType.TaskMsgRemove,
      data: {
        type: 'msgRemove',
        msgId: msgId.toString(),
      },
      timestamp: Date.now(),
    })
  }

  public async pushMsg(
    msgId: number,
    messageData: Partial<MessageItem>
  ): Promise<void> {
    const finalMessage: MessageItem = {
      id: msgId.toString(),
      role: messageData.role || 'assistant',
      content: messageData.content,
      images: messageData.images,
      files: messageData.files,
      preview: messageData.preview,
      stage: messageData.stage,
      meta: messageData.meta,
      asks: messageData.asks,
      timestamp: messageData.timestamp || Date.now().toString(),
    }
    agentEventBus.emit({
      id: generateId(),
      taskId: this.executor.taskId,
      event: ET.TaskMsgPush,
      data: {
        type: 'msg',
        message: finalMessage,
      },
      timestamp: Date.now(),
    })
  }
}
