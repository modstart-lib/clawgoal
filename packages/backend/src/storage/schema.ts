/**
 * storage/schema.ts
 * 所有模块可引用的通用基础 — 再导出 sqlite 与 mysql 全部 schema DDL
 */

// SQLite DDL
export {
  createAgentTask,
  createApiToken,
  createEnv,
  createNotice,
  createParam,
  createSetting,
} from './sqlite/schema.js'

// MySQL DDL
export {
  createAgentTask as createMysqlAgentTask,
  createAgentTaskFile as createMysqlAgentTaskFile,
  createAgentTaskLog as createMysqlAgentTaskLog,
  createAgentTaskMsg as createMysqlAgentTaskMsg,
  createApiToken as createMysqlApiToken,
  createEnv as createMysqlEnv,
  createNotice as createMysqlNotice,
  createNoticeLog as createMysqlNoticeLog,
  createParam as createMysqlParam,
  createSetting as createMysqlSetting,
} from './mysql/schema.js'
