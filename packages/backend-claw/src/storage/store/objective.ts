// ─── Objective (目标) ────────────────────────────────────────────────────────

export type ObjectiveStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
export type ObjectiveIcon = 'target' | 'rocket' | 'flame'

export interface ObjectiveRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  title: string
  description: string | null
  /** active | completed | failed */
  status: string
  /** target | rocket | flame */
  icon: string
  result: string | null
  /** 所属项目 ID */
  project_id: number | null
  start_at: string | null
  end_at: string | null
  /** 截止时间 */
  due_at: string | null
}

export interface AddObjectiveInput {
  tenantId: number
  userId: number
  title: string
  description?: string
  status?: ObjectiveStatus
  icon?: ObjectiveIcon
  result?: string
  projectId: number
  startAt?: string
  endAt?: string
  dueAt?: string
}

export interface UpdateObjectiveInput {
  title?: string
  description?: string | null
  status?: ObjectiveStatus
  icon?: ObjectiveIcon
  result?: string | null
  projectId?: number | null
  startAt?: string | null
  endAt?: string | null
  dueAt?: string | null
}

// ─── KeyResult (关键结果) ──────────────────────────────────────────────────────

export type KeyResultStatus = 'running' | 'done' | 'canceled'

export interface KeyResultRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  objective_id: number
  title: string
  detail: string
  source_project_backlog_id: number | null
  /** running | done | canceled */
  status: string
  /** 截止时间 */
  due_at: string | null
  /** 预计耗时（小时） */
  estimated_hours: number | null
}
export interface AddKeyResultInput {
  tenantId: number
  userId: number
  objectiveId: number
  title: string
  detail?: string
  sourceProjectBacklogId?: number
  status?: KeyResultStatus
  dueAt?: string
  estimatedHours?: number
}
export interface UpdateKeyResultInput {
  title?: string
  detail?: string
  sourceProjectBacklogId?: number | null
  status?: KeyResultStatus
  dueAt?: string | null
  estimatedHours?: number | null
}
// ─── ObjectiveFocus (聚焦) ────────────────────────────────────────────────────

export interface ObjectiveFocusRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  /** JSON array of action IDs e.g. "[1,2,3]" */
  action_ids: string | null
  /** AI 提取的这几个Action的时间点（年月日时分秒） */
  time: string | null
}

export interface AddObjectiveFocusInput {
  tenantId: number
  userId: number
  actionIds?: number[]
  time?: string
}

export interface UpdateObjectiveFocusInput {
  actionIds?: number[] | null
  time?: string | null
}
