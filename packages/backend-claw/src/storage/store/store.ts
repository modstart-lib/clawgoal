/**
 * Claw 通用存储层接口
 * 所有存储后端（SQLite、内存、远程等）均需实现此接口。
 */

import type {
  AddKeyResultInput,
  AddObjectiveFocusInput,
  AddObjectiveInput,
  KeyResultRow,
  ObjectiveFocusRow,
  ObjectiveRow,
  UpdateKeyResultInput,
  UpdateObjectiveFocusInput,
  UpdateObjectiveInput,
} from './objective.js'
import type { AgentMessageItem } from './agentMessage.js'
import type {
  AddAgentInput,
  AddAgentMemoryInput,
  AddChannelInput,
  AddCronInput,
  AddFileInput,
  AddMcpInput,
  AddRuntimeInput,
  AddBacklogInput,
  AddEventInput,
  AddProjectInput,
  AddMetricInput,
  AddNoteInput,
  AddWikiInput,
  AgentMemoryRow,
  AgentRow,
  ChannelRow,
  AgentMessageContent,
  AgentMessageRow,
  ClawTaskRow,
  ClawTaskStatus,
  CronLogRow,
  CronRow,
  DeleteMetricItemInput,
  RunnerInfo,
  FileRow,
  InsertAgentMessageInput,
  InsertClawTaskInput,
  InsertCronLogInput,
  InsertWikiSyncLogInput,
  McpRow,
  RuntimeRow,
  BacklogRow,
  EventRow,
  MetricItemRow,
  MetricRow,
  NoteRow,
  ProjectRow,
  WikiRow,
  WikiSyncLogRow,
  UpdateAgentInput,
  UpdateChannelInput,
  UpdateClawTaskInput,
  UpdateCronInput,
  UpdateFileInput,
  UpdateMcpInput,
  UpdateRuntimeInput,
  UpdateBacklogInput,
  UpdateEventInput,
  UpdateProjectInput,
  UpdateMetricInput,
  UpdateNoteInput,
  UpdateWikiInput,
  UpdateWikiSyncLogInput,
  UpsertMetricItemInput,
} from './types.js'
import type {
  AgentSessionRow as ChatSessionRow,
  InsertAgentSessionInput as InsertChatSessionInput,
  UpdateAgentSessionInput as UpdateChatSessionInput,
  UpsertAgenticInput,
} from './agentSession.js'
import type {
  AgentMessageRawRow,
  InsertAgentMessageRawInput,
} from './agentMessageRaw.js'
import type {
  AgentWorkflowRow,
  AgentWorkflowNodeRow,
  AgentWorkflowMessageRow,
  InsertAgentWorkflowInput,
  InsertAgentWorkflowNodeInput,
  InsertAgentWorkflowMessageInput,
  UpdateAgentWorkflowInput,
  UpdateAgentWorkflowNodeInput,
} from './agentWorkflow.js'
import type {
  AgentAuditRow,
  InsertAgentAuditInput,
  UpdateAgentAuditInput,
} from './agentAudit.js'
import type {
  AgentToolRow,
  InsertAgentToolInput,
  UpdateAgentToolInput,
} from './agentTool.js'

/**
 * Claw 存储后端接口。
 * 所有方法语义与字段含义同 types.ts 中对应类型保持一致。
 */
export interface IClawStore {
  // ─── 生命周期 ────────────────────────────────────────────────────────────

  /** 打开 / 初始化存储（幂等，可重复调用） */
  open(): void
  /** 释放资源 */
  close(): void

  // ─── Agent ──────────────────────────────────────────────────────────────

  findAll(tenantId: number, userId: number, onlyEnabled?: boolean): AgentRow[]
  findById(id: number): AgentRow | undefined
  countAgentsByProjectId(projectId: number): number
  findSystemAgent(): AgentRow | undefined
  insert(input: AddAgentInput): AgentRow
  update(id: number, input: UpdateAgentInput): void
  delete(id: number): boolean

  // ─── Channel ─────────────────────────────────────────────────────────────

  /** 查询当前租户和用户下的 Channel 列表。 */
  findAllChannels(
    tenantId: number,
    userId: number,
    onlyEnabled?: boolean
  ): ChannelRow[]
  /** 查询所有已启用 Channel（用于系统启动阶段全量拉起）。 */
  findAllEnabledChannels(): ChannelRow[]
  findChannelById(id: number): ChannelRow | undefined
  insertChannel(input: AddChannelInput): ChannelRow
  updateChannel(id: number, input: UpdateChannelInput): void
  /** 渠道通讯成功，将 status 置为 success */
  markChannelSuccess(id: number): void
  deleteChannel(id: number): boolean

  // ─── Cron ────────────────────────────────────────────────────────────────

  findAllCrons(
    tenantId: number,
    userId: number,
    onlyEnabled?: boolean
  ): CronRow[]
  findAllEnabledCrons(): CronRow[]
  findCronsByAgentId(
    tenantId: number,
    userId: number,
    agentId: number
  ): CronRow[]
  findCronById(id: number): CronRow | undefined
  insertCron(input: AddCronInput): CronRow
  updateCron(id: number, input: UpdateCronInput): void
  deleteCron(id: number): boolean

  // ─── Cron Log ────────────────────────────────────────────────────────────

  insertCronLog(input: InsertCronLogInput): number
  countCronLogs(tenantId: number, userId: number): number
  countCronLogsFiltered(
    tenantId: number,
    userId: number,
    cronId?: number,
    startTime?: string,
    endTime?: string,
    agentId?: number
  ): number
  listCronLogs(
    tenantId: number,
    userId: number,
    cronId?: number,
    limit?: number,
    offset?: number,
    startTime?: string,
    endTime?: string,
    agentId?: number
  ): CronLogRow[]
  deleteCronLog(id: number): boolean

  // ─── Agent Message ────────────────────────────────────────────────────────────

  insertAgentMessage(input: InsertAgentMessageInput): AgentMessageRow
  /** 更新已有聊天消息的 content（用于进度类消息的持续更新） */
  updateAgentMessage(id: number, content: AgentMessageContent): void
  /** 按 ID 查找单条聊天消息 */
  findAgentMessageById(id: number): AgentMessageRow | undefined
  /**
   * 列出聊天消息。
   */
  listAgentMessages(
    tenantId: number,
    userId: number,
    agentId: number,
    limit: number,
    offset: number
  ): AgentMessageRow[]
  /**
   * 返回最近 N 条聊天消息（按时间正序），用于短期上下文续写。
   * - sessionId > 0：优先按 session 过滤
   * - 否则返回 agent 的所有最近消息
   */
  listRecentAgentMessages(
    tenantId: number,
    userId: number,
    agentId: number,
    limit: number,
    sessionId: number
  ): AgentMessageRow[]
  /**
   * 游标分页：返回 id < beforeId（若提供）的最近 limit 条消息，按时间正序排列。
   * hasMore 表示是否还有更早的消息。
   * - sessionId > 0 时按 session 过滤
   */
  listAgentMessagesBefore(
    tenantId: number,
    userId: number,
    agentId: number,
    limit: number,
    beforeId: number | undefined,
    sessionId: number
  ): { rows: AgentMessageItem[]; hasMore: boolean }
  /** 清空指定 agent 的聊天记录，返回删除条数 */
  clearAgentMessages(tenantId: number, userId: number, agentId: number): number
  /** 物理删除指定 session 的所有消息 */
  deleteAgentMessagesBySession(sessionId: number): number
  /** 物理删除指定 agent 的所有消息 */
  deleteAgentMessagesByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): number

  // ─── Chat Session ────────────────────────────────────────────────────────────

  insertChatSession(input: InsertChatSessionInput): ChatSessionRow
  findChatSessionById(id: number): ChatSessionRow | undefined
  listChatSessions(
    tenantId: number,
    userId: number,
    agentId: number,
    limit?: number,
    offset?: number
  ): ChatSessionRow[]
  updateChatSession(id: number, input: UpdateChatSessionInput): void
  incrementChatSessionMessageCount(id: number, firstMsgText?: string): void
  deleteChatSession(id: number): boolean
  deleteChatSessionsByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): ChatSessionRow[]
  updateSessionData(id: number, data: Record<string, unknown>): void
  getSessionData(id: number): Record<string, unknown>

  // ─── Session History ──────────────────────────────────────────────────────────

  saveSessionHistory(sessionId: number, messages: unknown[]): void
  loadSessionHistory(sessionId: number): unknown[] | undefined
  clearSessionHistory(sessionId: number): void
  clearSessionHistoryByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): void

  // ─── Agent Message Raw ────────────────────────────────────────────────────────

  insertAgentMessageRaw(input: InsertAgentMessageRawInput): void
  listAgentMessageRawBySession(
    sessionId: number,
    limit?: number
  ): AgentMessageRawRow[]
  deleteAgentMessageRawBySession(sessionId: number): number
  deleteAgentMessageRawByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): number

  // ─── MCP ───────────────────────────────────────────────────────────────────────

  findAllMcps(tenantId: number, userId: number, onlyEnabled?: boolean): McpRow[]
  findMcpById(id: number): McpRow | undefined
  findMcpByName(
    tenantId: number,
    userId: number,
    name: string
  ): McpRow | undefined
  insertMcp(input: AddMcpInput): McpRow
  updateMcp(id: number, input: UpdateMcpInput): void
  deleteMcp(id: number): boolean

  // ─── Task ────────────────────────────────────────────────────────────

  findAllTasks(
    tenantId: number,
    userId: number,
    options?: {
      status?: string
      agentId?: number
      limit?: number
      source?: string
    }
  ): ClawTaskRow[]
  paginateTasks(
    tenantId: number,
    userId: number,
    options: {
      status?: string
      agentId?: number
      keyword?: string
      source?: string
      hasParent?: boolean
      rootOnly?: boolean
      projectId?: number
      page: number
      pageSize: number
    }
  ): { items: ClawTaskRow[]; total: number }
  countTasksByStatus(
    tenantId: number,
    userId: number,
    options?: { projectId?: number }
  ): Record<string, number>
  findTaskById(id: number): ClawTaskRow | undefined
  findTasksByKeyResultId(
    tenantId: number,
    userId: number,
    keyResultId: number
  ): ClawTaskRow[]
  insertTask(input: InsertClawTaskInput): ClawTaskRow
  updateTask(id: number, input: UpdateClawTaskInput): void
  deleteTask(id: number): boolean
  updateTaskStatus(
    id: number,
    status: ClawTaskStatus,
    statusRemark?: string | null
  ): void
  /** 查找子任务（parent_id = taskId） */
  findChildTasks(taskId: number): ClawTaskRow[]
  /** 查找所有后代任务（root_id = rootTaskId） */
  findDescendants(rootTaskId: number): ClawTaskRow[]
  /** 批量查找多个根任务的后代（root_id IN rootIds） */
  findDescendantsByRootIds(rootIds: number[]): ClawTaskRow[]
  /** 获取指定父任务的下一个 sort 值（末尾插入） */
  getNextChildSort(parentId: number): number
  /** 查找有 agent_id 的 ready 任务（调度器轮询用） */
  findReadyTasksWithAgent(): ClawTaskRow[]
  isTaskNeedsMet(task: ClawTaskRow): boolean
  checkAndPromoteQueuedChildren(parentId: number): number[]
  checkAndPromoteQueuedSiblings(completedTaskId: number): number[]
  checkAndAutoCompleteParent(taskId: number): void

  // ─── Runtime ───────────────────────────────

  findAllRuntimes(tenantId: number, userId: number): RuntimeRow[]
  findRuntimeById(id: number): RuntimeRow | undefined
  findRuntimeByToken(token: string): RuntimeRow | undefined
  findRuntimeByName(
    tenantId: number,
    userId: number,
    name: string
  ): RuntimeRow | undefined
  insertRuntime(input: AddRuntimeInput): RuntimeRow
  updateRuntime(id: number, input: UpdateRuntimeInput): void
  /** 更新连接状态；online 时同步更新 active_at，offline 时仅改状态 */
  setRuntimeStatus(id: number, status: 'online' | 'offline'): void
  /** 服务启动时将所有 runtime 重置为 offline */
  resetAllRuntimesToOffline(): void
  /** 更新 Runner 工具列表 */
  setRuntimeRunners(id: number, runners: RunnerInfo[]): void
  deleteRuntime(id: number): boolean

  // ─── Objective ────────────────────────────────────────────────────────────

  findAllObjectives(
    tenantId: number,
    userId: number,
    options?: { projectId?: number }
  ): ObjectiveRow[]
  findObjectiveById(id: number): ObjectiveRow | undefined
  insertObjective(input: AddObjectiveInput): ObjectiveRow
  updateObjective(id: number, input: UpdateObjectiveInput): void
  deleteObjective(id: number): boolean

  // ─── KeyResult ────────────────────────────────────────────────────────

  findAllKeyResults(
    tenantId: number,
    userId: number,
    options?: {
      objectiveId?: number
      status?: string
      page?: number
      pageSize?: number
    }
  ): { items: KeyResultRow[]; total: number }
  findKeyResultsByObjectiveId(objectiveId: number): KeyResultRow[]
  findKeyResultById(id: number): KeyResultRow | undefined
  insertKeyResult(input: AddKeyResultInput): KeyResultRow
  updateKeyResult(id: number, input: UpdateKeyResultInput): void
  deleteKeyResult(id: number): boolean

  // ─── Objective Focus ──────────────────────────────────────────────────────

  findLatestFocus(
    tenantId: number,
    userId: number
  ): ObjectiveFocusRow | undefined
  findAllFocuses(
    tenantId: number,
    userId: number,
    limit?: number
  ): ObjectiveFocusRow[]
  findObjectiveFocusById(id: number): ObjectiveFocusRow | undefined
  insertObjectiveFocus(input: AddObjectiveFocusInput): ObjectiveFocusRow
  updateObjectiveFocus(id: number, input: UpdateObjectiveFocusInput): void
  deleteObjectiveFocus(id: number): boolean

  // ─── Project ──────────────────────────────────────────────────────────────

  findAllProjects(tenantId: number, userId: number): ProjectRow[]
  findProjectById(id: number): ProjectRow | undefined
  insertProject(input: AddProjectInput): ProjectRow
  updateProject(id: number, input: UpdateProjectInput): void
  deleteProject(id: number): boolean

  // ─── Project Event ────────────────────────────────────────────────────

  findEventsByProjectId(projectId: number): EventRow[]
  findEventsByProjectIdAndBiz(projectId: number, biz: string): EventRow[]
  findEventsByProjectIdPaginated(
    projectId: number,
    options?: {
      page?: number
      pageSize?: number
      type?: string
      keyword?: string
    }
  ): { records: EventRow[]; total: number }
  findEventTypesByProjectId(projectId: number): string[]
  findEventById(id: number): EventRow | undefined
  findEventByProjectIdAndTitle(
    projectId: number,
    title: string
  ): EventRow | undefined
  findEventByShareHash(shareHash: string): EventRow | undefined
  insertEvent(input: AddEventInput): EventRow
  updateEvent(id: number, input: UpdateEventInput): void
  deleteEvent(id: number): boolean
  deleteEventsByProjectId(projectId: number): void

  // ─── File ─────────────────────────────────────────────────────────────────

  findAllFiles(
    tenantId: number,
    userId: number,
    options?: {
      agentId?: number
      ext?: string
      limit?: number
      offset?: number
    }
  ): FileRow[]
  findFileById(id: number): FileRow | undefined
  findFileByPath(path: string): FileRow | undefined
  insertFile(input: AddFileInput): FileRow
  updateFile(id: number, input: UpdateFileInput): void
  deleteFile(id: number): boolean

  // ─── Project Metric ───────────────────────────────────────────────────────

  findMetricByProjectId(projectId: number): MetricRow[]
  findMetricById(id: number): MetricRow | undefined
  insertMetric(input: AddMetricInput): MetricRow
  updateMetric(id: number, input: UpdateMetricInput): void
  deleteMetric(id: number): boolean
  deleteMetricByProjectId(projectId: number): void

  // ─── Project Metric Item ──────────────────────────────────────────────────

  findMetricItems(
    projectId: number,
    options?: { name?: string; startDay?: string; endDay?: string }
  ): MetricItemRow[]
  /** 存在则更新，不存在则插入（按 project_id + day + name 唯一键） */
  upsertMetricItem(input: UpsertMetricItemInput): MetricItemRow
  deleteMetricItems(input: DeleteMetricItemInput): void

  // ─── Project Backlog ────────────────────────────────────────────

  findBacklogsByProjectId(
    projectId: number,
    options?: {
      status?: string
      priority?: string
      sortBy?: 'priority' | 'status'
    }
  ): BacklogRow[]
  paginateBacklogsByProjectId(
    projectId: number,
    options?: {
      status?: string
      priority?: string
      type?: string
      keyword?: string
      sortBy?: 'priority' | 'status'
      page?: number
      pageSize?: number
    }
  ): { records: BacklogRow[]; total: number }
  findBacklogsBySource(source: string, projectId?: number): BacklogRow[]
  findBacklogTypesByProjectId(projectId: number): string[]
  findBacklogById(id: number): BacklogRow | undefined
  insertBacklog(input: AddBacklogInput): BacklogRow
  updateBacklog(id: number, input: UpdateBacklogInput): void
  deleteBacklog(id: number): boolean
  deleteBacklogsByProjectId(projectId: number): void

  // ─── Project Note ─────────────────────────────────────────────────────────

  findNotesByProjectIdAndBiz(projectId: number, biz: string): NoteRow[]
  findNotesByProjectId(
    projectId: number,
    options?: { type?: string }
  ): NoteRow[]
  paginateNotesByProjectId(
    projectId: number,
    options?: {
      type?: string
      keyword?: string
      page?: number
      pageSize?: number
    }
  ): { records: NoteRow[]; total: number }
  searchNotes(
    keyword: string,
    options?: { projectId?: number; limit?: number }
  ): NoteRow[]
  findNoteTypesByProjectId(projectId: number): string[]
  findNoteById(id: number): NoteRow | undefined
  findNoteByShareHash(shareHash: string): NoteRow | undefined
  insertNote(input: AddNoteInput): NoteRow
  updateNote(id: number, input: UpdateNoteInput): void
  deleteNote(id: number): boolean
  deleteNotesByProjectId(projectId: number): void

  // ─── Project Wiki ──────────────────────────────────────────────────────────

  findWikisByProjectIdAndBiz(projectId: number, biz: string): WikiRow[]
  findWikisByProjectId(
    projectId: number,
    options?: { status?: string }
  ): WikiRow[]
  findWikiById(id: number): WikiRow | undefined
  searchWikis(
    projectId: number,
    options?: { keyword?: string; limit?: number }
  ): WikiRow[]
  paginateWikis(
    projectId: number,
    options?: { keyword?: string; page?: number; pageSize?: number }
  ): { records: WikiRow[]; total: number }
  /** 查询到期需要同步的 syncUrl 类型 wiki（next_sync_time <= now 或 next_sync_time IS NULL） */
  findDueSyncWikis(): WikiRow[]
  /** 查询到期需要同步的 syncPath 类型 wiki（next_sync_time <= now 或 next_sync_time IS NULL） */
  findDueSyncPathWikis(): WikiRow[]
  /** 查询指定项目中 sync_path 以指定路径开头的所有 wiki，用于 syncPath 同步前清理 */
  findWikisByPathPrefix(projectId: number, syncPath: string): WikiRow[]
  insertWiki(input: AddWikiInput): WikiRow
  updateWiki(id: number, input: UpdateWikiInput): void
  deleteWiki(id: number): boolean
  deleteWikisByProjectId(projectId: number): void

  // ─── Project Wiki Sync Log ────────────────────────────────────────────────

  insertWikiSyncLog(input: InsertWikiSyncLogInput): WikiSyncLogRow
  updateWikiSyncLog(id: number, input: UpdateWikiSyncLogInput): void
  listWikiSyncLogs(wikiId: number, limit?: number): WikiSyncLogRow[]
  listAllWikiSyncLogs(
    projectId: number,
    options?: { limit?: number; offset?: number }
  ): WikiSyncLogRow[]
  countAllWikiSyncLogs(projectId: number): number

  // ─── Agent Memory ──────────────────────────────────────────────────────────

  /** 按时间倒序列出某 Agent 的记忆（用于展示历史） */
  findAgentMemories(
    tenantId: number,
    userId: number,
    agentId: number,
    limit?: number
  ): AgentMemoryRow[]
  /** 查询某天的记忆，不存在返回 undefined */
  findAgentMemoryByDay(
    tenantId: number,
    userId: number,
    agentId: number,
    day: string
  ): AgentMemoryRow | undefined
  /** 新增或更新（按 user_id+agent_id+day 唯一键做 upsert） */
  upsertAgentMemory(input: AddAgentMemoryInput): AgentMemoryRow
  /** 删除指定记忆条目 */
  deleteAgentMemory(id: number): boolean
  /** 清空某 Agent 的所有记忆 */
  deleteAgentMemoriesByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): void

  // ─── Agentic ─────────────────────────────────────────────────────

  /** 将 asks 工具暂停时的 agentic loop 状态持久化（session_id 唯一，已存则更新） */
  upsertAgentic(input: UpsertAgenticInput): void
  /** 下发并删除指定会话的暂停状态，不存在时返回 undefined */
  popAgentic(sessionId: number): ChatSessionRow | undefined

  // ─── Agent Workflow ────────────────────────────────────────────────────

  insertAgentWorkflow(input: InsertAgentWorkflowInput): AgentWorkflowRow
  updateAgentWorkflow(id: number, input: UpdateAgentWorkflowInput): void
  listAgentWorkflows(
    tenantId: number,
    userId: number,
    agentId?: number,
    sessionId?: number,
    limit?: number
  ): AgentWorkflowRow[]
  findAgentWorkflowById(id: number): AgentWorkflowRow | undefined

  insertAgentWorkflowNode(
    input: InsertAgentWorkflowNodeInput
  ): AgentWorkflowNodeRow
  updateAgentWorkflowNode(id: number, input: UpdateAgentWorkflowNodeInput): void
  listAgentWorkflowNodes(workflowId: number): AgentWorkflowNodeRow[]

  insertWorkflowMessage(input: InsertAgentWorkflowMessageInput): void
  listWorkflowMessages(workflowId: number): AgentWorkflowMessageRow[]

  // ─── Agent Audit ──────────────────────────────────────────────────────────

  insertAgentAudit(input: InsertAgentAuditInput): AgentAuditRow
  findAgentAuditById(id: number): AgentAuditRow | undefined
  findAgentAuditByIdAndUser(
    id: number,
    userId: number
  ): AgentAuditRow | undefined
  updateAgentAudit(id: number, input: UpdateAgentAuditInput): void
  listAgentAudits(
    tenantId: number,
    userId: number,
    options?: {
      agentId?: number
      sessionId?: number
      status?: string
      limit?: number
    }
  ): AgentAuditRow[]

  // ─── Agent Tool ───────────────────────────────────────────────────────────

  insertAgentTool(input: InsertAgentToolInput): AgentToolRow
  updateAgentTool(id: number, input: UpdateAgentToolInput): void
  appendAgentToolLog(toolCallId: string, line: string): void
  findAgentToolByCallId(toolCallId: string): AgentToolRow | undefined
  listAgentTools(
    tenantId: number,
    userId: number,
    options?: { agentId?: number; sessionId?: number; limit?: number }
  ): AgentToolRow[]

  // ─── Agent Task ───────────────────────────────────────────────────────────

  appendTaskLog(id: number, entry: string): void
  clearTaskLogs(id: number): void
  hasRunningTaskForProject(projectId: number): boolean
  hasRunningTaskForAgent(agentId: number): boolean
}
