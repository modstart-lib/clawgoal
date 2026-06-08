export interface AgentMessageRawRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  session_id: number
  /** 完整的模型消息 JSON 字符串 */
  message: string
}

export interface InsertAgentMessageRawInput {
  tenantId: number
  userId: number
  sessionId: number
  /** 序列化后的消息 JSON 字符串 */
  message: string
}
