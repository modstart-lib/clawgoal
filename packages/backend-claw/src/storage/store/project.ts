export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done'

export interface ProjectRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  title: string
  description: string | null
  /** planning | active | paused */
  status: string
  color: string
  logo: string | null
  start_at: string | null
  due_at: string | null
}

export interface AddProjectInput {
  tenantId: number
  userId: number
  title: string
  description?: string
  status?: ProjectStatus
  color?: string
  logo?: string
  startAt?: string
  dueAt?: string
}

export interface UpdateProjectInput {
  title?: string
  description?: string
  status?: ProjectStatus
  color?: string
  logo?: string | null
  startAt?: string | null
  dueAt?: string | null
}

export interface EventRow {
  id: number
  created_at: string
  updated_at: string
  project_id: number
  title: string
  description: string | null
  day: string | null
  /** 事件类型 */
  type: string | null
  /** 附加元数据（JSON 字符串，可选）*/
  meta: string | null
}

export interface AddEventInput {
  projectId: number
  title: string
  description?: string
  day?: string
  type?: string
  meta?: string
}

export interface UpdateEventInput {
  title?: string
  description?: string
  day?: string | null
  type?: string | null
  meta?: string | null
}

export interface MetricRow {
  id: number
  created_at: string
  updated_at: string
  /** 关联项目 ID */
  project_id: number
  /** 指标英文标识，如 income / visit */
  name: string
  /** 指标显示名称，如 收入 / 访问量 */
  title: string
  /** 排序序号，越小越靠前 */
  sort: number
  /** 备注说明 */
  remark: string | null
  /** 顶部卡片汇总模式：sum（求和）或 avg（平均） */
  summary_mode: string
}

export interface AddMetricInput {
  projectId: number
  name: string
  title: string
  sort?: number
  remark?: string
  summaryMode?: string
}

export interface UpdateMetricInput {
  title?: string
  sort?: number
  remark?: string | null
  summaryMode?: string
}

export interface MetricItemRow {
  id: number
  created_at: string
  updated_at: string
  /** 关联项目 ID */
  project_id: number
  /** 日期，格式 YYYY-MM-DD */
  day: string
  /** 指标名称（对应 claw_metric.name） */
  name: string
  /** 指标数值，支持小数 */
  value: number
  /** 备注说明 */
  remark: string | null
}

export interface UpsertMetricItemInput {
  projectId: number
  day: string
  name: string
  value: number
  remark?: string | null
}

export interface DeleteMetricItemInput {
  projectId: number
  day?: string
  name?: string
}

export interface NoteRow {
  id: number
  created_at: string
  updated_at: string
  /** 关联项目 ID */
  project_id: number
  /** 笔记类型（纯字符串，可选）*/
  type: string | null
  /** 笔记标题 */
  title: string
  /** 笔记内容（Markdown 富文本，可选）*/
  content: string | null
}

export interface AddNoteInput {
  projectId: number
  type?: string
  title: string
  content?: string
}

export interface UpdateNoteInput {
  type?: string | null
  title?: string
  content?: string | null
}

export type BacklogStatus = 'pending' | 'active' | 'pool' | 'dropped' | 'done'

export interface BacklogRow {
  id: number
  created_at: string
  updated_at: string
  /** 关联项目 ID */
  project_id: number
  /** 需求标题 */
  title: string
  /** pending | active | pool | dropped | done */
  status: string
  /** 类型（纯字符串，可选）*/
  type: string | null
  /** 截止时间，格式 YYYY-MM-DD（可选）*/
  due_at: string | null
  /** 来源（可选，如 用户反馈、内部、竞品分析 等）*/
  source: string | null
  /** 废弃原因（status=dropped 时填写）*/
  reason: string | null
  /** 采纳时间（status 变为 active 时记录）*/
  active_at: string | null
  /** 完成时间（status 变为 done 时记录）*/
  done_at: string | null
  /** 详细内容（Markdown）*/
  detail: string | null
  /** 优先级 high | medium | low */
  priority: string
}

export interface AddBacklogInput {
  projectId: number
  title: string
  status?: BacklogStatus
  type?: string
  dueAt?: string
  source?: string
  reason?: string
  activeAt?: string
  doneAt?: string
  detail?: string
}

export interface UpdateBacklogInput {
  title?: string
  status?: BacklogStatus
  type?: string | null
  dueAt?: string | null
  source?: string | null
  reason?: string | null
  activeAt?: string | null
  doneAt?: string | null
  detail?: string | null
}
