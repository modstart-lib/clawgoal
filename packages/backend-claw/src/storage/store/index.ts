/**
 * Claw 存储层入口
 * 导出通用接口 IClawStore、所有数据类型，以及当前使用的存储单例 clawDb。
 *
 * 若需切换存储后端，只需替换此处的实现即可，上层代码无需任何改动。
 */

// ─── 数据类型（所有后端通用） ───────────────────────────────────────────────

export type {
  AddKeyResultInput,
  AddObjectiveFocusInput,
  AddObjectiveInput,
  KeyResultRow,
  KeyResultStatus,
  ObjectiveFocusRow,
  ObjectiveRow,
  UpdateKeyResultInput,
  UpdateObjectiveFocusInput,
  UpdateObjectiveInput,
} from './objective.js'

export type {
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
  AgentMemoryRow,
  AgentRow,
  ChannelConfig,
  ChannelRow,
  ChannelStatus,
  ChannelType,
  AgentMessageAsk,
  AgentMessageContent,
  AgentMessageRow,
  CronLogRow,
  CronRow,
  CronStatus,
  DeleteMetricItemInput,
  RunnerInfo,
  FileRow,
  HttpMcpConfig,
  InsertAgentMessageInput,
  InsertCronLogInput,
  McpConfig,
  McpRow,
  McpType,
  RuntimeRow,
  RuntimeStatus,
  OptionRow,
  BacklogPriority,
  BacklogRow,
  EventRow,
  MetricItemRow,
  MetricRow,
  NoteRow,
  ProjectRow,
  ProjectStatus,
  StdioMcpConfig,
  UpdateAgentInput,
  UpdateAgentMemoryInput,
  UpdateChannelInput,
  UpdateCronInput,
  UpdateFileInput,
  UpdateMcpInput,
  UpdateRuntimeInput,
  UpdateBacklogInput,
  UpdateEventInput,
  UpdateProjectInput,
  UpdateMetricInput,
  UpdateNoteInput,
  UpsertMetricItemInput,
} from './types.js'

// ─── 通用存储接口 ───────────────────────────────────────────────────────────

export type { IClawStore } from './store.js'

// ─── AgentSession 类型 ──────────────────────────────────────────────────────

export type {
  AgentSessionRow,
  InsertAgentSessionInput,
  UpdateAgentSessionInput,
} from './agentSession.js'

// ─── AgentTool 类型 ─────────────────────────────────────────────────────────

export type {
  AgentToolRow,
  AgentToolStatus,
  InsertAgentToolInput,
  UpdateAgentToolInput,
} from './agentTool.js'

// ─── 存储单例（当前使用 SQLite 实现） ──────────────────────────────────────

export { clawDb } from '../sqlite/store/index.js'
