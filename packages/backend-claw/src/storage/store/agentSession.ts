/** claw_agent_session — 对话会话类型定义 */

export interface AgentSessionRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number
  title: string
  message_count: number
  data: string
  /** asks 工具暂停时保存的 agentic loop 状态（JSON 字符串，null 表示无暂停状态） */
  agentic_data: string | null
  /** 近期对话历史消息（序列化的 BaseMessage 数组，null 表示无历史） */
  history: string | null
}

export interface InsertAgentSessionInput {
  tenantId: number
  userId: number
  agentId: number
  title: string
  taskId?: number
  taskMission?: string
}

export interface UpdateAgentSessionInput {
  title?: string
  messageCount?: number
}

export interface UpsertAgenticInput {
  tenantId: number
  userId: number
  sessionId: number
  /** agentic loop 暂停状态，存入 session.agentic_data 字段 */
  data: Record<string, unknown>
}
