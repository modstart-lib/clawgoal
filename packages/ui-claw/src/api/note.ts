import apiClient from './client'

export interface Note {
  id: number
  projectId: number
  biz: string
  type: string
  title: string
  content: string
  meta: Record<string, unknown> | null
  shareHash: string | null
  createdAt: string
  updatedAt: string
}

export const listNotes = async (
  projectId: number,
  options?: { type?: string }
): Promise<Note[]> => {
  const res = await apiClient.post('/claw/note/list', {
    projectId,
    ...options,
  })
  return res.data.data?.records || []
}

export const paginateNotes = async (
  projectId: number,
  options?: {
    type?: string
    keyword?: string
    page?: number
    pageSize?: number
  }
): Promise<{ records: Note[]; total: number }> => {
  const res = await apiClient.post('/claw/note/paginate', {
    projectId,
    ...options,
  })
  return {
    records: res.data.data?.records || [],
    total: res.data.data?.total || 0,
  }
}

export const listNoteTypes = async (projectId: number): Promise<string[]> => {
  const res = await apiClient.post('/claw/note/types', { projectId })
  return res.data.data?.types || []
}

export const addNote = async (data: {
  projectId: number
  title: string
  biz?: string
  type?: string
  content?: string
  meta?: Record<string, unknown> | null
}): Promise<Note> => {
  const res = await apiClient.post('/claw/note/add', data)
  return res.data.data?.record
}

export const editNote = async (
  id: number,
  data: {
    title?: string
    biz?: string
    type?: string
    content?: string
    meta?: Record<string, unknown> | null
  }
): Promise<Note> => {
  const res = await apiClient.post('/claw/note/edit', { id, ...data })
  return res.data.data?.record
}

export const deleteNote = async (id: number): Promise<void> => {
  await apiClient.post('/claw/note/delete', { id })
}

// ─── Note 分享 ───────────────────────────────────────────────────────────────

export const shareNote = async (id: number): Promise<string> => {
  const res = await apiClient.post('/claw/note/share', { id })
  return res.data.data?.shareHash
}

export const unshareNote = async (id: number): Promise<void> => {
  await apiClient.post('/claw/note/unshare', { id })
}

export const getSharedNote = async (
  id: number,
  hash: string
): Promise<Note | null> => {
  const res = await apiClient.get(`/claw/note/share/${id}_${hash}`)
  return res.data.data?.record || null
}
