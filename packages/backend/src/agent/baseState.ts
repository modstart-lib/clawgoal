/**
 * Base state annotation factory
 * Provides common workflow control fields with generic node type support
 */
import { Annotation } from '@langchain/langgraph'
import type {
  ConversationEntry,
  IntentHistoryItem,
  NodeHistoryItem,
  RoutingIntent,
  UserResponse,
} from './types'

/**
 * Create base state annotation
 * Contains all common workflow control fields
 *
 * @template T Node type (e.g., 'analysis' | 'outline' | 'generate')
 * @returns Base state annotation object
 *
 * @example
 * ```ts
 * type WorkflowNode = 'analysis' | 'outline' | 'generate';
 *
 * const ArticleStateAnnotation = Annotation.Root({
 *   ...createBaseStateAnnotation<WorkflowNode>(),
 *   // Business-specific fields
 *   subject: Annotation<string>(),
 *   content: Annotation<string | undefined>(),
 * });
 * ```
 */
export function createBaseStateAnnotation<T extends string>() {
  return {
    /** Whether waiting for user input */
    isPending: Annotation<boolean | undefined>(),

    /** Next node determined by the router */
    nextNode: Annotation<T | undefined>(),

    /** Name of the currently executing node */
    currentNode: Annotation<T | undefined>(),

    /** Previous executed node (supports back navigation) */
    previousNode: Annotation<T | undefined>(),

    /** List of nodes currently allowed for jumping (for frontend display) */
    allowedNodes: Annotation<T[] | undefined>(),

    /** Current user intent (structured) */
    userIntent: Annotation<RoutingIntent<T> | undefined>(),

    /** Intent history records */
    intentHistories: Annotation<IntentHistoryItem<T>[]>({
      reducer: (current, update) => {
        if (!update) return current || []
        return [...(current || []), ...update]
      },
    }),

    /** Node execution history (full record) */
    nodeHistories: Annotation<NodeHistoryItem<T>[]>({
      reducer: (current, update) => {
        if (!update) return current || []
        return [...(current || []), ...update]
      },
    }),

    /** Multi-turn conversation history (supports context understanding) */
    conversationHistory: Annotation<ConversationEntry<T>[]>({
      reducer: (current, update) => {
        if (!update) return current || []
        return [...(current || []), ...update]
      },
    }),

    /** User response (text, images, files, intent) */
    userResponse: Annotation<UserResponse<T> | undefined>(),
  }
}
