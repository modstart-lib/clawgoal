/**
 * Claw SQLite 数据库 Row 类型与操作输入类型定义
 */

// ─── Option ───────────────────────────────────────────────────────────────────

export interface OptionRow {
  name: string
  value: string
}

// ─── Agent ───────────────────────────────────────────────────────────────────

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
}

// ─── Channel ──────────────────────────────────────────────────────────────────

export type ChannelType =
  | 'telegram'
  | 'feishu'
  | 'dingtalk'
  | 'wecom'
  | 'discord'
  | 'slack'
  | 'msteams'
  | 'line'
  | 'matrix'
  | 'mattermost'
export type ChannelStatus = 'pending' | 'success'

export interface ChannelConfig {
  token?: string
  chatId?: string
  ownerId?: string
  // 飞书
  appId?: string
  appSecret?: string
  verifyToken?: string
  encryptKey?: string
  // 钉钉
  appKey?: string
  agentId?: string
  robotCode?: string
  userId?: string
  // 企业微信
  corpId?: string
  corpSecret?: string
  toUser?: string
  toParty?: string
  encodingAesKey?: string
  // Discord
  publicKey?: string
  channelId?: string
  guildId?: string
  // Slack
  botToken?: string
  signingSecret?: string
  // MS Teams
  appPassword?: string
  serviceUrl?: string
  conversationId?: string
  // LINE
  channelAccessToken?: string
  channelSecret?: string
  // Matrix
  homeserverUrl?: string
  accessToken?: string
  roomId?: string
  // Mattermost
  serverUrl?: string
  outgoingToken?: string
  [key: string]: string | undefined
}

export interface ChannelRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  title: string
  enable: number
  /** 'telegram' | 'feishu' */
  type: string
  /** JSON 字符串，结构: {token, chatId} */
  config: string | null
  /** 'pending' | 'success' */
  status: string
  /** 是否为默认全局转发渠道（0=否，1=是）。
   * 当某个 Channel 标记为 isGlobal，未配置 channelIds 的 Agent 也会接收此渠道的消息。 */
  is_global: number
}

export interface AddChannelInput {
  tenantId: number
  userId: number
  title: string
  enable?: boolean
  /** 是否为默认全局转发渠道。未配置 channelIds 的 Agent 也会通过此渠道收发消息。 */
  isGlobal?: boolean
  type: ChannelType
  config?: Partial<ChannelConfig>
}

export interface UpdateChannelInput {
  title?: string
  enable?: boolean
  /** 是否为默认全局转发渠道。未配置 channelIds 的 Agent 也会通过此渠道收发消息。 */
  isGlobal?: boolean
  type?: ChannelType
  /** 修改 config 后 status 自动重置为 pending */
  config?: Partial<ChannelConfig>
  status?: ChannelStatus
}

// ─── Runtime ────────────────────────────────────────────────────────────────

export type RuntimeStatus = 'online' | 'offline'

export interface RuntimeRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  /** 唯一英文标识，如 "my-laptop" */
  name: string
  /** 显示名称 */
  title: string
  /** 连接凭证，runtime 通过 ?token=xxx 接入 WebSocket */
  token: string
  /** online | offline */
  status: string
  /** 最后活跃时间 */
  active_at: string | null
  /** 已发现的本地 Runner 工具列表（JSON 字符串，如 [{name,title},...]），null=未同步 */
  runners: string | null
}

export interface RunnerInfo {
  name: string
  title: string
  /** 工具本身的可用状态（如是否已登录授权），由 runtime 客户端上报 */
  status?: string
  /** 是否启用，由用户在界面上控制，runtime 数据同步时不会覆盖此字段 */
  enable?: boolean
}

export interface AddRuntimeInput {
  tenantId: number
  userId: number
  name: string
  title: string
  token: string
}

export interface UpdateRuntimeInput {
  title?: string
  token?: string
  runners?: RunnerInfo[] | null
}

// ─── Cron ─────────────────────────────────────────────────────────────────────

export type CronStatus = 'success' | 'error'

/** cron 任务执行配置 */
export interface CronConfig {
  /** 执行类型: shell=直接运行命令, agent=发送给 Agent Agent */
  type: 'shell' | 'agent'
  /** type=shell 时的 shell 命令 */
  shell?: string
  /** type=agent 时发送给 Agent 的工作记录 */
  agent?: string
}

export interface CronRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  title: string
  /** cron 表达式 */
  cron: string
  enable: number
  /** 关联 Agent id */
  agent_id: number
  description: string | null
  prompt: string
  /** 执行配置 JSON 字符串，结构: { type, shell?, agent? } */
  config: string | null
  /** 上次执行时间 */
  last_run_at: string | null
  /** 下次执行时间（由 cron 表达式计算，用于判断是否应执行） */
  next_run_at: string | null
  /** 上次执行状态 */
  last_status: string | null
  /** 上次执行状态备注 */
  last_status_remark: string | null
  /** 上次执行结果（由大模型汇总） */
  last_result: string | null
  /** 执行一次后自动禁用（1=是，0=否） */
  run_once: number
  /** 是否需要运行（1=需要，0=不需要；一次性任务执行后置为0防止重复执行） */
  should_run: number
  /** 成功时是否发送消息通知（1=是，0=否） */
  success_notify: number
}

export interface AddCronInput {
  tenantId: number
  userId: number
  title: string
  cron: string
  enable?: boolean
  agentId: number
  description?: string
  prompt: string
  /** 执行配置（type=shell|agent） */
  config?: CronConfig
  nextRunAt?: string
  /** 执行一次后自动禁用 */
  runOnce?: boolean
  /** 成功时是否发送消息通知 */
  successNotify?: boolean
}

export interface UpdateCronInput {
  title?: string
  cron?: string
  enable?: boolean
  agentId?: number
  description?: string
  prompt?: string
  /** 执行配置（type=shell|agent） */
  config?: CronConfig
  lastRunAt?: string
  nextRunAt?: string | null
  lastStatus?: CronStatus
  lastStatusRemark?: string
  /** 上次执行结果（由大模型汇总） */
  lastResult?: string
  runOnce?: boolean
  /** 是否需要运行（false=不运行，一次性任务完成后设为false） */
  shouldRun?: boolean
  /** 成功时是否发送消息通知 */
  successNotify?: boolean
}

export interface CronLogRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number | null
  cron_id: number
  title: string
  start_at: string
  end_at: string | null
  /** 'success' | 'error' */
  status: string
  status_remark: string | null
  /** 完整文本日志 */
  logs: string | null
  /** 大模型汇总的执行结果 */
  result: string | null
}

export interface InsertCronLogInput {
  tenantId: number
  userId: number
  agentId?: number
  cronId: number
  title: string
  startAt: string
  endAt?: string
  status: CronStatus
  statusRemark?: string
  /** 完整文本日志 */
  logs?: string
  /** 大模型汇总的执行结果 */
  result?: string
}

// ─── Chat Message ──────────────────────────────────────────────────────────────

export type {
  AgentMessageAsk,
  AgentMessageContent,
  AgentMessageRow,
  InsertAgentMessageInput,
} from './agentMessage.js'

// ─── Claw Task ───────────────────────────────────────────────────────────────

export type ClawTaskStatus =
  | 'draft'
  | 'pending'
  | 'ready'
  | 'asking'
  | 'running'
  | 'success'
  | 'failed'
  | 'canceled'

export interface ClawTaskContent {
  prompt: string
  [key: string]: unknown
}

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
  /** draft草稿 | pending等待子任务 | ready就绪 | asking待反馈 | running进行中 | success成功 | failed失败 | canceled已取消 */
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
  /** 关联关键结果 ID（0=无） */
  key_result_id: number
  /** 当前执行任务的会话 ID */
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
}

// ─── MCP ──────────────────────────────────────────────────────────────────────

/** MCP 连接类型 */
export type McpType = 'stdio' | 'sse' | 'http'

/** stdio 类型的连接配置 */
export interface StdioMcpConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

/** sse / http 类型的连接配置 */
export interface HttpMcpConfig {
  url: string
  headers?: Record<string, string>
}

export type McpConfig = StdioMcpConfig | HttpMcpConfig

export interface McpRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  /** 唯一标识，用于 capabilities.mcps 数组引用，如 "filesystem" */
  name: string
  /** 显示名称，如 "文件系统 MCP" */
  title: string
  /** stdio | sse | http */
  type: string
  enable: number
  /** JSON 字符串，结构取决于 type */
  config: string | null
  /** disconnected | connecting | connected | disconnecting | error */
  status: string
  description: string | null
  /** JSON 数组：[{name, description, inputSchema}]，连接成功后写入 */
  tools: string | null
}

export interface AddMcpInput {
  tenantId: number
  userId: number
  name: string
  title: string
  type: McpType
  enable?: boolean
  config?: McpConfig
  description?: string
}

export interface UpdateMcpInput {
  name?: string
  title?: string
  type?: McpType
  enable?: boolean
  config?: McpConfig
  status?:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'disconnecting'
    | 'error'
  description?: string
  /** JSON 数组字符串，null 表示清空 */
  tools?: string | null
}

// ─── Objective Focus ──────────────────────────────────────────────────────────

export type ObjectiveFocusStatus = 'todo' | 'doing' | 'finished' | 'cancel'

export interface ObjectiveFocusRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  project_id: number | null
  agent_id: number | null
  title: string
  description: string | null
  /** todo | doing | finished | cancel */
  status: string
  remark: string | null
  finished_at: string | null
  cancel_at: string | null
}

export interface AddObjectiveFocusInput {
  tenantId: number
  userId: number
  projectId?: number
  agentId?: number
  title: string
  description?: string
  status?: ObjectiveFocusStatus
}

export interface UpdateObjectiveFocusInput {
  projectId?: number | null
  agentId?: number | null
  title?: string
  description?: string | null
  status?: ObjectiveFocusStatus
  remark?: string | null
  finishedAt?: string | null
  cancelAt?: string | null
}

// ─── Objective Project ────────────────────────────────────────────────────────

export type ObjectiveProjectStatus = 'pending' | 'running' | 'paused' | 'done'
export type ObjectiveProjectIcon = 'target' | 'rocket' | 'flame'

export interface ObjectiveProjectRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  title: string
  description: string | null
  /** pending | running | paused | done */
  status: string
  /** target | rocket | flame */
  icon: string
  result: string | null
}

export interface AddObjectiveProjectInput {
  tenantId: number
  userId: number
  title: string
  description?: string
  status?: ObjectiveProjectStatus
  icon?: ObjectiveProjectIcon
  result?: string
}

export interface UpdateObjectiveProjectInput {
  title?: string
  description?: string
  status?: ObjectiveProjectStatus
  icon?: ObjectiveProjectIcon
  result?: string | null
}

// ─── Objective Item ───────────────────────────────────────────────────────────

export type ObjectiveItemStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'done'
  | 'cancel'

export interface ObjectiveItemRow {
  id: number
  created_at: string
  updated_at: string
  project_id: number
  title: string
  /** pending | running | paused | done | cancel */
  status: string
  note: string | null
  sort: number
}

export interface AddObjectiveItemInput {
  projectId: number
  title: string
  status?: ObjectiveItemStatus
  note?: string
  sort?: number
}

export interface UpdateObjectiveItemInput {
  title?: string
  status?: ObjectiveItemStatus
  note?: string | null
  sort?: number
}

// ─── Project ──────────────────────────────────────────────────────────────────

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
  meta: any
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
  meta?: any
}

export interface UpdateProjectInput {
  title?: string
  description?: string
  status?: ProjectStatus
  color?: string
  logo?: string | null
  startAt?: string | null
  dueAt?: string | null
  meta?: any
}

// ─── Project Event ────────────────────────────────────────────────────────

export interface EventRow {
  id: number
  created_at: string
  updated_at: string
  project_id: number
  biz: string | null
  title: string
  description: string | null
  day: string | null
  /** 事件类型 */
  type: string | null
  /** 附加元数据（JSON 字符串，可选）*/
  meta: any
  /** 分享 hash，null 表示未分享 */
  share_hash: string | null
}

export interface AddEventInput {
  projectId: number
  biz?: string
  title: string
  description?: string
  day?: string
  type?: string
  meta?: any
}

export interface UpdateEventInput {
  biz?: string | null
  title?: string
  description?: string
  day?: string | null
  type?: string | null
  meta?: any
  shareHash?: string | null
}

// ─── File ─────────────────────────────────────────────────────────────────────

export interface FileRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  /** 文件名（原始名称） */
  title: string
  /** 文件路径，格式：file/<year>/<month>/<day>/<random>.<ext>，实际位置：./data/<path> */
  path: string
  /** 文件后缀（小写，不带点），如 jpg、png、pdf */
  ext: string
  /** 文件大小（字节） */
  size: number
  /** 归属 AI 伙伴 ID，null 表示未绑定 */
  agent_id: number | null
}

export interface AddFileInput {
  /** SaaS user id */
  tenantId: number
  userId: number
  /** 文件名（原始名称） */
  title: string
  /** 文件路径，格式：file/<year>/<month>/<day>/<random>.<ext> */
  path: string
  /** 文件后缀（小写，不带点） */
  ext: string
  /** 文件大小（字节） */
  size: number
  /** 归属 AI 伙伴 ID */
  agentId?: number
}

export interface UpdateFileInput {
  title?: string
  size?: number
  agentId?: number | null
}

// ─── Project Metric ───────────────────────────────────────────────────────────

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

// ─── Project Metric Item ──────────────────────────────────────────────────────

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

// ─── Project Note ─────────────────────────────────────────────────────────────

export interface NoteRow {
  id: number
  created_at: string
  updated_at: string
  /** 关联项目 ID */
  project_id: number
  /** 业务标识 */
  biz: string | null
  /** 笔记类型（纯字符串，可选）*/
  type: string | null
  /** 笔记标题 */
  title: string
  /** 笔记内容（Markdown 富文本，可选）*/
  content: string | null
  /** 附加元数据（JSON 字符串，可选）*/
  meta: any
  /** 分享 hash，null 表示未分享 */
  share_hash: string | null
}

export interface AddNoteInput {
  projectId: number
  biz?: string
  type?: string
  title: string
  content?: string
  meta?: any
}

export interface UpdateNoteInput {
  biz?: string | null
  type?: string | null
  title?: string
  content?: string | null
  meta?: any
  shareHash?: string | null
}

// ─── Project Todo ──────────────────────────────────────────────────────────────

export type BacklogStatus = 'pending' | 'active' | 'pool' | 'dropped' | 'done'

export type BacklogPriority = 'high' | 'medium' | 'low'

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
  /** 来源（可选）*/
  source: string | null
  /** 废弃原因（status=dropped 时填写）*/
  reason: string | null
  /** 采纳时间 */
  active_at: string | null
  /** 完成时间 */
  done_at: string | null
  /** 详细内容（Markdown）*/
  detail: string | null
  /** 优先级：high | medium | low */
  priority: string | null
  /** 附加元数据（JSON 字符串，可选）*/
  meta: any
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
  priority?: BacklogPriority
  meta?: any
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
  priority?: BacklogPriority | null
  meta?: any
}

// ─── Project Wiki ──────────────────────────────────────────────────────────────

export type WikiStatus = 'processing' | 'success' | 'fail'
export type WikiType = 'manual' | 'syncUrl' | 'syncPath'

export interface WikiRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  project_id: number
  /** processing | success | fail */
  status: string
  /** manual | syncUrl | syncPath */
  type: string
  title: string
  content: string | null
  source_url: string | null
  /** syncUrl 类型的信息来源 URL */
  sync_url: string | null
  /** 同步间隔（天），默认 1 */
  sync_interval: number
  /** 下次同步时间（syncUrl/syncPath 类型才有意义） */
  next_sync_time: string | null
  /** 同步失败时的错误信息 */
  status_remark: string | null
  /** syncPath 类型的同步目录路径 */
  sync_path: string | null
}

export interface AddWikiInput {
  tenantId: number
  userId: number
  projectId: number
  title?: string
  content?: string
  sourceUrl?: string
  status?: WikiStatus
  type?: WikiType
  syncUrl?: string
  syncPath?: string
  syncInterval?: number
  nextSyncTime?: string
}

export interface UpdateWikiInput {
  title?: string
  content?: string | null
  sourceUrl?: string | null
  status?: WikiStatus
  type?: WikiType
  syncUrl?: string | null
  syncPath?: string | null
  syncInterval?: number
  nextSyncTime?: string | null
  statusRemark?: string | null
}

// ─── Project Wiki Sync Log ──────────────────────────────────────────────────────────────

export type WikiSyncLogStatus = 'processing' | 'success' | 'fail'

export interface WikiSyncLogRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  project_id: number
  wiki_id: number
  url: string
  /** processing | success | fail */
  status: string
  content: string | null
  error: string | null
  status_remark: string | null
}

export interface InsertWikiSyncLogInput {
  tenantId: number
  userId: number
  projectId: number
  wikiId: number
  url: string
  status?: WikiSyncLogStatus
  content?: string
  error?: string
}

export interface UpdateWikiSyncLogInput {
  status?: WikiSyncLogStatus
  content?: string | null
  error?: string | null
  statusRemark?: string | null
}

// ─── Agent Memory ──────────────────────────────────────────────────────────────

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
