/**
 * Agent core type definitions
 * Contains event and message-related types
 */

/**
 * Event type enum
 */
export enum EventItemType {
  TaskStart = 'TaskStart',
  TaskNodeStart = 'TaskNodeStart',
  TaskNodeSuccess = 'TaskNodeSuccess',
  TaskNodeError = 'TaskNodeError',
  TaskNodeMessage = 'TaskNodeMessage',
  TaskNodeAsksRequest = 'TaskNodeAsksRequest',
  TaskNodeAsksResponse = 'TaskNodeAsksResponse',
  TaskSuccess = 'TaskSuccess',
  TaskError = 'TaskError',
  TaskPending = 'TaskPending',
  TaskMsgPush = 'TaskMsgPush',
  TaskMsgRemove = 'TaskMsgRemove',
  TaskMsgUser = 'TaskMsgUser',
  TaskRun = 'TaskRun',
  TaskModelCallStart = 'TaskModelCallStart',
  TaskModelCallEnd = 'TaskModelCallEnd',
  TaskToolsCallStart = 'TaskToolsCallStart',
  TaskToolsCallEnd = 'TaskToolsCallEnd',
  TaskMsgHistoryRequest = 'TaskMsgHistoryRequest',
  TaskMsgHistoryResponse = 'TaskMsgHistoryResponse',
  TaskCustom = 'TaskCustom',
  TaskCancelled = 'TaskCancelled',
}

/**
 * Event item
 */
export interface EventItem {
  /** Unique event ID: timestamp + random */
  id: string
  /** Associated task ID */
  taskId: number
  /** Event type */
  event: EventItemType
  /** Event data */
  data: Record<string, any>
  /** Timestamp */
  timestamp: number
}

/**
 * Event listener function
 */
export type EventListener = (event: EventItem) => void | Promise<void>

/**
 * Event subscription info
 */
export interface EventSubscription {
  /** List of subscribed event types */
  eventTypes: EventItemType[]
  /** Listener function */
  listener: EventListener
}

/**
 * Asks configuration
 */
export interface NodeAsksConfig {
  /** Content (optional) */
  content?: string
  /** Question (optional) */
  question?: string
  /** Option list (optional) */
  options?: string[]
}

/**
 * Message role type
 */
export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * Message Q&A interaction
 */
export interface MessageAsk {
  /** Ask ID (toolCallId from backend) */
  id: string
  /** Question text */
  question: string
  /** Option list */
  options: string[]
  /** Currently selected (1-based index, -1 for custom input) */
  optionActive: number
  /** Custom input content */
  optionInput?: string
  /** Submitted answer (for read-only state) */
  optionSelected?: string
}

/**
 * Image attachment
 */
export interface MessageImage {
  /** Image name */
  name: string
  /** Image URL */
  url: string
  /** Image size (bytes) */
  size?: number
}

/**
 * File attachment
 */
export interface MessageFile {
  /** File name */
  name: string
  /** File size (bytes) */
  size: number
  /** File type */
  type?: string
  /** File URL */
  url?: string
}

/**
 * File preview
 */
export interface MessagePreview {
  /** Preview type: md or html */
  type: 'md' | 'html'
  /** File name */
  name: string
  /** File content */
  content: string
}

/**
 * Node/task lifecycle stage — shown for TaskStart, TaskNodeStart, TaskNodeSuccess, etc.
 */
export type MessageStage = {
  /** Stage/node title */
  title: string
  /** Status */
  status: 'running' | 'success' | 'error'
  /** Success summary */
  success?: string
  /** Error message */
  error?: string
}

/**
 * Single tool call record — one message per tool call.
 */
export type MessageTool = {
  /** Tool call unique ID — links to claw_agent_tool record for logs */
  toolCallId: string
  /** Tool/node name (e.g. shell, web, runtime) */
  toolName: string
  /** Optional display label (e.g. 'shell.exec') */
  label?: string
  /** Human-readable description / reasoning title */
  title: string
  /** Status */
  status: 'running' | 'success' | 'error'
  /** Call arguments (JSON string, truncated) */
  detail?: string
  /** Success summary */
  success?: string
  /** Error message */
  error?: string
}

/**
 * Chat message
 */
export interface MessageItem {
  /** Message ID (uses database ID) */
  id: string
  /** Message role */
  role: MessageRole
  /** Message content */
  content?: string
  /** Image list */
  images?: MessageImage[]
  /** File list */
  files?: MessageFile[]
  /** Stage — covers node lifecycle, tool calls, AI thinking */
  stage?: MessageStage
  /** Arbitrary metadata (e.g. toolCallId, workflowId) */
  meta?: Record<string, any>
  /** Message Q&A interaction */
  asks?: MessageAsk[]
  /** File preview */
  preview?: MessagePreview
  /** Timestamp */
  timestamp: string
}

/**
 * Routing intent action type
 * Operations a user can perform
 */
export enum RoutingIntentAction {
  /** Confirm the current stage result and continue to the next step */
  Confirm = 'confirm',
  /** Modify the content of the current stage */
  Modify = 'modify',
  /** Jump to a specific node */
  Jump = 'jump',
  /** Return to the previous node */
  Back = 'back',
  /** Skip the current node and use the default value */
  Skip = 'skip',
  /** Cancel the entire task */
  Cancel = 'cancel',
  /** Re-generate the content of the current node */
  Rerun = 'rerun',
}

/**
 * User intent (generic version)
 * Describes the operation the user wants to perform
 * @template T Node type
 */
export interface RoutingIntent<T = string> {
  /** Action type */
  action: RoutingIntentAction
  /** Target node (required when action is 'jump') */
  target?: T
  /** Jump parameters (carries extra configuration) */
  params?: Record<string, any>
  /** Intent reason/description */
  reason?: string
}

/**
 * User response (generic version)
 * Contains the user's text, images, files, and structured intent
 * @template T Node type
 */
export interface UserResponse<T = string> {
  /** Text content */
  text?: string
  /** Array of image paths */
  images?: string[]
  /** Array of file paths */
  files?: string[]
  /** Structured intent (provided by frontend or recognized by backend) */
  intent?: RoutingIntent<T>
}

/**
 * Node history record item (generic version)
 * Records detailed information about each node execution
 * @template T Node type
 */
export interface NodeHistoryItem<T = string> {
  /** Node name */
  node: T
  /** Execution timestamp */
  timestamp: number
  /** Whether execution succeeded */
  success: boolean
  /** Confidence (0-1) */
  confidence?: number
  /** User feedback text */
  userFeedback?: string
  /** Jump reason (if triggered by a jump) */
  jumpReason?: string
  /** User intent (if any) */
  userIntent?: RoutingIntent<T>
  /** Error message (if failed) */
  error?: string
}

/**
 * Intent history record item (generic version)
 * Records each user intent operation
 * @template T Node type
 */
export interface IntentHistoryItem<T = string> {
  /** Intent object */
  intent: RoutingIntent<T>
  /** Timestamp */
  timestamp: number
  /** Node at the time */
  fromNode: T
  /** User's raw input */
  rawInput?: string
}

/**
 * Conversation history record item (generic version)
 * Supports multi-turn conversation context
 * @template T Node type
 */
export interface ConversationEntry<T = string> {
  /** Role */
  role: 'user' | 'assistant' | 'system'
  /** Content */
  content: string
  /** Timestamp */
  timestamp: number
  /** Associated node */
  node?: T
}

/**
 * Routing decision (generic version)
 * Output of the router node
 * @template T Node type
 */
export interface RoutingDecision<T = string> {
  /** Next target node */
  nextNode: T
  /** Reason for the decision */
  reason: string
  /** Whether user input is required */
  requiresUserInput: boolean
  /** Allowed jump target nodes (for frontend display) */
  allowedNodes: T[]
}

/**
 * Node capabilities configuration (generic version)
 * Defines whether a node supports skip, back, and other operations
 * @template T Node type
 */
export interface NodeCapabilities<T = string> {
  /** Whether the node can be skipped */
  canSkip: boolean
  /** Whether other nodes can navigate back to this node */
  canBack: boolean
  /** Whether the user can jump from this node to other nodes */
  canJump: boolean
  /** List of allowed jump target nodes */
  allowedTargets: T[]
}

/**
 * Routing table type (generic version)
 * Defines the mapping from current node + intent to target node
 * @template T Node type
 */
export type RoutingTable<T extends string = string> = {
  [currentNode in T]?: {
    [action in RoutingIntentAction]?: T
  }
}
