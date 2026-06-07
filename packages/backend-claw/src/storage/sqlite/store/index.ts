import type { Database } from 'bun:sqlite'
import {
  execSqlSafe,
  runMigrations,
} from '../../../../../backend/src/storage/migrate.js'
import {
  DB_PATH,
  getSharedDb,
} from '../../../../../backend/src/storage/sqlite.js'
import { createLogger } from '../../../kernel/logger.js'
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
} from '../../store/objective.js'
import type { IClawStore } from '../../store/store.js'
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
} from '../../store/types.js'
import type { AgentMessageItem } from '../../store/agentMessage.js'
import type {
  AgentSessionRow as ChatSessionRow,
  InsertAgentSessionInput as InsertChatSessionInput,
  UpdateAgentSessionInput as UpdateChatSessionInput,
  UpsertAgenticInput,
} from '../../store/agentSession.js'
import type {
  AgentMessageRawRow,
  InsertAgentMessageRawInput,
} from '../../store/agentMessageRaw.js'
import type {
  AgentWorkflowRow,
  AgentWorkflowNodeRow,
  AgentWorkflowMessageRow,
  InsertAgentWorkflowInput,
  InsertAgentWorkflowNodeInput,
  InsertAgentWorkflowMessageInput,
  UpdateAgentWorkflowInput,
  UpdateAgentWorkflowNodeInput,
} from '../../store/agentWorkflow.js'
import type {
  AgentAuditRow,
  InsertAgentAuditInput,
  UpdateAgentAuditInput,
} from '../../store/agentAudit.js'
import type {
  AgentToolRow,
  InsertAgentToolInput,
  UpdateAgentToolInput,
} from '../../store/agentTool.js'
import { buildMigrations } from '../migrate.js'
import { buildInitSql } from '../schema.js'
import { SqliteClawAgentStore } from './agent.js'
import { SqliteClawBacklogStore } from './backlog.js'
import { SqliteClawChannelStore } from './channel.js'
import { SqliteAgentMessageStore } from './agentMessage.js'
import { SqliteAgentSessionStore } from './agentSession.js'
import { SqliteClawCronStore } from './cron.js'
import { SqliteClawEventStore } from './event.js'
import { SqliteClawFileStore } from './file.js'
import { SqliteClawMetricStore } from './metric.js'
import { SqliteClawMcpStore } from './mcp.js'
import { SqliteClawNoteStore } from './note.js'
import { SqliteClawRuntimeStore } from './runtime.js'
import { SqliteClawObjectiveStore } from './objective.js'
import { SqliteClawProjectStore } from './project.js'
import { SqliteClawWikiStore } from './wiki.js'
import { SqliteClawTaskStore } from './task.js'
import { SqliteAgentMessageRawStore } from './agentMessageRaw.js'
import { SqliteAgentWorkflowStore } from './agentWorkflow.js'
import { SqliteAgentAuditStore } from './agentAudit.js'
import { SqliteAgentToolStore } from './agentTool.js'

const logger = createLogger('claw-db')

class SqliteClawStoreImpl implements IClawStore {
  private db!: Database
  private agent!: SqliteClawAgentStore
  private channel!: SqliteClawChannelStore
  private agentMessage!: SqliteAgentMessageStore
  private agentMessageRaw!: SqliteAgentMessageRawStore
  private chatSession!: SqliteAgentSessionStore
  private runtime!: SqliteClawRuntimeStore
  private cron!: SqliteClawCronStore
  private file!: SqliteClawFileStore
  private mcp!: SqliteClawMcpStore
  private objective!: SqliteClawObjectiveStore
  private project!: SqliteClawProjectStore
  private event!: SqliteClawEventStore
  private metric!: SqliteClawMetricStore
  private backlog!: SqliteClawBacklogStore
  private note!: SqliteClawNoteStore
  private wiki!: SqliteClawWikiStore
  private task!: SqliteClawTaskStore
  private agentWorkflow!: SqliteAgentWorkflowStore
  private agentAudit!: SqliteAgentAuditStore
  private agentTool!: SqliteAgentToolStore

  async open(): Promise<void> {
    this.db = getSharedDb()
    execSqlSafe(this.db, buildInitSql())
    await runMigrations(buildMigrations(this.db))

    this.agent = new SqliteClawAgentStore(this.db)
    this.channel = new SqliteClawChannelStore(this.db)
    this.agentMessage = new SqliteAgentMessageStore(this.db)
    this.agentMessageRaw = new SqliteAgentMessageRawStore(this.db)
    this.chatSession = new SqliteAgentSessionStore(this.db)
    this.runtime = new SqliteClawRuntimeStore(this.db)
    this.cron = new SqliteClawCronStore(this.db)
    this.file = new SqliteClawFileStore(this.db)
    this.mcp = new SqliteClawMcpStore(this.db)
    this.objective = new SqliteClawObjectiveStore(this.db)
    this.project = new SqliteClawProjectStore(this.db)
    this.event = this.project.event
    this.metric = this.project.metric
    this.backlog = this.project.backlog
    this.note = this.project.note
    this.wiki = new SqliteClawWikiStore(this.db)
    this.task = new SqliteClawTaskStore(this.db)
    this.agentWorkflow = new SqliteAgentWorkflowStore(this.db)
    this.agentAudit = new SqliteAgentAuditStore(this.db)
    this.agentTool = new SqliteAgentToolStore(this.db)

    logger.info(`Claw DB opened at ${DB_PATH}`)
  }

  close(): void {
    this.db = undefined as unknown as Database
  }

  // ─── Agent ──────────────────────────────────────────────────────────────

  findAll(tenantId: number, userId: number, onlyEnabled?: boolean): AgentRow[] {
    return this.agent.findAll(tenantId, userId, onlyEnabled)
  }
  findById(id: number): AgentRow | undefined {
    return this.agent.findById(id)
  }
  countAgentsByProjectId(projectId: number): number {
    return this.agent.countByProjectId(projectId)
  }
  findSystemAgent(): AgentRow | undefined {
    return this.agent.findSystemAgent()
  }
  insert(input: AddAgentInput): AgentRow {
    return this.agent.insert(input)
  }
  update(id: number, input: UpdateAgentInput): void {
    return this.agent.update(id, input)
  }
  delete(id: number): boolean {
    return this.agent.delete(id)
  }
  findAgentMemories(
    tenantId: number,
    userId: number,
    agentId: number,
    limit?: number
  ): AgentMemoryRow[] {
    return this.agent.findAgentMemories(tenantId, userId, agentId, limit)
  }
  findAgentMemoryByDay(
    tenantId: number,
    userId: number,
    agentId: number,
    day: string
  ): AgentMemoryRow | undefined {
    return this.agent.findAgentMemoryByDay(tenantId, userId, agentId, day)
  }
  upsertAgentMemory(input: AddAgentMemoryInput): AgentMemoryRow {
    return this.agent.upsertAgentMemory(input)
  }
  deleteAgentMemory(id: number): boolean {
    return this.agent.deleteAgentMemory(id)
  }
  deleteAgentMemoriesByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): void {
    return this.agent.deleteAgentMemoriesByAgent(tenantId, userId, agentId)
  }

  // ─── Channel ─────────────────────────────────────────────────────────────

  findAllChannels(
    tenantId: number,
    userId: number,
    onlyEnabled?: boolean
  ): ChannelRow[] {
    return this.channel.findAllChannels(tenantId, userId, onlyEnabled)
  }
  findAllEnabledChannels(): ChannelRow[] {
    return this.channel.findAllEnabledChannels()
  }
  findChannelById(id: number): ChannelRow | undefined {
    return this.channel.findChannelById(id)
  }
  insertChannel(input: AddChannelInput): ChannelRow {
    return this.channel.insertChannel(input)
  }
  updateChannel(id: number, input: UpdateChannelInput): void {
    return this.channel.updateChannel(id, input)
  }
  markChannelSuccess(id: number): void {
    return this.channel.markChannelSuccess(id)
  }
  deleteChannel(id: number): boolean {
    return this.channel.deleteChannel(id)
  }

  // ─── Cron ────────────────────────────────────────────────────────────────

  findAllCrons(
    tenantId: number,
    userId: number,
    onlyEnabled?: boolean
  ): CronRow[] {
    return this.cron.findAllCrons(tenantId, userId, onlyEnabled)
  }
  findAllEnabledCrons(): CronRow[] {
    return this.cron.findAllEnabledCrons()
  }
  findCronsByAgentId(
    tenantId: number,
    userId: number,
    agentId: number
  ): CronRow[] {
    return this.cron.findCronsByAgentId(tenantId, userId, agentId)
  }
  findCronById(id: number): CronRow | undefined {
    return this.cron.findCronById(id)
  }
  insertCron(input: AddCronInput): CronRow {
    return this.cron.insertCron(input)
  }
  updateCron(id: number, input: UpdateCronInput): void {
    return this.cron.updateCron(id, input)
  }
  deleteCron(id: number): boolean {
    return this.cron.deleteCron(id)
  }

  // ─── Cron Log ────────────────────────────────────────────────────────────

  insertCronLog(input: InsertCronLogInput): number {
    return this.cron.insertCronLog(input)
  }
  countCronLogs(tenantId: number, userId: number): number {
    return this.cron.countCronLogs(tenantId, userId)
  }
  countCronLogsFiltered(
    tenantId: number,
    userId: number,
    cronId?: number,
    startTime?: string,
    endTime?: string,
    agentId?: number
  ): number {
    return this.cron.countCronLogsFiltered(
      tenantId,
      userId,
      cronId,
      startTime,
      endTime,
      agentId
    )
  }
  listCronLogs(
    tenantId: number,
    userId: number,
    cronId?: number,
    limit?: number,
    offset?: number,
    startTime?: string,
    endTime?: string,
    agentId?: number
  ): CronLogRow[] {
    return this.cron.listCronLogs(
      tenantId,
      userId,
      cronId,
      limit,
      offset,
      startTime,
      endTime,
      agentId
    )
  }
  deleteCronLog(id: number): boolean {
    return this.cron.deleteCronLog(id)
  }

  // ─── Agent Message ────────────────────────────────────────────────────────

  insertAgentMessage(input: InsertAgentMessageInput): AgentMessageRow {
    return this.agentMessage.insertAgentMessage(input)
  }
  updateAgentMessage(id: number, content: AgentMessageContent): void {
    return this.agentMessage.updateAgentMessage(id, content)
  }
  findAgentMessageById(id: number): AgentMessageRow | undefined {
    return this.agentMessage.findAgentMessageById(id)
  }
  listAgentMessages(
    tenantId: number,
    userId: number,
    agentId: number,
    limit: number,
    offset: number
  ): AgentMessageRow[] {
    return this.agentMessage.listAgentMessages(
      tenantId,
      userId,
      agentId,
      limit,
      offset
    )
  }
  listRecentAgentMessages(
    tenantId: number,
    userId: number,
    agentId: number,
    limit: number,
    sessionId: number
  ): AgentMessageRow[] {
    return this.agentMessage.listRecentAgentMessages(
      tenantId,
      userId,
      agentId,
      limit,
      sessionId
    )
  }
  listAgentMessagesBefore(
    tenantId: number,
    userId: number,
    agentId: number,
    limit: number,
    beforeId: number | undefined,
    sessionId: number
  ): { rows: AgentMessageItem[]; hasMore: boolean } {
    return this.agentMessage.listAgentMessagesBefore(
      tenantId,
      userId,
      agentId,
      limit,
      beforeId,
      sessionId
    )
  }
  clearAgentMessages(
    tenantId: number,
    userId: number,
    agentId: number
  ): number {
    return this.agentMessage.clearAgentMessages(tenantId, userId, agentId)
  }
  deleteAgentMessagesBySession(sessionId: number): number {
    return this.agentMessage.deleteAgentMessagesBySession(sessionId)
  }
  deleteAgentMessagesByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): number {
    return this.agentMessage.deleteAgentMessagesByAgent(
      tenantId,
      userId,
      agentId
    )
  }

  // ─── Chat Session ────────────────────────────────────────────────────────────

  insertChatSession(input: InsertChatSessionInput): ChatSessionRow {
    return this.chatSession.insertChatSession(input)
  }
  findChatSessionById(id: number): ChatSessionRow | undefined {
    return this.chatSession.findChatSessionById(id)
  }
  listChatSessions(
    tenantId: number,
    userId: number,
    agentId: number,
    limit?: number,
    offset?: number
  ): ChatSessionRow[] {
    return this.chatSession.listChatSessions(
      tenantId,
      userId,
      agentId,
      limit,
      offset
    )
  }
  updateChatSession(id: number, input: UpdateChatSessionInput): void {
    return this.chatSession.updateChatSession(id, input)
  }
  incrementChatSessionMessageCount(id: number, firstMsgText?: string): void {
    return this.chatSession.incrementMessageCount(id, firstMsgText)
  }
  deleteChatSession(id: number): boolean {
    return this.chatSession.deleteChatSession(id)
  }
  deleteChatSessionsByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): ChatSessionRow[] {
    return this.chatSession.deleteChatSessionsByAgent(tenantId, userId, agentId)
  }
  updateSessionData(id: number, data: Record<string, unknown>): void {
    return this.chatSession.updateSessionData(id, data)
  }
  getSessionData(id: number): Record<string, unknown> {
    return this.chatSession.getSessionData(id)
  }
  saveSessionHistory(sessionId: number, messages: unknown[]): void {
    return this.chatSession.saveHistory(sessionId, messages)
  }
  loadSessionHistory(sessionId: number): unknown[] | undefined {
    return this.chatSession.loadHistory(sessionId)
  }
  clearSessionHistory(sessionId: number): void {
    return this.chatSession.clearHistory(sessionId)
  }
  clearSessionHistoryByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): void {
    return this.chatSession.clearHistoryByAgent(tenantId, userId, agentId)
  }

  // ─── Agent Message Raw ────────────────────────────────────────────────────

  insertAgentMessageRaw(input: InsertAgentMessageRawInput): void {
    return this.agentMessageRaw.insert(input)
  }
  listAgentMessageRawBySession(
    sessionId: number,
    limit?: number
  ): AgentMessageRawRow[] {
    return this.agentMessageRaw.listBySession(sessionId, limit)
  }
  deleteAgentMessageRawBySession(sessionId: number): number {
    return this.agentMessageRaw.deleteBySession(sessionId)
  }
  deleteAgentMessageRawByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): number {
    return this.agentMessageRaw.deleteByAgent(tenantId, userId, agentId)
  }

  // ─── MCP ──────────────────────────────────────────────────────────────────

  findAllMcps(
    tenantId: number,
    userId: number,
    onlyEnabled?: boolean
  ): McpRow[] {
    return this.mcp.findAllMcps(tenantId, userId, onlyEnabled)
  }
  findMcpById(id: number): McpRow | undefined {
    return this.mcp.findMcpById(id)
  }
  findMcpByName(
    tenantId: number,
    userId: number,
    name: string
  ): McpRow | undefined {
    return this.mcp.findMcpByName(tenantId, userId, name)
  }
  insertMcp(input: AddMcpInput): McpRow {
    return this.mcp.insertMcp(input)
  }
  updateMcp(id: number, input: UpdateMcpInput): void {
    return this.mcp.updateMcp(id, input)
  }
  deleteMcp(id: number): boolean {
    return this.mcp.deleteMcp(id)
  }

  // ─── Task ────────────────────────────────────────────────────────────────

  findAllTasks(
    tenantId: number,
    userId: number,
    options?: { status?: string; agentId?: number; limit?: number }
  ): ClawTaskRow[] {
    return this.task.findAllTasks(tenantId, userId, options)
  }
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
  ): { items: ClawTaskRow[]; total: number } {
    return this.task.paginateTasks(tenantId, userId, options)
  }
  countTasksByStatus(
    tenantId: number,
    userId: number,
    options?: { projectId?: number }
  ): Record<string, number> {
    return this.task.countTasksByStatus(tenantId, userId, options)
  }
  findTaskById(id: number): ClawTaskRow | undefined {
    return this.task.findTaskById(id)
  }
  insertTask(input: InsertClawTaskInput): ClawTaskRow {
    return this.task.insertTask(input)
  }
  updateTask(id: number, input: UpdateClawTaskInput): void {
    return this.task.updateTask(id, input)
  }
  deleteTask(id: number): boolean {
    return this.task.deleteTask(id)
  }
  updateTaskStatus(
    id: number,
    status: ClawTaskStatus,
    statusRemark?: string | null
  ): void {
    return this.task.updateTaskStatus(id, status, statusRemark)
  }
  findTasksByKeyResultId(
    tenantId: number,
    userId: number,
    keyResultId: number
  ): ClawTaskRow[] {
    return this.task.findTasksByKeyResultId(tenantId, userId, keyResultId)
  }
  findChildTasks(taskId: number): ClawTaskRow[] {
    return this.task.findChildTasks(taskId)
  }
  findDescendants(rootTaskId: number): ClawTaskRow[] {
    return this.task.findDescendants(rootTaskId)
  }
  findDescendantsByRootIds(rootIds: number[]): ClawTaskRow[] {
    return this.task.findDescendantsByRootIds(rootIds)
  }
  getNextChildSort(parentId: number): number {
    return this.task.getNextChildSort(parentId)
  }
  findReadyTasksWithAgent(): ClawTaskRow[] {
    return this.task.findReadyTasksWithAgent()
  }
  isTaskNeedsMet(task: ClawTaskRow): boolean {
    return this.task.isTaskNeedsMet(task)
  }
  checkAndPromoteQueuedChildren(parentId: number): number[] {
    return this.task.checkAndPromoteQueuedChildren(parentId)
  }
  checkAndPromoteQueuedSiblings(completedTaskId: number): number[] {
    return this.task.checkAndPromoteQueuedSiblings(completedTaskId)
  }
  checkAndAutoCompleteParent(taskId: number): void {
    return this.task.checkAndAutoCompleteParent(taskId)
  }

  // ─── Runtime ─────────────────────────────────────────────────────────────

  findAllRuntimes(tenantId: number, userId: number): RuntimeRow[] {
    return this.runtime.findAllRuntimes(tenantId, userId)
  }
  findRuntimeById(id: number): RuntimeRow | undefined {
    return this.runtime.findRuntimeById(id)
  }
  findRuntimeByToken(token: string): RuntimeRow | undefined {
    return this.runtime.findRuntimeByToken(token)
  }
  findRuntimeByName(
    tenantId: number,
    userId: number,
    name: string
  ): RuntimeRow | undefined {
    return this.runtime.findRuntimeByName(tenantId, userId, name)
  }
  insertRuntime(input: AddRuntimeInput): RuntimeRow {
    return this.runtime.insertRuntime(input)
  }
  updateRuntime(id: number, input: UpdateRuntimeInput): void {
    return this.runtime.updateRuntime(id, input)
  }
  setRuntimeStatus(id: number, status: 'online' | 'offline'): void {
    return this.runtime.setRuntimeStatus(id, status)
  }
  resetAllRuntimesToOffline(): void {
    return this.runtime.resetAllRuntimesToOffline()
  }
  setRuntimeRunners(id: number, runners: RunnerInfo[]): void {
    return this.runtime.setRuntimeRunners(id, runners)
  }
  deleteRuntime(id: number): boolean {
    return this.runtime.deleteRuntime(id)
  }

  // ─── Objective ────────────────────────────────────────────────────────────

  findAllObjectives(
    tenantId: number,
    userId: number,
    options?: { projectId?: number }
  ): ObjectiveRow[] {
    return this.objective.findAllObjectives(tenantId, userId, options)
  }
  findObjectiveById(id: number): ObjectiveRow | undefined {
    return this.objective.findObjectiveById(id)
  }
  insertObjective(input: AddObjectiveInput): ObjectiveRow {
    return this.objective.insertObjective(input)
  }
  updateObjective(id: number, input: UpdateObjectiveInput): void {
    return this.objective.updateObjective(id, input)
  }
  deleteObjective(id: number): boolean {
    return this.objective.deleteObjective(id)
  }

  // ─── KeyResult ────────────────────────────────────────────────

  findAllKeyResults(
    tenantId: number,
    userId: number,
    options?: {
      objectiveId?: number
      status?: string
      page?: number
      pageSize?: number
    }
  ): { items: KeyResultRow[]; total: number } {
    return this.objective.findAllKeyResults(tenantId, userId, options)
  }
  findKeyResultsByObjectiveId(objectiveId: number): KeyResultRow[] {
    return this.objective.findKeyResultsByObjectiveId(objectiveId)
  }
  findKeyResultById(id: number): KeyResultRow | undefined {
    return this.objective.findKeyResultById(id)
  }
  insertKeyResult(input: AddKeyResultInput): KeyResultRow {
    return this.objective.insertKeyResult(input)
  }
  updateKeyResult(id: number, input: UpdateKeyResultInput): void {
    return this.objective.updateKeyResult(id, input)
  }
  deleteKeyResult(id: number): boolean {
    return this.objective.deleteKeyResult(id)
  }

  // ─── Objective Focus ──────────────────────────────────────────────────────

  findLatestFocus(
    tenantId: number,
    userId: number
  ): ObjectiveFocusRow | undefined {
    return this.objective.findLatestFocus(tenantId, userId)
  }
  findAllFocuses(
    tenantId: number,
    userId: number,
    limit?: number
  ): ObjectiveFocusRow[] {
    return this.objective.findAllFocuses(tenantId, userId, limit)
  }
  findObjectiveFocusById(id: number): ObjectiveFocusRow | undefined {
    return this.objective.findObjectiveFocusById(id)
  }
  insertObjectiveFocus(input: AddObjectiveFocusInput): ObjectiveFocusRow {
    return this.objective.insertObjectiveFocus(input)
  }
  updateObjectiveFocus(id: number, input: UpdateObjectiveFocusInput): void {
    return this.objective.updateObjectiveFocus(id, input)
  }
  deleteObjectiveFocus(id: number): boolean {
    return this.objective.deleteObjectiveFocus(id)
  }

  // ─── Project ──────────────────────────────────────────────────────────────

  findAllProjects(tenantId: number, userId: number): ProjectRow[] {
    return this.project.findAllProjects(tenantId, userId)
  }
  findProjectById(id: number): ProjectRow | undefined {
    return this.project.findProjectById(id)
  }
  insertProject(input: AddProjectInput): ProjectRow {
    return this.project.insertProject(input)
  }
  updateProject(id: number, input: UpdateProjectInput): void {
    return this.project.updateProject(id, input)
  }
  deleteProject(id: number): boolean {
    return this.project.deleteProject(id)
  }

  // ─── Project Event ────────────────────────────────────────────────────────

  findEventsByProjectId(projectId: number): EventRow[] {
    return this.event.findEventsByProjectId(projectId)
  }
  findEventsByProjectIdAndBiz(
    projectId: number,
    biz: string
  ): EventRow[] {
    return this.event.findEventsByProjectIdAndBiz(projectId, biz)
  }
  findEventsByProjectIdPaginated(
    projectId: number,
    options?: { page?: number; pageSize?: number; type?: string }
  ): { records: EventRow[]; total: number } {
    return this.event.findEventsByProjectIdPaginated(projectId, options)
  }
  findEventTypesByProjectId(projectId: number): string[] {
    return this.event.findEventTypesByProjectId(projectId)
  }
  findEventById(id: number): EventRow | undefined {
    return this.event.findEventById(id)
  }
  findEventByProjectIdAndTitle(
    projectId: number,
    title: string
  ): EventRow | undefined {
    return this.event.findEventByProjectIdAndTitle(projectId, title)
  }
  findEventByShareHash(shareHash: string): EventRow | undefined {
    return this.event.findEventByShareHash(shareHash)
  }
  insertEvent(input: AddEventInput): EventRow {
    return this.event.insertEvent(input)
  }
  updateEvent(id: number, input: UpdateEventInput): void {
    return this.event.updateEvent(id, input)
  }
  deleteEvent(id: number): boolean {
    return this.event.deleteEvent(id)
  }
  deleteEventsByProjectId(projectId: number): void {
    return this.event.deleteEventsByProjectId(projectId)
  }

  // ─── File ──────────────────────────────────────────────────────────────────

  findAllFiles(
    tenantId: number,
    userId: number,
    options?: {
      agentId?: number
      ext?: string
      limit?: number
      offset?: number
    }
  ): FileRow[] {
    return this.file.findAllFiles(tenantId, userId, options)
  }
  findFileById(id: number): FileRow | undefined {
    return this.file.findFileById(id)
  }
  findFileByPath(path: string): FileRow | undefined {
    return this.file.findFileByPath(path)
  }
  insertFile(input: AddFileInput): FileRow {
    return this.file.insertFile(input)
  }
  updateFile(id: number, input: UpdateFileInput): void {
    return this.file.updateFile(id, input)
  }
  deleteFile(id: number): boolean {
    return this.file.deleteFile(id)
  }

  // ─── Project Metric ──────────────────────────────────────────────────────

  findMetricByProjectId(projectId: number): MetricRow[] {
    return this.metric.findMetricByProjectId(projectId)
  }
  findMetricById(id: number): MetricRow | undefined {
    return this.metric.findMetricById(id)
  }
  insertMetric(input: AddMetricInput): MetricRow {
    return this.metric.insertMetric(input)
  }
  updateMetric(id: number, input: UpdateMetricInput): void {
    return this.metric.updateMetric(id, input)
  }
  deleteMetric(id: number): boolean {
    return this.metric.deleteMetric(id)
  }
  deleteMetricByProjectId(projectId: number): void {
    return this.metric.deleteMetricByProjectId(projectId)
  }

  // ─── Project Metric Item ─────────────────────────────────────────────────

  findMetricItems(
    projectId: number,
    options?: { name?: string; startDay?: string; endDay?: string }
  ): MetricItemRow[] {
    return this.metric.findMetricItems(projectId, options)
  }
  upsertMetricItem(input: UpsertMetricItemInput): MetricItemRow {
    return this.metric.upsertMetricItem(input)
  }
  deleteMetricItems(input: DeleteMetricItemInput): void {
    return this.metric.deleteMetricItems(input)
  }

  // ─── Project Backlog ─────────────────────────────────────────────────────────

  findBacklogsByProjectId(
    projectId: number,
    options?: {
      status?: string
      priority?: string
      sortBy?: 'priority' | 'status'
    }
  ): BacklogRow[] {
    return this.backlog.findBacklogsByProjectId(projectId, options)
  }
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
  ): { records: BacklogRow[]; total: number } {
    return this.backlog.paginateBacklogsByProjectId(projectId, options)
  }
  findBacklogTypesByProjectId(projectId: number): string[] {
    return this.backlog.findBacklogTypesByProjectId(projectId)
  }
  findBacklogById(id: number): BacklogRow | undefined {
    return this.backlog.findBacklogById(id)
  }
  findBacklogsBySource(source: string, projectId?: number): BacklogRow[] {
    return this.backlog.findBacklogsBySource(source, projectId)
  }
  insertBacklog(input: AddBacklogInput): BacklogRow {
    return this.backlog.insertBacklog(input)
  }
  updateBacklog(id: number, input: UpdateBacklogInput): void {
    return this.backlog.updateBacklog(id, input)
  }
  deleteBacklog(id: number): boolean {
    return this.backlog.deleteBacklog(id)
  }
  deleteBacklogsByProjectId(projectId: number): void {
    return this.backlog.deleteBacklogsByProjectId(projectId)
  }

  // ─── Project Note ─────────────────────────────────────────────────────────

  findNotesByProjectIdAndBiz(
    projectId: number,
    biz: string
  ): NoteRow[] {
    return this.note.findNotesByProjectIdAndBiz(projectId, biz)
  }
  findNotesByProjectId(
    projectId: number,
    options?: { type?: string }
  ): NoteRow[] {
    return this.note.findNotesByProjectId(projectId, options)
  }
  paginateNotesByProjectId(
    projectId: number,
    options?: {
      type?: string
      keyword?: string
      page?: number
      pageSize?: number
    }
  ): { records: NoteRow[]; total: number } {
    return this.note.paginateNotesByProjectId(projectId, options)
  }
  searchNotes(
    keyword: string,
    options?: { projectId?: number; limit?: number }
  ): NoteRow[] {
    return this.note.searchNotes(keyword, options)
  }
  findNoteTypesByProjectId(projectId: number): string[] {
    return this.note.findNoteTypesByProjectId(projectId)
  }
  findNoteById(id: number): NoteRow | undefined {
    return this.note.findNoteById(id)
  }
  findNoteByShareHash(shareHash: string): NoteRow | undefined {
    return this.note.findNoteByShareHash(shareHash)
  }
  insertNote(input: AddNoteInput): NoteRow {
    return this.note.insertNote(input)
  }
  updateNote(id: number, input: UpdateNoteInput): void {
    return this.note.updateNote(id, input)
  }
  deleteNote(id: number): boolean {
    return this.note.deleteNote(id)
  }
  deleteNotesByProjectId(projectId: number): void {
    return this.note.deleteNotesByProjectId(projectId)
  }

  // ─── Project Wiki ──────────────────────────────────────────────────────────

  findWikisByProjectIdAndBiz(
    projectId: number,
    biz: string
  ): WikiRow[] {
    return this.wiki.findWikisByProjectIdAndBiz(projectId, biz)
  }
  findWikisByProjectId(
    projectId: number,
    options?: { status?: string }
  ): WikiRow[] {
    return this.wiki.findWikisByProjectId(projectId, options)
  }
  findWikiById(id: number): WikiRow | undefined {
    return this.wiki.findWikiById(id)
  }
  searchWikis(
    projectId: number,
    options?: { keyword?: string; limit?: number }
  ): WikiRow[] {
    return this.wiki.searchWikis(projectId, options)
  }
  paginateWikis(
    projectId: number,
    options?: { keyword?: string; page?: number; pageSize?: number }
  ): { records: WikiRow[]; total: number } {
    return this.wiki.paginateWikis(projectId, options)
  }
  findDueSyncWikis(): WikiRow[] {
    return this.wiki.findDueSyncWikis()
  }
  findDueSyncPathWikis(): WikiRow[] {
    return this.wiki.findDueSyncPathWikis()
  }
  findWikisByPathPrefix(projectId: number, syncPath: string): WikiRow[] {
    return this.wiki.findWikisByPathPrefix(projectId, syncPath)
  }
  insertWiki(input: AddWikiInput): WikiRow {
    return this.wiki.insertWiki(input)
  }
  updateWiki(id: number, input: UpdateWikiInput): void {
    return this.wiki.updateWiki(id, input)
  }
  deleteWiki(id: number): boolean {
    return this.wiki.deleteWiki(id)
  }
  deleteWikisByProjectId(projectId: number): void {
    return this.wiki.deleteWikisByProjectId(projectId)
  }

  // ─── Project Wiki Sync Log ────────────────────────────────────────────────

  insertWikiSyncLog(input: InsertWikiSyncLogInput): WikiSyncLogRow {
    return this.wiki.insertWikiSyncLog(input)
  }
  updateWikiSyncLog(id: number, input: UpdateWikiSyncLogInput): void {
    return this.wiki.updateWikiSyncLog(id, input)
  }
  listWikiSyncLogs(wikiId: number, limit?: number): WikiSyncLogRow[] {
    return this.wiki.listWikiSyncLogs(wikiId, limit)
  }
  listAllWikiSyncLogs(
    projectId: number,
    options?: { limit?: number; offset?: number }
  ): WikiSyncLogRow[] {
    return this.wiki.listAllWikiSyncLogs(projectId, options)
  }
  countAllWikiSyncLogs(projectId: number): number {
    return this.wiki.countAllWikiSyncLogs(projectId)
  }

  // ─── Agentic ───────────────────────────────────────────────

  upsertAgentic(input: UpsertAgenticInput): void {
    this.chatSession.upsertAgenticData(input.sessionId, input.data)
  }

  popAgentic(sessionId: number): ChatSessionRow | undefined {
    const data = this.chatSession.getAgenticData(sessionId)
    if (!data) return undefined
    this.chatSession.clearAgenticData(sessionId)
    return this.chatSession.findChatSessionById(sessionId)
  }

  // ─── Agent Workflow ────────────────────────────────────────────────────

  insertAgentWorkflow(input: InsertAgentWorkflowInput): AgentWorkflowRow {
    return this.agentWorkflow.insertWorkflow(input)
  }
  updateAgentWorkflow(id: number, input: UpdateAgentWorkflowInput): void {
    return this.agentWorkflow.updateWorkflow(id, input)
  }
  listAgentWorkflows(
    tenantId: number,
    userId: number,
    agentId?: number,
    sessionId?: number,
    limit?: number
  ): AgentWorkflowRow[] {
    return this.agentWorkflow.listWorkflows(
      tenantId,
      userId,
      agentId,
      sessionId,
      limit
    )
  }
  findAgentWorkflowById(id: number): AgentWorkflowRow | undefined {
    return this.agentWorkflow.findWorkflowById(id)
  }
  insertAgentWorkflowNode(
    input: InsertAgentWorkflowNodeInput
  ): AgentWorkflowNodeRow {
    return this.agentWorkflow.insertWorkflowNode(input)
  }
  updateAgentWorkflowNode(
    id: number,
    input: UpdateAgentWorkflowNodeInput
  ): void {
    return this.agentWorkflow.updateWorkflowNode(id, input)
  }
  listAgentWorkflowNodes(workflowId: number): AgentWorkflowNodeRow[] {
    return this.agentWorkflow.listWorkflowNodes(workflowId)
  }

  insertWorkflowMessage(input: InsertAgentWorkflowMessageInput): void {
    try {
      this.db
        .prepare(
          `INSERT INTO claw_agent_workflow_message (tenant_id, user_id, workflow_id, session_id, message)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          input.tenantId,
          input.userId,
          input.workflowId,
          input.sessionId,
          input.message
        )
    } catch {
      // non-blocking
    }
  }

  listWorkflowMessages(workflowId: number): AgentWorkflowMessageRow[] {
    return this.db
      .prepare(
        `SELECT * FROM claw_agent_workflow_message WHERE workflow_id = ? ORDER BY id ASC`
      )
      .all(workflowId) as AgentWorkflowMessageRow[]
  }

  // ─── Agent Audit ──────────────────────────────────────────────────────────

  insertAgentAudit(input: InsertAgentAuditInput): AgentAuditRow {
    return this.agentAudit.insert(input)
  }
  findAgentAuditById(id: number): AgentAuditRow | undefined {
    return this.agentAudit.findById(id)
  }
  findAgentAuditByIdAndUser(
    id: number,
    userId: number
  ): AgentAuditRow | undefined {
    return this.agentAudit.findByIdAndUser(id, userId)
  }
  updateAgentAudit(id: number, input: UpdateAgentAuditInput): void {
    return this.agentAudit.update(id, input)
  }
  listAgentAudits(
    tenantId: number,
    userId: number,
    options?: {
      agentId?: number
      sessionId?: number
      status?: string
      limit?: number
    }
  ): AgentAuditRow[] {
    return this.agentAudit.list(tenantId, userId, options)
  }

  // ─── Agent Tool ───────────────────────────────────────────────────────────

  insertAgentTool(input: InsertAgentToolInput): AgentToolRow {
    return this.agentTool.insert(input)
  }
  updateAgentTool(id: number, input: UpdateAgentToolInput): void {
    return this.agentTool.update(id, input)
  }
  appendAgentToolLog(toolCallId: string, line: string): void {
    return this.agentTool.appendLog(toolCallId, line)
  }
  findAgentToolByCallId(toolCallId: string): AgentToolRow | undefined {
    return this.agentTool.findByToolCallId(toolCallId)
  }
  listAgentTools(
    tenantId: number,
    userId: number,
    options?: { agentId?: number; sessionId?: number; limit?: number }
  ): AgentToolRow[] {
    return this.agentTool.list(tenantId, userId, options)
  }

  // ─── Task Logs ───────────────────────────────────────────────────────────

  appendTaskLog(id: number, entry: string): void {
    return this.task.appendTaskLog(id, entry)
  }
  clearTaskLogs(id: number): void {
    return this.task.clearTaskLogs(id)
  }
  hasRunningTaskForProject(projectId: number): boolean {
    return this.task.hasRunningTaskForProject(projectId)
  }
  hasRunningTaskForAgent(agentId: number): boolean {
    return this.task.hasRunningTaskForAgent(agentId)
  }
}

export const clawDb: IClawStore = new SqliteClawStoreImpl()
