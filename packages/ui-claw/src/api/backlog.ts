import apiClient from './client'

export type BacklogStatus = 'pending' | 'active' | 'pool' | 'dropped' | 'done'
export type BacklogPriority = 'high' | 'medium' | 'low'

export interface BacklogItem {
  id: number
  projectId: number
  title: string
  status: BacklogStatus
  priority: BacklogPriority
  type: string
  dueAt: string
  source: string
  reason: string
  activeAt: string
  doneAt: string
  detail: string
  meta: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export const listBacklog = async (
  projectId: number,
  options?: {
    status?: BacklogStatus
    priority?: BacklogPriority
    sortBy?: 'status' | 'priority'
  }
): Promise<BacklogItem[]> => {
  const res = await apiClient.post('/claw/backlog/list', {
    projectId,
    ...options,
  })
  return res.data.data?.records || []
}

export const paginateBacklog = async (
  projectId: number,
  options: {
    page: number
    pageSize: number
    status?: BacklogStatus
    priority?: BacklogPriority
    type?: string
    keyword?: string
    sortBy?: 'status' | 'priority'
  }
): Promise<{ records: BacklogItem[]; total: number }> => {
  const res = await apiClient.post('/claw/backlog/paginate', {
    projectId,
    ...options,
  })
  return {
    records: res.data.data?.records || [],
    total: res.data.data?.total ?? 0,
  }
}

export const listBacklogTypes = async (
  projectId: number
): Promise<string[]> => {
  const res = await apiClient.post('/claw/backlog/types', { projectId })
  return res.data.data?.types || []
}

export const addBacklog = async (data: {
  projectId: number
  title: string
  status?: BacklogStatus
  priority?: BacklogPriority
  type?: string
  source?: string
  reason?: string
  detail?: string
  dueAt?: string
  meta?: Record<string, unknown> | null
}): Promise<BacklogItem> => {
  const res = await apiClient.post('/claw/backlog/add', data)
  return res.data.data?.record
}

export const editBacklog = async (
  id: number,
  data: {
    title?: string
    status?: BacklogStatus
    priority?: BacklogPriority | null
    type?: string | null
    source?: string | null
    reason?: string | null
    detail?: string | null
    dueAt?: string | null
    meta?: Record<string, unknown> | null
  }
): Promise<BacklogItem> => {
  const res = await apiClient.post('/claw/backlog/edit', {
    id,
    ...data,
  })
  return res.data.data?.record
}

export const deleteBacklog = async (id: number): Promise<void> => {
  await apiClient.post('/claw/backlog/delete', { id })
}

export const updateBacklogStatus = async (
  id: number,
  status: BacklogStatus,
  reason?: string
): Promise<BacklogItem> => {
  const res = await apiClient.post('/claw/backlog/status', {
    id,
    status,
    reason,
  })
  return res.data.data?.record
}

export const getBacklogBySource = async (
  source: string,
  projectId?: number
): Promise<BacklogItem[]> => {
  const res = await apiClient.post('/claw/backlog/getBySource', {
    source,
    ...(projectId !== undefined ? { projectId } : {}),
  })
  return res.data.data?.records || []
}
