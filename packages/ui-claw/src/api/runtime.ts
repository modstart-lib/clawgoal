import apiClient from './client'

export interface RunnerInfo {
  name: string
  title: string
  /** 工具本身的可用状态（如是否已登录授权），由运行环境客户端上报 */
  status?: string
  /** 是否启用，由用户在界面上控制 */
  enable?: boolean
}

export interface RuntimeRow {
  id: number
  created_at: string
  updated_at: string
  name: string
  title: string
  token: string
  status: string
  active_at: string | null
  /** JSON 字符串解析后的 runner 列表，null=未同步 */
  runners: RunnerInfo[] | null
}

export const getRuntimeList = async (): Promise<RuntimeRow[]> => {
  const res = await apiClient.post('/claw/runtime/list')
  return res.data.data || []
}

export const addRuntime = async (data: {
  name: string
  title: string
  token: string
}): Promise<RuntimeRow> => {
  const res = await apiClient.post('/claw/runtime/add', data)
  return res.data.data
}

export const updateRuntime = async (data: {
  id: number
  title?: string
  token?: string
}): Promise<RuntimeRow> => {
  const res = await apiClient.post('/claw/runtime/edit', data)
  return res.data.data
}

export const deleteRuntime = async (id: number): Promise<void> => {
  await apiClient.post('/claw/runtime/delete', { id })
}

export const setRunnerEnable = async (data: {
  id: number
  name: string
  enable: boolean
}): Promise<RuntimeRow> => {
  const res = await apiClient.post('/claw/runtime/runner/setEnable', data)
  return res.data.data
}

export const requestRuntimeSync = async (
  id: number
): Promise<{ sent: boolean }> => {
  const res = await apiClient.post('/claw/runtime/requestSync', { id })
  return res.data.data
}
