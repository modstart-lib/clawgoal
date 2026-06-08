import apiClient from './client'

export interface ModelStatRecord {
  provider: string | null
  model: string
  callCount: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  avgDurationMs: number
  errorCount: number
}

export interface ModelDailyStatRecord {
  date: string
  provider: string | null
  model: string
  callCount: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
}

export interface ModelHourlyStatRecord {
  hour: string
  provider: string | null
  model: string
  callCount: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
}

export interface ModelStat {
  id: string
  name: string
  provider: string
  modelId: string
  calls: number
  inputTokens: number
  outputTokens: number
}

export interface ModelLogRecord {
  id: number
  createdAt: string
  name: string | null
  provider: string | null
  model: string
  biz: string | null
  bizId: string | null
  status: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  durationMs: number
  messageCount: number
  error: string | null
  requestBody: string | null
  responseBody: string | null
}

export interface ModelLogsResult {
  records: ModelLogRecord[]
  page: number
  pageSize: number
  total: number
}

export const getModelLogs = async (params: {
  page?: number
  pageSize?: number
  biz?: string
  bizId?: string
  startAt?: string
  endAt?: string
}): Promise<ModelLogsResult> => {
  const response = await apiClient.post('/setting/model/logs', params)
  return response.data.data
}

export const getModelLogBizValues = async (): Promise<string[]> => {
  const response = await apiClient.post('/setting/model/logBizValues', {})
  return response.data.data.values
}

export const getModelStats = async (
  startAt?: string,
  endAt?: string
): Promise<ModelStatRecord[]> => {
  const response = await apiClient.post('/setting/model/stats', {
    startAt,
    endAt,
  })
  return response.data.data.records
}

export const getModelDailyStats = async (params: {
  startAt?: string
  endAt?: string
  provider?: string
  model?: string
}): Promise<ModelDailyStatRecord[]> => {
  const response = await apiClient.post('/setting/model/dailyStats', params)
  return response.data.data.records
}

export const getModelHourlyStats = async (params: {
  startAt?: string
  endAt?: string
  provider?: string
  model?: string
}): Promise<ModelHourlyStatRecord[]> => {
  const response = await apiClient.post('/setting/model/hourlyStats', params)
  return response.data.data.records
}
