export type AgentWorkflowStatus = 'running' | 'success' | 'error'
export type AgentWorkflowNodeStatus = 'running' | 'success' | 'error' | 'skip'

export interface AgentWorkflowRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number
  session_id: number
  start_at: string | null
  end_at: string | null
  status: AgentWorkflowStatus
  /** JSON: 任意元数据（如 pipelineName、nodeCount 等） */
  state: string
}

export interface InsertAgentWorkflowInput {
  tenantId: number
  userId: number
  agentId: number
  sessionId: number
  startAt?: string
  state?: Record<string, any>
}

export interface UpdateAgentWorkflowInput {
  endAt?: string
  status?: AgentWorkflowStatus
  state?: Record<string, any>
}

export interface AgentWorkflowNodeRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number
  session_id: number
  workflow_id: number
  start_at: string | null
  end_at: string | null
  status: AgentWorkflowNodeStatus
  /** JSON: 节点入参 */
  input: string
  /** JSON: 节点出参 */
  output: string
  /** JSON: 节点元数据（nodeId、nodeType、nodeTitle） */
  state: string
  /** JSON 数组: 节点执行过程日志 */
  logs: string
}

export interface InsertAgentWorkflowNodeInput {
  tenantId: number
  userId: number
  agentId: number
  sessionId: number
  workflowId: number
  startAt?: string
  input?: Record<string, any>
  state?: Record<string, any>
}

export interface UpdateAgentWorkflowNodeInput {
  endAt?: string
  status?: AgentWorkflowNodeStatus
  output?: Record<string, any>
  state?: Record<string, any>
  logs?: string[]
}

// ─── Workflow Message ─────────────────────────────────────────────────────────

export interface AgentWorkflowMessageRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  workflow_id: number
  session_id: number
  message: string
}

export interface InsertAgentWorkflowMessageInput {
  tenantId: number
  userId: number
  workflowId: number
  sessionId: number
  message: string
}
