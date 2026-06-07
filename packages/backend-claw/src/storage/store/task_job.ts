// ─── TaskJob (智能体作业) ─────────────────────────────────────────────────────

export type TaskJobStatus =
  | 'draft'
  | 'ready'
  | 'asking'
  | 'running'
  | 'success'
  | 'fail'
  | 'canceled'

export interface ClawTaskJobRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number
  task_id: number
  task_objective_id: number
  task_key_result_id: number
  source_agent_id: number
  sort: number
  /** draft草稿 | ready就绪 | asking待反馈 | running进行中 | success成功 | fail失败 | canceled已取消 */
  status: string
  input: string | null
  output: string | null
  meta: string | null
}

export interface InsertClawTaskJobInput {
  tenantId: number
  userId: number
  agentId: number
  taskId?: number
  taskObjectiveId?: number
  taskKeyResultId?: number
  sourceAgentId?: number
  sort?: number
  status?: TaskJobStatus
  input?: string
  meta?: Record<string, unknown>
}

export interface UpdateClawTaskJobInput {
  status?: TaskJobStatus
  output?: string | null
  meta?: Record<string, unknown> | null
  input?: string | null
  agentId?: number
}
