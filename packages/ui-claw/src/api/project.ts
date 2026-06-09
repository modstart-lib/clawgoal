import apiClient from './client'
import type { ProjectEvent } from './event'

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

export const getProjectSummaryMarkdown = async (
  id: number
): Promise<string> => {
  const res = await apiClient.post('/claw/project/summary', { id })
  return res.data.data?.summary || ''
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
