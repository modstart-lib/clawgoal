export type WikiStatus = 'processing' | 'success' | 'fail'
export type WikiType = 'manual' | 'syncUrl' | 'syncPath'

export interface WikiRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  project_id: number
  /** 业务标识 */
  biz: string | null
  /** processing | success | fail */
  status: string
  /** manual | syncUrl | syncPath */
  type: string
  title: string
  content: string | null
  source_url: string | null
  /** syncUrl 类型的信息来源 URL */
  sync_url: string | null
  /** 同步间隔（天），默认 1 */
  sync_interval: number
  /** 下次同步时间（syncUrl/syncPath 类型才有意义） */
  next_sync_time: string | null
  /** 同步失败时的错误信息 */
  status_remark: string | null
  /** syncPath 类型的同步目录路径 */
  sync_path: string | null
  meta: any
}

export interface AddWikiInput {
  tenantId: number
  userId: number
  projectId: number
  biz?: string
  title?: string
  content?: string
  sourceUrl?: string
  status?: WikiStatus
  type?: WikiType
  syncUrl?: string
  syncPath?: string
  syncInterval?: number
  nextSyncTime?: string
  meta?: any
}

export interface UpdateWikiInput {
  biz?: string | null
  title?: string
  content?: string | null
  sourceUrl?: string | null
  status?: WikiStatus
  type?: WikiType
  syncUrl?: string | null
  syncPath?: string | null
  syncInterval?: number
  nextSyncTime?: string | null
  statusRemark?: string | null
  meta?: any
}

export type WikiSyncLogStatus = 'processing' | 'success' | 'fail'

export interface WikiSyncLogRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  project_id: number
  wiki_id: number
  url: string
  /** processing | success | fail */
  status: string
  content: string | null
  error: string | null
  status_remark: string | null
}

export interface InsertWikiSyncLogInput {
  tenantId: number
  userId: number
  projectId: number
  wikiId: number
  url: string
  status?: WikiSyncLogStatus
  content?: string
  error?: string
}

export interface UpdateWikiSyncLogInput {
  status?: WikiSyncLogStatus
  content?: string | null
  error?: string | null
  statusRemark?: string | null
}
