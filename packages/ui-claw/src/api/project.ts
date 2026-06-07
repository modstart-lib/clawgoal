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

export interface ProjectItem {
  id: number
  title: string
  description: string
  status: 'planning' | 'active' | 'paused' | 'done'
  color: string
  logo: string
  startAt: string
  dueAt: string
  meta: Record<string, unknown> | null
  events: ProjectEvent[]
  noteCount: number
  pendingTodoCount: number
  backlogCount: number
  wikiCount: number
  objectiveCount: number
  taskCount: number
  agentCount: number
  createdAt: string
}

export const listProjects = async (): Promise<ProjectItem[]> => {
  const res = await apiClient.post('/claw/project/list')
  return res.data.data?.records || []
}

export const getProject = async (id: number): Promise<ProjectItem> => {
  const res = await apiClient.post('/claw/project/detail', { id })
  return res.data.data?.record
}

export const addProject = async (data: {
  title: string
  description?: string
  status?: string
  color?: string
  logo?: string
  startAt?: string
  dueAt?: string
  meta?: Record<string, unknown> | null
}): Promise<ProjectItem> => {
  const res = await apiClient.post('/claw/project/add', data)
  return res.data.data?.record
}

export const editProject = async (
  id: number,
  data: {
    title?: string
    description?: string
    status?: string
    color?: string
    logo?: string
    startAt?: string
    dueAt?: string
    meta?: Record<string, unknown> | null
  }
): Promise<ProjectItem> => {
  const res = await apiClient.post('/claw/project/edit', { id, ...data })
  return res.data.data?.record
}

export const deleteProject = async (id: number): Promise<void> => {
  await apiClient.post('/claw/project/delete', { id })
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

export const getProjectSummaryMarkdown = async (
  id: number
): Promise<string> => {
  const res = await apiClient.post('/claw/project/summary', { id })
  return res.data.data?.summary || ''
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

// ─── ProjectLead ──────────────────────────────────────────────────────────────

export interface ProjectLead {
  id: number
  projectId: number
  name: string
  status: 'new' | 'contacted' | 'qualified' | 'lost'
  source?: string
  contact?: string
  note?: string
  date?: string
  createdAt: string
}

export const listProjectLeads = async (
  projectId: number
): Promise<ProjectLead[]> => {
  const res = await apiClient.post('/claw/project/lead/list', { projectId })
  return res.data.data?.records || []
}

export const addProjectLead = async (data: {
  projectId: number
  name: string
  status?: ProjectLead['status']
  source?: string
  contact?: string
  note?: string
  date?: string
}): Promise<ProjectLead> => {
  const res = await apiClient.post('/claw/project/lead/add', data)
  return res.data.data?.record
}

export const editProjectLead = async (
  id: number,
  data: {
    name?: string
    status?: ProjectLead['status']
    source?: string
    contact?: string
    note?: string
    date?: string
  }
): Promise<ProjectLead> => {
  const res = await apiClient.post('/claw/project/lead/edit', { id, ...data })
  return res.data.data?.record
}

export const deleteProjectLead = async (id: number): Promise<void> => {
  await apiClient.post('/claw/project/lead/delete', { id })
}

// ─── Event 分享 ──────────────────────────────────────────────────────────────

export const shareEvent = async (id: number): Promise<string> => {
  const res = await apiClient.post('/claw/event/share', { id })
  return res.data.data?.shareHash
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
