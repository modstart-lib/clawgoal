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
