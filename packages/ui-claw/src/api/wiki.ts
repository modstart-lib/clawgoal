import apiClient from './client'

export type WikiStatus = 'processing' | 'success' | 'fail'
export type WikiType = 'manual' | 'syncUrl' | 'syncPath'

export interface Wiki {
  id: number
  projectId: number
  userId: number
  biz: string
  status: WikiStatus
  type: WikiType
  title: string
  content: string | null
  sourceUrl: string | null
  syncUrl: string | null
  syncPath: string | null
  syncInterval: number
  nextSyncTime: string | null
  statusRemark: string | null
  meta: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface WikiSyncLog {
  id: number
  userId: number
  projectId: number
  wikiId: number
  url: string
  status: 'processing' | 'success' | 'fail'
  content: string | null
  error: string | null
  statusRemark: string | null
  createdAt: string
  updatedAt: string
}

function mapRow(row: any): Wiki {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    biz: row.biz || '',
    status: row.status,
    type: row.type || 'manual',
    title: row.title,
    content: row.content || null,
    sourceUrl: row.sourceUrl || null,
    syncUrl: row.syncUrl || null,
    syncPath: row.syncPath || null,
    syncInterval: row.syncInterval ?? 1,
    nextSyncTime: row.nextSyncTime || null,
    statusRemark: row.statusRemark || null,
    meta: row.meta || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapSyncLogRow(row: any): WikiSyncLog {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    wikiId: row.wiki_id,
    url: row.url,
    status: row.status,
    content: row.content || null,
    error: row.error || null,
    statusRemark: row.status_remark || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const listWikis = async (
  projectId: number,
  options?: { keyword?: string }
): Promise<Wiki[]> => {
  const res = await apiClient.post('/claw/wiki/list', {
    projectId,
    ...options,
  })
  return (res.data.data?.records || []).map(mapRow)
}

export const paginateWikis = async (
  projectId: number,
  options?: { keyword?: string; page?: number; pageSize?: number }
): Promise<{ records: Wiki[]; total: number }> => {
  const res = await apiClient.post('/claw/wiki/paginate', {
    projectId,
    ...options,
  })
  return {
    records: (res.data.data?.records || []).map(mapRow),
    total: res.data.data?.total || 0,
  }
}

export const getWiki = async (id: number): Promise<Wiki> => {
  const res = await apiClient.post('/claw/wiki/get', { id })
  return mapRow(res.data.data?.record)
}

export const addWiki = async (data: {
  projectId: number
  biz?: string
  title?: string
  content?: string
  sourceUrl?: string
  type?: WikiType
  syncUrl?: string
  syncPath?: string
  syncInterval?: number
  meta?: Record<string, unknown> | null
}): Promise<Wiki> => {
  const res = await apiClient.post('/claw/wiki/add', data)
  return mapRow(res.data.data?.record)
}

export const editWiki = async (
  id: number,
  data: {
    title?: string
    biz?: string
    content?: string
    sourceUrl?: string
    type?: WikiType
    syncUrl?: string
    syncPath?: string
    syncInterval?: number
    meta?: Record<string, unknown> | null
  }
): Promise<Wiki> => {
  const res = await apiClient.post('/claw/wiki/edit', { id, ...data })
  return mapRow(res.data.data?.record)
}

export const deleteWiki = async (id: number): Promise<void> => {
  await apiClient.post('/claw/wiki/delete', { id })
}

export const listWikiSyncLogs = async (
  wikiId: number,
  limit = 20
): Promise<WikiSyncLog[]> => {
  const res = await apiClient.post('/claw/wiki/syncLogs', {
    wikiId,
    limit,
  })
  return (res.data.data?.records || []).map(mapSyncLogRow)
}

export const listAllWikiSyncLogs = async (
  projectId: number,
  options?: { page?: number; pageSize?: number }
): Promise<{
  records: WikiSyncLog[]
  total: number
  page: number
  pageSize: number
}> => {
  const res = await apiClient.post('/claw/wiki/allSyncLogs', {
    projectId,
    page: options?.page ?? 1,
    pageSize: options?.pageSize ?? 20,
  })
  return {
    records: (res.data.data?.records || []).map(mapSyncLogRow),
    total: res.data.data?.total ?? 0,
    page: res.data.data?.page ?? 1,
    pageSize: res.data.data?.pageSize ?? 20,
  }
}

export const triggerWikiSync = async (id: number): Promise<void> => {
  await apiClient.post('/claw/wiki/sync', { id })
}
