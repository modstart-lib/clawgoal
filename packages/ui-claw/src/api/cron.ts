import apiClient from './client'

/** 与后端 CronConfig 保持一致 */
export interface CronConfig {
  /** shell: 直接运行命令；agent: 发送给 Agent Agent */
  type: 'shell' | 'agent'
  /** type=shell 时的 shell 命令 */
  shell?: string
  /** type=shell 时的工作目录（可选） */
  workdir?: string
  /** type=agent 时发送给 Agent 的指令 */
  agent?: string
}

export interface CronTask {
  id: number
  /** 任务名称（后端 title，API 层转成 name） */
  name: string
  cron: string
  /** 执行配置（type=shell|agent） */
  config: CronConfig | null
  description?: string
  status: 'enabled' | 'disabled'
  agentId?: string
  lastRun?: string
  nextRun?: string
  lastResult?: string
  /** 成功时是否发送消息通知，默认 false */
  successNotify: boolean
  /** 当前是否正在执行 */
  isRunning?: boolean
  createdAt: string
}

export interface CronLog {
  id: number
  time: string
  success: boolean
  message: string
  /** 运行中、成功、失败 */
  status?: 'running' | 'success' | 'error'
}

export interface CronHistoryLog {
  id: number
  taskName: string
  time: string
  success: boolean
  message: string
  agentId?: string
  /** Execution result summary (may be long) */
  result?: string
  /** Raw execution logs */
  logs?: string
}

export interface AddCronTaskInput {
  name: string
  cron: string
  /** 执行配置 */
  config: CronConfig
  description?: string
  agentId?: string
  enable?: boolean
  /** 成功时是否发送消息通知，默认 false */
  successNotify?: boolean
}

export const listCronTasks = async (): Promise<CronTask[]> => {
  const res = await apiClient.post('/claw/cron/list')
  return res.data.data || []
}

export const addCronTask = async (
  data: AddCronTaskInput
): Promise<CronTask> => {
  const res = await apiClient.post('/claw/cron/add', data)
  return res.data.data
}

export const updateCronTask = async (
  id: number,
  data: Partial<AddCronTaskInput>
): Promise<CronTask> => {
  const res = await apiClient.post('/claw/cron/update', { id, ...data })
  return res.data.data
}

export const deleteCronTask = async (id: number): Promise<void> => {
  await apiClient.post('/claw/cron/delete', { id })
}

export const toggleCronTask = async (
  id: number,
  enable: boolean
): Promise<CronTask> => {
  const res = await apiClient.post('/claw/cron/toggle', { id, enable })
  return res.data.data
}

export const runCronTaskNow = async (id: number): Promise<void> => {
  await apiClient.post('/claw/cron/run', { id })
}

export const getCronLogs = async (
  id: number,
  options?: { limit?: number; startTime?: string; endTime?: string }
): Promise<CronLog[]> => {
  const res = await apiClient.post('/claw/cron/logs', { id, ...options })
  return res.data.data || []
}

export const getCronStat = async (): Promise<{ totalRunCount: number }> => {
  const res = await apiClient.post('/claw/cron/stat')
  return res.data.data
}

export const getCronHistory = async (
  agentId?: string,
  limit = 50
): Promise<CronHistoryLog[]> => {
  const res = await apiClient.post('/claw/cron/history', { agentId, limit })
  return res.data.data || []
}

export const deleteCronHistory = async (id: number): Promise<void> => {
  await apiClient.post('/claw/cron/history/delete', { id })
}

export const paginateCronHistory = async (params: {
  page: number
  pageSize: number
  agentId?: string
  startDate?: string
  endDate?: string
}): Promise<{ records: CronHistoryLog[]; total: number }> => {
  const res = await apiClient.post('/claw/cron/history/paginate', params)
  return res.data.data
}

export interface CronLiveLog {
  isRunning: boolean
  content: string | null
  type: 'shell' | 'agent' | null
}

export const getCronLiveLog = async (id: number): Promise<CronLiveLog> => {
  const res = await apiClient.post('/claw/cron/log/live', { id })
  return res.data.data
}
