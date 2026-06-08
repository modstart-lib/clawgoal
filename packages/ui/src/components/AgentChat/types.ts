/**
 * Message role type
 */
export type MessageRole = 'user' | 'assistant'

/**
 * Node/task lifecycle stage — TaskStart, TaskNodeStart, tool call, workflow, AI thinking, etc.
 */
export interface MessageStage {
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
 * Message Q&A interaction
 */
export interface MessageAsk {
  /** Ask ID (toolCallId from backend) */
  id: string
  /** Question text */
  question: string
  /** Option list */
  options: string[]
  /** Currently selected (1-based index, -1 means custom input) */
  optionActive: number
  /** Custom input content */
  optionInput?: string
  /** Submitted answer (used for read-only state) */
  optionSelected?: string
}

export interface MessageSuggestItem {
  /** Button text */
  text: string
  /** Optional onClick handler; if not provided, button will submit the message content as-is */
  checked: boolean
  /** Optional icon (Lucide icon name) */
  icon?: string
}

/**
 * Image attachment
 */
export interface ImageAttachment {
  /** Image name */
  name: string
  /** Image URL */
  url: string
  /** Image size (bytes) */
  size?: number
  /** Raw File object */
  file?: File
}

/**
 * File attachment
 */
export interface FileAttachment {
  /** File name */
  name: string
  /** File size (bytes) */
  size: number
  /** File MIME type */
  type?: string
  /** File URL (server-provided) */
  url?: string
  /** Raw File object */
  file?: File
}

/**
 * Message metadata — questionnaire response
 */
export interface AgentMessageMetaAsksResponse {
  type: 'asksResponse'
  /** ID of the associated questionnaire message */
  msgId: string
}

/**
 * Message metadata discriminated union type
 */
export type AgentMessageMeta = AgentMessageMetaAsksResponse

/**
 * File preview
 */
export interface FilePreview {
  /** Preview type: md or html */
  type: 'md' | 'html'
  /** File name */
  name: string
  /** File content */
  content: string
}

/**
 * Agent message
 */
export interface AgentMessage {
  /** Message ID */
  id: string
  /** Message role */
  role: MessageRole
  /** Message type — 'newSession' marks the start of a new session */
  type?: 'newSession'
  /** Message content */
  content?: string
  /** Image list */
  images?: ImageAttachment[]
  /** File list */
  files?: FileAttachment[]
  /** Stage — covers node lifecycle, tool calls, workflow status, AI thinking */
  stage?: MessageStage
  /** Q&A interaction */
  asks?: MessageAsk[]
  /** File preview */
  preview?: FilePreview
  /** Suggest button */
  suggests?: MessageSuggestItem[]
  /** Action view button — click to open detail modal (tool logs, workflow detail, code diff, etc.) */
  actionView?: { label: string; data?: any }
  /** Arbitrary metadata — e.g. { toolCallId, workflowId, auditId } */
  meta?: Record<string, any>
  /** Timestamp */
  timestamp: string
}

/**
 * Send message data
 */
export interface SendMessageData {
  /** Text content */
  content: string
  /** Image attachments */
  images: ImageAttachment[]
  /** File attachments */
  files: FileAttachment[]
  /** Additional metadata */
  meta?: AgentMessageMeta
}

// ─── Tool action types ────────────────────────────────────────────────────────

export interface ToolActionTextField {
  type: 'text'
  name: string
  title: string
  defaultValue?: string
  required?: boolean
}

export interface ToolActionRadioField {
  type: 'radio'
  name: string
  title: string
  options: string[]
  defaultValue?: string
  required?: boolean
}

export interface ToolActionTextareaField {
  type: 'textarea'
  name: string
  title: string
  defaultValue?: string
  required?: boolean
  minRows?: number
  maxRows?: number
}

export type ToolActionField =
  | ToolActionTextField
  | ToolActionRadioField
  | ToolActionTextareaField

export interface ToolActionFormConfig {
  fields: ToolActionField[]
  /** Mustache-style template rendered with field values. Use {{fieldName}} placeholders. */
  template: string
}

export interface ToolAction {
  type: 'form'
  /** Lucide icon name */
  icon?: string
  title: string
  config: ToolActionFormConfig
}
