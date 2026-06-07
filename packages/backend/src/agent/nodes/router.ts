/**
 * Generic router node
 * Centralized routing node - responsible for intent recognition and flow control
 * All business nodes return to this node after execution, and the router determines the next step
 */

import type {
  IntentHistoryItem,
  NodeHistoryItem,
  RoutingIntent,
} from '../types'
import { RoutingIntentAction as IntentActionEnum } from '../types'
import { defineNode, NodeContext, NodeController } from './index'

/**
 * Router node configuration
 * @template T Node type
 */
export interface RouterNodeConfig<T extends string> {
  /** Intent recognition function (optional, not needed if frontend provides intent) */
  recognizeIntent?: (
    userId: number,
    tenantId: number,
    text: string,
    context: {
      currentNode: T
      currentState: any
      intentHistories?: IntentHistoryItem<T>[]
      conversationHistory?: any[]
      logger?: any
    }
  ) => Promise<RoutingIntent<T>>
  /** Routing resolution function */
  resolveNextNode: (state: any, intent: RoutingIntent<T>) => any
  /** Get the default next node */
  getDefaultNextNode: (currentNode: T, state: any) => T
  /** Get node capabilities configuration */
  getNodeCapabilities: (node: T) => any
  /** Initial node */
  initialNode: T
  /** End node */
  endNode: T
}

/**
 * Create a router node
 * @template T Node type
 */
export function createRouterNode<T extends string>(
  config: RouterNodeConfig<T>
) {
  const {
    recognizeIntent,
    resolveNextNode,
    getDefaultNextNode,
    getNodeCapabilities,
    initialNode,
    endNode,
  } = config

  return defineNode(
    'router',
    async (
      state: any,
      nodeContext: NodeContext,
      controller: NodeController
    ): Promise<void> => {
      try {
        const log = nodeContext.logger
        log.info(
          {
            currentNode: state.currentNode,
            hasUserResponse: !!state.userResponse,
            hasUserIntent: !!state.userResponse?.intent,
            isPending: state.isPending,
          },
          '[router] Router node started'
        )

        if (state.isPending === true && !state.userResponse) {
          log.info(
            '[router] ScheduleTask is pending for user input, keeping current state'
          )
          return controller.success({
            isPending: true,
            currentNode: state.currentNode,
            nextNode: undefined,
          })
        }

        const currentNode: T = state.currentNode || initialNode

        if (!state.currentNode) {
          log.info(
            '[router] First time entering router, starting from initial node'
          )

          return controller.success({
            nextNode: initialNode,
            currentNode: initialNode,
            previousNode: undefined,
            allowedNodes: getNodeCapabilities(initialNode).allowedTargets,
            nodeHistories: [
              {
                node: initialNode,
                timestamp: Date.now(),
                success: true,
                jumpReason: '工作流初始化',
              },
            ] as NodeHistoryItem<T>[],
          })
        }

        let userIntent: RoutingIntent<T> | undefined = undefined

        if (state.userResponse) {
          if (state.userResponse.intent) {
            userIntent = state.userResponse.intent
            log.info(
              { intent: userIntent },
              '[router] Using intent from frontend'
            )
          } else if (
            state.userResponse.text &&
            state.userResponse.text.trim()
          ) {
            if (!recognizeIntent) {
              throw new Error('Intent recognition function not provided')
            }

            log.info(
              { text: state.userResponse.text },
              '[router] Recognizing intent from text'
            )

            try {
              userIntent = await recognizeIntent(
                nodeContext.executor.userId,
                nodeContext.executor.tenantId,
                state.userResponse.text,
                {
                  currentNode,
                  currentState: state,
                  intentHistories: state.intentHistories,
                  conversationHistory: state.conversationHistory,
                  logger: nodeContext.logger,
                }
              )

              log.info(
                { recognizedIntent: userIntent },
                '[router] Intent recognized'
              )
            } catch (error) {
              log.error({ error }, '[router] Intent recognition failed')
              userIntent = {
                action: IntentActionEnum.Modify,
                reason: '意图识别失败，默认为修改当前内容',
              }
            }
          } else {
            userIntent = {
              action: IntentActionEnum.Confirm,
              reason: '用户提供了附件，默认为确认并继续',
            }
          }
        }

        let nextNode: T
        let routingReason: string

        if (userIntent) {
          log.info(
            { userIntent, currentNode },
            '[router] Routing based on user intent'
          )

          if (userIntent.action === IntentActionEnum.Cancel) {
            log.info('[router] User cancelled the task')
            return controller.error('用户取消了任务')
          }

          try {
            const decision = resolveNextNode(state, userIntent)
            nextNode = decision.nextNode
            routingReason = decision.reason

            log.info(
              {
                decision,
                userIntent,
                currentNode,
                nextNode,
              },
              '[router] Routing decision made'
            )

            if (decision.requiresUserInput && nextNode === currentNode) {
              log.info(
                '[router] Staying at current node, waiting for user input'
              )

              return controller.success({
                currentNode,
                nextNode,
                allowedNodes: decision.allowedNodes,
                isPending: true,
                userIntent,
                intentHistories: [
                  {
                    intent: userIntent,
                    timestamp: Date.now(),
                    fromNode: currentNode,
                    rawInput: state.userResponse?.text,
                  },
                ] as IntentHistoryItem<T>[],
              })
            }
          } catch (error: any) {
            log.error({ error, userIntent }, '[router] Routing failed')
            return controller.error(`路由失败: ${error.message}`)
          }
        } else {
          log.info(
            { currentNode, state },
            '[router] Routing based on default flow'
          )
          nextNode = getDefaultNextNode(currentNode, state)
          routingReason = `默认流程：从 ${currentNode} 到 ${nextNode}`
        }

        if (nextNode === endNode) {
          log.info('[router] Workflow completed')
          return controller.success({
            currentNode: endNode,
            nextNode: endNode,
            isPending: false,
            nodeHistories: [
              {
                node: endNode,
                timestamp: Date.now(),
                success: true,
                jumpReason: routingReason,
                userIntent,
              },
            ] as NodeHistoryItem<T>[],
          })
        }

        const historyEntry: NodeHistoryItem<T> = {
          node: nextNode,
          timestamp: Date.now(),
          success: true,
          jumpReason: routingReason,
          userIntent,
          userFeedback: state.userResponse?.text,
        }

        const intentHistoryEntry: IntentHistoryItem<T> | undefined = userIntent
          ? {
              intent: userIntent,
              timestamp: Date.now(),
              fromNode: currentNode,
              rawInput: state.userResponse?.text,
            }
          : undefined

        const capabilities = getNodeCapabilities(nextNode)

        return controller.success({
          nextNode,
          currentNode: nextNode,
          previousNode:
            currentNode !== nextNode ? currentNode : state.previousNode,
          allowedNodes: capabilities.allowedTargets,
          userIntent,
          isPending: false,
          nodeHistories: [historyEntry] as NodeHistoryItem<T>[],
          intentHistories: intentHistoryEntry
            ? ([intentHistoryEntry] as IntentHistoryItem<T>[])
            : undefined,
          conversationHistory: state.userResponse?.text
            ? [
                {
                  role: 'user' as const,
                  content: state.userResponse.text,
                  timestamp: Date.now(),
                  node: currentNode,
                },
              ]
            : undefined,
        })
      } catch (error: any) {
        const log = nodeContext.logger
        log.error(
          {
            error: error.message,
            stack: error.stack,
            state: {
              currentNode: state.currentNode,
              hasUserResponse: !!state.userResponse,
            },
          },
          '[router] Router node failed'
        )

        return controller.error(`路由器错误: ${error.message}`)
      }
    }
  )
}
