import apiClient from './client'
import type { Task } from './task'

export type ObjectiveStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
export type KeyResultStatus = 'running' | 'done' | 'canceled'

export interface Objective {
  id: number
  title: string
  description: string
  status: ObjectiveStatus
  icon: string
  result: string
  projectId: number | null
  startAt: string
  endAt: string
  dueAt: string
  createdAt: string
}

export interface KeyResult {
  id: number
  objectiveId: number
  title: string
  detail: string
  sourceProjectBacklogId: number | null
  status: KeyResultStatus
  dueAt: string
  estimatedHours: number | null
  createdAt: string
}
// ─── Objective ────────────────────────────────────────────────────────────────

export const listObjectives = async (params?: {
  status?: string
  projectId?: number
}): Promise<Objective[]> => {
  const res = await apiClient.post('/claw/objective/list', params || {})
  return res.data.data?.records || []
}

export const addObjective = async (data: {
  title: string
  description?: string
  status?: string
  icon?: string
  projectId: number
  startAt?: string
  endAt?: string
  dueAt?: string
}): Promise<Objective> => {
  const res = await apiClient.post('/claw/objective/add', data)
  return res.data.data?.record
}

export const editObjective = async (
  id: number,
  data: {
    title?: string
    description?: string
    status?: string
    icon?: string
    result?: string
    projectId?: number | null
    startAt?: string | null
    endAt?: string | null
    dueAt?: string | null
  }
): Promise<Objective> => {
  const res = await apiClient.post('/claw/objective/edit', { id, ...data })
  return res.data.data?.record
}

export const deleteObjective = async (id: number): Promise<void> => {
  await apiClient.post('/claw/objective/delete', { id })
}

export interface GeneratedObjective {
  title: string
  description: string
  icon: string
  status: ObjectiveStatus
  dueAt: string
}

export const generateObjective = async (data: {
  projectId?: number
  userPrompt?: string
}): Promise<GeneratedObjective> => {
  const res = await apiClient.post('/claw/objective/generate', data)
  return res.data.data?.objective
}

export interface GeneratedKeyResult {
  title: string
  detail: string
  dueAt: string
  estimatedHours: number
}

export const generateKeyResult = async (data: {
  objectiveId: number
}): Promise<GeneratedKeyResult> => {
  const res = await apiClient.post('/claw/objective/keyResult/generate', data)
  return res.data.data?.keyResult
}

export const batchGenerateKeyResults = async (data: {
  objectiveId: number
  userPrompt?: string
}): Promise<GeneratedKeyResult[]> => {
  const res = await apiClient.post(
    '/claw/objective/keyResult/batchGenerate',
    data
  )
  return res.data.data?.keyResults || []
}

// ─── ObjectiveKeyResult ───────────────────────────────────────────────────────────────────

export const listObjectiveKeyResults = async (params: {
  objectiveId?: number
  status?: string
  page?: number
  pageSize?: number
}): Promise<{ records: KeyResult[]; total: number }> => {
  const res = await apiClient.post('/claw/objective/keyResult/list', params)
  return {
    records: res.data.data?.records || [],
    total: res.data.data?.total || 0,
  }
}

export const addObjectiveKeyResult = async (data: {
  objectiveId: number
  title: string
  detail?: string
  sourceProjectBacklogId?: number
  status?: string
  dueAt?: string
  estimatedHours?: number
}): Promise<KeyResult> => {
  const res = await apiClient.post('/claw/objective/keyResult/add', data)
  return res.data.data?.record
}

export const editObjectiveKeyResult = async (
  id: number,
  data: {
    title?: string
    detail?: string
    sourceProjectBacklogId?: number | null
    status?: string
    dueAt?: string | null
    estimatedHours?: number | null
  }
): Promise<KeyResult> => {
  const res = await apiClient.post('/claw/objective/keyResult/edit', {
    id,
    ...data,
  })
  return res.data.data?.record
}

export const deleteObjectiveKeyResult = async (id: number): Promise<void> => {
  await apiClient.post('/claw/objective/keyResult/delete', { id })
}

export const getActionTasks = async (keyResultId: number): Promise<Task[]> => {
  const res = await apiClient.post('/claw/objective/keyResult/tasks', {
    keyResultId,
  })
  return res.data.data?.records || []
}

export const decomposeAction = async (
  keyResultId: number
): Promise<{ taskId: number; message: string }> => {
  const res = await apiClient.post('/claw/objective/keyResult/decompose', {
    keyResultId,
  })
  return res.data.data
}

// ─── Setting ──────────────────────────────────────────────────────────────────

export const getObjectiveSetting = async (): Promise<{
  goal: string
  style: string
}> => {
  const res = await apiClient.post('/claw/objective/setting/get')
  return res.data.data || { goal: '', style: 'balanced' }
}

export const saveObjectiveSetting = async (data: {
  goal?: string
  style?: string
}): Promise<void> => {
  await apiClient.post('/claw/objective/setting/save', data)
}

// ─── KeyResult aliases (new names for ObjectiveKeyResult functions) ──────────────────
export const listKeyResults = listObjectiveKeyResults
export const addKeyResult = addObjectiveKeyResult
export const editKeyResult = editObjectiveKeyResult
export const deleteKeyResult = deleteObjectiveKeyResult
