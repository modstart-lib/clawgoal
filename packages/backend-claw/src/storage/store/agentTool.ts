export type AgentToolStatus = 'running' | 'success' | 'error'

export interface AgentToolRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number
  session_id: number
  tool_call_id: string
  tool_name: string
  /** 显示标题（reasoning 或 label） */
  title: string
  /** JSON: 消息 meta 字段（含 toolCallId、label 等） */
  meta: string
  /** JSON: 调用参数 */
  params: string
  status: AgentToolStatus
  duration_ms: number
  result: string
  /** 详细执行日志（换行分隔） */
  logs: string
  /** 关联的 claw_agent_message.id，0 表示无对应消息 */
  msg_id: number
}

export interface InsertAgentToolInput {
  tenantId: number
  userId: number
  agentId: number
  sessionId: number
  toolCallId: string
  toolName: string
  title?: string
  meta?: Record<string, any>
  params?: Record<string, unknown>
  /** 关联的消息 ID */
  msgId?: number
}

export interface UpdateAgentToolInput {
  status?: AgentToolStatus
  durationMs?: number
  result?: string
}
