export type AgentAuditStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type AgentAuditType = 'diff'

export interface AgentAuditDiffContent {
  /** Key: repo name (subdir name, or "<codespace>" for root). Value: unified diff string, or null for unchanged repos. */
  diffs: Record<string, string | null>
  /** git diff --stat 摘要，如 "3 files changed, +45 -12"，供 LLM 读取 */
  diffStat?: string
  summary: string
  /** 产生此 diff 的开发分支名，合并时使用 */
  devBranch?: string
  review?: {
    comments: Array<{ file: string; text: string }>
    rejectMessage: string
  }
}

export interface AgentAuditRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number
  task_id: number
  session_id: number
  type: AgentAuditType
  /** JSON string — parsed shape: AgentAuditDiffContent */
  content: string
  status: AgentAuditStatus
}

export interface InsertAgentAuditInput {
  tenantId: number
  userId: number
  agentId: number
  taskId?: number
  sessionId?: number
  type?: AgentAuditType
  content: AgentAuditDiffContent
}

export interface UpdateAgentAuditInput {
  status?: AgentAuditStatus
  content?: AgentAuditDiffContent
}
