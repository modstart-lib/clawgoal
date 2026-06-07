/**
 * 统一存储层入口
 */

export { settingDb } from './store/base.js'
export type { ISettingStore, SettingRow } from './store/base.js'

export { agentTaskDb } from './store/agentTask.js'
export type {
  AgentTaskFileRow,
  AgentTaskLogRow,
  AgentTaskMsgRow,
  AgentTaskRow,
  CreateAgentTaskFileInput,
  CreateAgentTaskInput,
  CreateAgentTaskLogInput,
  CreateAgentTaskMsgInput,
  IAgentTaskStore,
  UpdateAgentTaskFileInput,
  UpdateAgentTaskInput,
} from './store/agentTask.js'
