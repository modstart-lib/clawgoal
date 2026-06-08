/**
 * TypeScript type definitions
 */

export interface Product {
  id: number
  name: string
  logo?: string
  materialCount: number
  articleCount: number
  taskCount: number
  executedTaskCount: number
}

export interface ImageMaterial {
  id: number
  url: string
  title: string
}

export interface TextMaterial {
  id: number
  title: string
  content: string
}

export type Material = ImageMaterial | TextMaterial

export type ArticleStatus = 'generating' | 'finish' | 'fail'

export interface PublishedChannel {
  channelId: number
  channelName: string
  status: 'running' | 'success' | 'error'
  taskId?: number
}

export interface ProductArticle {
  id: number
  userId: number
  productId: number
  subject: string
  generateType: 'manual' | 'ai'
  title: string
  keywords: string
  description: string
  content: string
  status: 'generating' | 'finish' | 'fail'
  createdAt: string
  updatedAt: string
}

export interface ArticleForm {
  topic: string
  keywords?: string
  description?: string
  content?: string
}

export interface Channel {
  id: number
  title: string
  url: string
  enable: number
  code?: string | null
  successCount: number
  totalCount: number
  createdAt: string
  updatedAt: string
}

export type TaskStatus = 'success' | 'running' | 'failed' | 'pending'

export interface ScheduleTask {
  id: number
  name: string
  status: TaskStatus
  statusText: string
  type: string
  scheduledTime?: string
  result: string
  publishedUrl?: string
  startTime: string
  endTime: string
  logs: string
  productName?: string
  productId?: number
}

export interface PublishTask {
  status: TaskStatus
  startTime: string
  endTime: string
  result: string
  publishUrl?: string
  logs: string
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ArticleGenerateData {
  title: string
  keywords: string
  content: string
}

export interface AIGenerateResponse {
  message: AIMessage
  article?: ArticleGenerateData
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// ─── Agent 相关类型 ──────────────────────────────────────────────────────────

export interface ModelRef {
  name: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export type ModelSlots = Record<string, ModelRef | string>

export interface ModelBehaviorConfig {
  temperature: number
  maxTokens: number
}

export interface AgentCapabilities {
  tools: string[]
  sharedMemoryRead?: boolean
  sharedMemoryWrite?: boolean
}

// ─── Chat ToolAction 类型 ─────────────────────────────────────────────────────

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
  template: string
}

export interface ToolAction {
  type: 'form'
  icon?: string
  title: string
  config: ToolActionFormConfig
}

export interface ChatConfig {
  toolActions?: ToolAction[]
}

export interface RoleParamDef {
  name: string
  title: string
  /** 字段说明，展示在输入框下方 */
  description?: string
  type: 'text' | 'select' | 'textarea'
  defaultValue?: string
  option?: string
  /** 创建 Agent 时是否要求用户必须填写 */
  required?: boolean
}

export interface AgentRoleConfig {
  name: string
  title: string
  version: string
  description: string
  /** 角色预设个性（Soul），无 paramDb 记录时自动作为初始化内容 */
  soul?: string
  model: ModelBehaviorConfig
  capabilities: AgentCapabilities
  models: ModelSlots
  chats?: ChatConfig
  /** 角色自定义参数字段定义列表 */
  param?: RoleParamDef[]
}

export interface Agent {
  id: string
  /** 显示名称，对应 DB claw_agent.title */
  title: string
  /** 简介，对应 DB claw_agent.description */
  description: string | null
  roleName: string
  config: AgentRoleConfig
  active: boolean
  workStatus: 'idle' | 'working'
  avatar: string | null
  /** 3D 角色配置（CharacterConfig） */
  avatarConfig?: Record<string, unknown> | null
  /** 该 Agent 需要对接的渠道 ID 列表（已去重） */
  channelIds?: number[]
  /** 是否开启 Webhook 推送 */
  webhookEnable?: boolean
  /** Webhook 鉴权 Token */
  webhookToken?: string | null
  createdAt: string
  /** 用户为该 Agent 填写的 param 值 */
  param?: Record<string, unknown>
  /** 所属项目 ID */
  projectId?: number | null
}

export interface AddAgentOptions {
  name: string
  roleName: string
  telegramToken?: string
  avatar?: string
  /** 3D 角色配置（CharacterConfig） */
  avatarConfig?: Record<string, unknown>
  projectId?: number
}
