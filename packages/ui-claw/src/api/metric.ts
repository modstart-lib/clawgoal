import apiClient from './client'

// ─── Metric Definition ────────────────────────────────────────────────────────

export interface MetricItem {
  id: number
  projectId: number
  name: string
  title: string
  sort: number
  remark: string | null
  summaryMode: string
  createdAt: string
}

// ─── Metric Data Item ─────────────────────────────────────────────────────────

export interface MetricDataItem {
  id: number
  projectId: number
  day: string
  name: string
  value: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

// ─── Metric Summary ───────────────────────────────────────────────────────────

export interface MetricSummaryItem {
  id: number
  name: string
  title: string
  sum: number
  avg: number
  latest: number
  latestDay: string
  count: number
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export const listMetric = async (projectId: number): Promise<MetricItem[]> => {
  const res = await apiClient.post('/claw/metric/list', { projectId })
  return res.data.data?.records || []
}

export const addMetric = async (data: {
  projectId: number
  name: string
  title: string
  sort?: number
  remark?: string
  summaryMode?: string
}): Promise<MetricItem> => {
  const res = await apiClient.post('/claw/metric/add', data)
  return res.data.data?.record
}

export const editMetric = async (
  id: number,
  data: {
    title?: string
    sort?: number
    remark?: string | null
    summaryMode?: string
  }
): Promise<MetricItem> => {
  const res = await apiClient.post('/claw/metric/edit', { id, ...data })
  return res.data.data?.record
}

export const deleteMetric = async (id: number): Promise<void> => {
  await apiClient.post('/claw/metric/delete', { id })
}

export const listMetricItems = async (params: {
  projectId: number
  name?: string
  startDay?: string
  endDay?: string
}): Promise<MetricDataItem[]> => {
  const res = await apiClient.post('/claw/metric/item/list', params)
  return res.data.data?.records || []
}

export const upsertMetricItem = async (data: {
  projectId: number
  day: string
  name: string
  value: number
  remark?: string | null
}): Promise<MetricDataItem> => {
  const res = await apiClient.post('/claw/metric/item/upsert', data)
  return res.data.data?.record
}

export const batchUpsertMetricItems = async (
  items: Array<{
    projectId: number
    day: string
    name: string
    value: number
  }>
): Promise<MetricDataItem[]> => {
  const res = await apiClient.post('/claw/metric/item/batch', { items })
  return res.data.data?.records || []
}

export const deleteMetricItems = async (params: {
  projectId: number
  day?: string
  name?: string
}): Promise<void> => {
  await apiClient.post('/claw/metric/item/delete', params)
}

export const getMetricSummary = async (params: {
  projectId: number
  startDay?: string
  endDay?: string
}): Promise<MetricSummaryItem[]> => {
  const res = await apiClient.post('/claw/metric/item/summary', params)
  return res.data.data?.summary || []
}
