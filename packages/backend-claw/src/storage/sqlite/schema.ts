/**
 * Claw SQLite 数据库 DDL 入口
 * 所有表的前三列均为 id, created_at, updated_at
 *
 * 表结构详见各子文件 schema/<table>.ts：
 *   agent              — claw_agent                Agent 实例持久化
 *   agent_workflow     — claw_agent_workflow        Agent 执行 workflow 全程记录
 *   agent_workflow_node — claw_agent_workflow_node  Agent workflow 单节点执行记录
 *   channel            — claw_channel               系统对接的消息渠道（Telegram / 飞书等）
 *   cron               — claw_cron                  定时任务配置
 *   cron_log           — claw_cron_log              定时任务执行日志
 *   agent_message      — claw_agent_message         对话消息
 *   agent_message_raw  — claw_agent_message_raw     模型对话原始消息
 *   agent_session      — claw_agent_session         对话会话（含 agentic_data 暂停状态）
 *   task               — claw_task                  Agent 任务
 *   runtime            — claw_runtime               远程设备运行环境
 *   mcp                — claw_mcp                   MCP 服务配置
 *   objective_project  — claw_objective_project     目标项目
 *   objective_item     — claw_objective_item        目标条目
 *   objective_focus    — claw_objective_focus       当前聚焦
 *   project            — claw_project               项目管理
 *   project_event      — claw_event                 项目事件
 *   project_metric     — claw_metric                项目指标定义
 *   project_metric_item — claw_metric_item         项目指标数据条目
 *   project_backlog    — claw_backlog               项目需求池
 *   project_note       — claw_note                  项目笔记（Markdown）
 *   project_wiki       — claw_wiki                  项目知识库
 *   project_wiki_sync_log — claw_wiki_sync_log      项目知识库同步日志
 *   file               — claw_file                  文件管理
 *   env                — (已迁移至 base/schema/env，由 SqliteEnvStore 管理)
 */

import { createAgent } from './schema/agent'
import { createAgentWorkflow } from './schema/agentWorkflow'
import { createAgentWorkflowNode } from './schema/agentWorkflowNode'
import { createAgentWorkflowMessage } from './schema/agentWorkflowMessage'
import { createAgentMemory } from './schema/agentMemory'
import { createChannel } from './schema/channel'
import { createAgentMessage } from './schema/agentMessage'
import { createAgentMessageRaw } from './schema/agentMessageRaw'
import { createAgentSession } from './schema/agentSession'
import { createRuntime } from './schema/runtime'
import { createCron } from './schema/cron'
import { createCronLog } from './schema/cronLog'
import { createFile } from './schema/file'
import { createMcp } from './schema/mcp'
import { createObjective } from './schema/objective'
import { createKeyResult } from './schema/keyResult'
import { createProject } from './schema/project'
import { createEvent } from './schema/event'
import { createMetric } from './schema/metric'
import { createMetricItem } from './schema/metricItem'
import { createNote } from './schema/note'
import { createBacklog } from './schema/backlog'
import { createWiki } from './schema/wiki'
import { createWikiSyncLog } from './schema/wikiSyncLog'
import { createTask } from './schema/task'
import { createAgentAudit } from './schema/agentAudit'
import { createAgentTool } from './schema/agentTool'

const RAW_INIT_SQL = [
  createAgent(),
  createAgentWorkflow(),
  createAgentWorkflowNode(),
  createAgentWorkflowMessage(),
  createChannel(),
  createCron(),
  createCronLog(),
  createAgentMessage(),
  createAgentMessageRaw(),
  createAgentSession(),
  createTask(),
  createRuntime(),
  createMcp(),
  createObjective(),
  createKeyResult(),
  createProject(),
  createEvent(),
  createMetric(),
  createMetricItem(),
  createFile(),
  createBacklog(),
  createNote(),
  createWiki(),
  createWikiSyncLog(),
  createAgentMemory(),
  createAgentAudit(),
  createAgentTool(),
].join('\n')

/** 直接返回原始 SQL，表名不加任何前缀。 */
export function buildInitSql(): string {
  return RAW_INIT_SQL
}
