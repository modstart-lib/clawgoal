export interface AgentRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  title: string
  role_name: string
  is_system: number
  enable: number
  /** idle | working */
  status: string
  description: string | null
  avatar: string | null
  /** JSON 字符串，覆盖角色默认配置 */
  config: string | null
  /** JSON 字符串，如 "[1,2]"，该 Agent 情对接的渠道 ID 列表 */
  channel_ids: string | null
  /** 是否开启 Webhook 推送（0=关闭，1=开启） */
  webhook_enable: number
  /** Webhook 鉴权 Token */
  webhook_token: string | null
  /** JSON 字符串，3D 角色配置（CharacterConfig） */
  avatar_config: string | null
  /** JSON 字符串，用户为该 Agent 填写的 param 值（对象），由角色 config.yaml param 字段定义 */
  param: string | null
  /** 所属项目 ID（NULL 表示不属于任何项目） */
  project_id: number | null
}

export interface AddAgentInput {
  /** 显式指定插入 id（仅用于系统 seed，如 supervisor 固定为 1） */
  id?: number
  tenantId: number
  userId: number
  title: string
  roleName: string
  isSystem?: boolean
  enable?: boolean
  status?: 'idle' | 'working'
  description?: string
  avatar?: string
  /** 覆盖角色默认配置 */
  config?: Record<string, unknown>
  /** 该 Agent 需要对接的渠道 ID 列表（过滤去重） */
  channelIds?: number[]
  /** 3D 角色配置（CharacterConfig） */
  avatarConfig?: Record<string, unknown>
  /** 用户为该 Agent 填写的 param 值（对象），由角色 config.yaml param 字段定义 */
  param?: Record<string, unknown> | null
  /** 所属项目 ID */
  projectId?: number
}

export interface UpdateAgentInput {
  title?: string
  enable?: boolean
  status?: 'idle' | 'working'
  description?: string
  avatar?: string
  /** 覆盖角色默认配置 */
  config?: Record<string, unknown>
  /** 该 Agent 需要对接的渠道 ID 列表（过滤去重） */
  channelIds?: number[]
  /** 是否开启 Webhook 推送 */
  webhookEnable?: boolean
  /** Webhook 鉴权 Token */
  webhookToken?: string | null
  /** 3D 角色配置（CharacterConfig） */
  avatarConfig?: Record<string, unknown> | null
  /** 用户为该 Agent 填写的 param 值 */
  param?: Record<string, unknown> | null
  /** 所属项目 ID */
  projectId?: number | null
}

export interface AgentMemoryRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number
  /** 日期，格式 YYYY-MM-DD */
  day: string
  /** 记忆内容（Markdown 格式） */
  content: string
}

export interface AddAgentMemoryInput {
  tenantId: number
  userId: number
  agentId: number
  day: string
  content: string
}

export interface UpdateAgentMemoryInput {
  content: string
}
