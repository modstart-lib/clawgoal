export type ClawTaskStatus =
  | 'draft'
  | 'queue'
  | 'pending'
  | 'ready'
  | 'asking'
  | 'running'
  | 'success'
  | 'failed'
  | 'canceled'

export interface ClawTaskRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  /** 关联 Agent id（可选） */
  agent_id: number | null
  /** 任务开始时间 */
  start_at: string | null
  /** 任务结束时间 */
  end_at: string | null
  /** draft草稿 | pending等待子任务 | ready就绪 | asking待反馈 | running正在执行 | success成功 | failed失败 */
  status: string
  /** 状态备注（错误信息等） */
  status_remark: string | null
  title: string
  description: string | null
  /** 正在进行的工作描述（实时更新，完成后置空） */
  processing: string | null
  /** 执行结果汇总（成功/失败后写入） */
  result: string | null
  /** 关联目标 ID（0=无） */
  objective_id: number
  /** 关联关键结果 ID（0=无；objective_id=0 且 key_result_id=0 表示口头任务） */
  key_result_id: number
  /** 执行会话 ID（0=无，用于 asking 状态反馈流程） */
  session_id: number
  /** 截止时间 */
  due_at: string | null
  /** 预计耗时（小时） */
  estimated_hours: number | null
  /** 共享内容（JSON 字符串），同一任务下多个 action 可共享 */
  shared_content: string | null
  /** 来源：manual=手动创建, objective=目标驱动 */
  source: string
  /** 父级任务 ID（0 表示顶级任务） */
  parent_id: number
  /** 根任务 ID（0 表示顶级任务本身；子任务指向根节点 ID） */
  root_id: number
  /** 同级排序值 */
  sort: number
  /** 依赖任务 ID 列表（JSON 字符串数组） */
  needs: string
  /** 所属项目 ID（NULL 表示不属于任何项目） */
  project_id: number | null
  /** 执行日志（JSON 数组） */
  logs: string
}

export interface InsertClawTaskInput {
  /** SaaS user id */
  tenantId: number
  userId: number
  agentId?: number
  startAt?: string
  endAt?: string
  status?: ClawTaskStatus
  statusRemark?: string
  title: string
  description?: string
  processing?: string
  result?: string
  objectiveId?: number
  keyResultId?: number
  sessionId?: number
  dueAt?: string
  estimatedHours?: number
  sharedContent?: Record<string, unknown> | null
  source?: string
  parentId?: number
  rootId?: number
  sort?: number
  needs?: string[]
  projectId?: number
}

export interface UpdateClawTaskInput {
  agentId?: number | null
  startAt?: string | null
  endAt?: string | null
  status?: ClawTaskStatus
  statusRemark?: string | null
  title?: string
  description?: string | null
  processing?: string | null
  result?: string | null
  objectiveId?: number | null
  keyResultId?: number | null
  sessionId?: number
  dueAt?: string | null
  estimatedHours?: number | null
  sharedContent?: Record<string, unknown> | null
  source?: string | null
  parentId?: number
  rootId?: number
  needs?: string[] | null
}
