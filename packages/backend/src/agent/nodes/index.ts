/**
 * LangGraph node log wrapper
 * Automatically records node entry and exit, providing unified node lifecycle logging
 */
import { logger } from '../../utils/logger'
import { generateId } from '../../utils/utils'
import { agentEventBus } from '../agentEventBus'
import type { AgentExecutor } from '../agentExecutor'
import { type NodeAsksConfig, EventItemType } from '../types'
import { ModelToolCall } from '../../model/model'

/**
 * Node context type
 */
export interface NodeContext {
  executor: AgentExecutor
  logger: import('pino').Logger // Task-specific logger
}

/**
 * Node message configuration (consistent with ChatMessage structure)
 */
export interface NodeMessageConfig {
  /** Message content */
  content?: string
  /** Image list */
  images?: Array<{ name: string; url: string; size?: number }>
  /** File list */
  files?: Array<{ name: string; size: number; type?: string; url?: string }>
  /** File preview */
  preview?: { type: 'md' | 'html'; name: string; content: string }
}

/**
 * Node controller type
 */
export interface NodeController<T = any> {
  success: (result: Partial<T>) => void
  error: (message: string, details?: any) => void
  asks: (config: NodeAsksConfig, stateUpdate: Partial<T>) => void
  asksFromTool: (asksTool: ModelToolCall, stateUpdate?: Partial<T>) => void
  msg: (config: NodeMessageConfig) => void
}

/**
 * Node function type definition
 */
type NodeFunction<T> = (
  state: T,
  context: NodeContext,
  controller: NodeController<T>
) => Promise<void>

/**
 * defineNode higher-order function, returns a factory function
 * Usage: export const myNode = defineNode('nodeName', async (state, context, controller) => { ... })
 * Then in graph: .addNode('myNode', myNode(context))
 */
export function defineNode<T>(
  name: string,
  nodeFunction: NodeFunction<T>
): (context: NodeContext) => (state: T) => Promise<Partial<T>> {
  return (context: NodeContext) => {
    return async (state: T): Promise<Partial<T>> => {
      await context.executor.log.logInfo(`[NodeStart]-${name}`, {
        state,
      })
      agentEventBus.emit({
        id: generateId(),
        taskId: context.executor.taskId,
        event: EventItemType.TaskNodeStart,
        data: { nodeName: name, state },
        timestamp: Date.now(),
      })
      return new Promise<Partial<T>>((resolve, reject) => {
        const controller: NodeController<T> = {
          success: (result: Partial<T>) => {
            context.executor.log
              .logInfo(`[NodeSuccess]-${name}`, {
                state,
                result,
              })
              .then(() => {
                agentEventBus.emit({
                  id: generateId(),
                  taskId: context.executor.taskId,
                  event: EventItemType.TaskNodeSuccess,
                  data: { nodeName: name, result },
                  timestamp: Date.now(),
                })
                resolve({
                  ...result,
                  userResponse: undefined,
                } as Partial<T>)
              })
          },
          error: (message: string, details?: any) => {
            context.executor.log
              .logError(`[NodeError]-${name}`, {
                error: new Error(message),
                details,
              })
              .then(() => {
                agentEventBus.emit({
                  id: generateId(),
                  taskId: context.executor.taskId,
                  event: EventItemType.TaskNodeError,
                  data: { nodeName: name, message, details },
                  timestamp: Date.now(),
                })
                reject(new Error(message))
              })
          },
          asks: (config: NodeAsksConfig, stateUpdate: Partial<T>) => {
            agentEventBus.emit({
              id: generateId(),
              taskId: context.executor.taskId,
              event: EventItemType.TaskNodeAsksRequest,
              data: {
                content: config.content,
                question: config.question,
                options: config.options,
              },
              timestamp: Date.now(),
            })
            controller.success({
              ...stateUpdate,
              isPending: true,
              userResponse: undefined,
            } as Partial<T>)
            context.executor.log
              .logInfo(`[NodeAsks]-${name}`, {
                state,
                asksConfig: config,
              })
              .catch((err) => {
                logger.warn({ error: err.message }, 'log_node_asks_error')
              })
          },
          asksFromTool: (asksTool: ModelToolCall, stateUpdate?: Partial<T>) => {
            const { content, question, options } = asksTool.args
            controller.asks(
              {
                content,
                question: question || 'Please confirm to continue',
                options: options || ['Confirm', 'Cancel'],
              },
              stateUpdate || ({} as Partial<T>)
            )
          },
          msg: (config: NodeMessageConfig) => {
            agentEventBus.emit({
              id: generateId(),
              taskId: context.executor.taskId,
              event: EventItemType.TaskNodeMessage,
              data: {
                nodeName: name,
                content: config.content,
                images: config.images,
                files: config.files,
                preview: config.preview,
              },
              timestamp: Date.now(),
            })
            context.executor.log
              .logInfo(`[NodeMessage]-${name}`, {
                config,
              })
              .catch((err) => {
                logger.warn({ error: err.message }, 'log_node_message_error')
              })
          },
        }
        nodeFunction(state, context, controller).catch((error) => {
          context.executor.log
            .logError(`[NodeException]-${name}`, {
              error: error instanceof Error ? error : new Error(String(error)),
              stack: error instanceof Error ? error.stack : undefined,
            })
            .then(() => {
              agentEventBus.emit({
                id: generateId(),
                taskId: context.executor.taskId,
                event: EventItemType.TaskNodeError,
                data: {
                  nodeName: name,
                  message:
                    error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                },
                timestamp: Date.now(),
              })
              reject(error)
            })
        })
      })
    }
  }
}
