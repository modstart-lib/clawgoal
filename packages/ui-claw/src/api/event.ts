import apiClient from './client'

export interface ProjectEvent {
  id: number
  projectId: number
  biz: string
  title: string
  description: string
  day: string
  dueAt?: string | null
  type: string
  meta: Record<string, unknown> | null
  shareHash: string | null
  createdAt: string
}

export const addEvent = async (data: {
  projectId: number
  title: string
  biz?: string
  description?: string
  day?: string
  type?: string
  meta?: Record<string, unknown> | null
}): Promise<ProjectEvent> => {
  const res = await apiClient.post('/claw/event/add', data)
  return res.data.data?.record
}

export const editEvent = async (
  id: number,
  data: {
    title?: string
    biz?: string
    description?: string
    day?: string
    type?: string
    meta?: Record<string, unknown> | null
  }
): Promise<ProjectEvent> => {
  const res = await apiClient.post('/claw/event/edit', { id, ...data })
  return res.data.data?.record
}

export const deleteEvent = async (id: number): Promise<void> => {
  await apiClient.post('/claw/event/delete', { id })
}

export const listEvents = async (
  projectId: number,
  options?: {
    page?: number
    pageSize?: number
    type?: string
    keyword?: string
  }
): Promise<{ records: ProjectEvent[]; total: number }> => {
  const res = await apiClient.post('/claw/event/list', {
    projectId,
    ...options,
  })
  return res.data.data || { records: [], total: 0 }
}

export const listEventTypes = async (projectId: number): Promise<string[]> => {
  const res = await apiClient.post('/claw/event/types', { projectId })
  return res.data.data?.types || []
}

export const getEventByTitle = async (
  projectId: number,
  title: string
): Promise<ProjectEvent | null> => {
  const res = await apiClient.post('/claw/event/getByTitle', {
    projectId,
    title,
  })
  return res.data.data?.record || null
}

// ─── Event 分享 ───────────────────────────────────────────────────────────────

export const shareEvent = async (id: number): Promise<string> => {
  const res = await apiClient.post('/claw/event/share', { id })
  const data = res.data.data
  if (data?.shareUrl) return data.shareUrl
  // Fallback: construct URL from hash (backward compat)
  if (data?.shareHash) {
    return `${window.location.origin}/claw/event/share/${id}_${data.shareHash}`
  }
  return ''
}

export const unshareEvent = async (id: number): Promise<void> => {
  await apiClient.post('/claw/event/unshare', { id })
}

export const getSharedEvent = async (
  id: number,
  hash: string
): Promise<ProjectEvent | null> => {
  const res = await apiClient.get(`/claw/event/share/${id}_${hash}`)
  return res.data.data?.record || null
}
