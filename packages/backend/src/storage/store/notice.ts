import { SqliteNoticeStore } from '../sqlite/store/notice.js'

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface NoticeRow {
  id: number
  tenantId: number
  userId: number
  title: string
  enable: boolean
  rateLimitEnable: boolean
  rateInterval: number
  type: string
  config: Record<string, any>
  proxyName?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface NoticeLogRow {
  id: number
  tenantId: number
  userId: number
  noticeId: number
  title: string
  content: string
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateNoticeInput {
  tenantId: number
  userId: number
  title: string
  enable?: boolean
  rateLimitEnable?: boolean
  rateInterval?: number
  type: string
  config?: Record<string, any>
  proxyName?: string | null
}

export interface UpdateNoticeInput {
  title?: string
  enable?: boolean
  rateLimitEnable?: boolean
  rateInterval?: number
  type?: string
  config?: Record<string, any>
  proxyName?: string | null
}

export interface CreateNoticeLogInput {
  tenantId: number
  userId: number
  noticeId: number
  title: string
  content: string
  status?: string
}

export interface PaginateResult<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface INoticeStore {
  findAllNotices(tenantId: number, userId: number): Promise<NoticeRow[]>
  findAllEnabledNotices(): Promise<NoticeRow[]>
  findNoticeById(id: number): Promise<NoticeRow | null>
  createNotice(input: CreateNoticeInput): Promise<NoticeRow>
  updateNotice(id: number, input: UpdateNoticeInput): Promise<NoticeRow>
  deleteNotice(id: number): Promise<void>
  createNoticeLog(input: CreateNoticeLogInput): Promise<NoticeLogRow>
  paginateNoticeLogs(
    tenantId: number,
    userId: number,
    noticeId: number | null,
    page: number,
    pageSize: number,
    startTime?: string | null,
    endTime?: string | null
  ): Promise<PaginateResult<NoticeLogRow>>
}

// ─── 单例 ─────────────────────────────────────────────────────────────────────

function dbProvider(): 'sqlite' | 'mysql' {
  const p = (process.env.DATABASE_PROVIDER ?? 'sqlite').toLowerCase()
  return p === 'mysql' ? 'mysql' : 'sqlite'
}

let _store: INoticeStore | null = null

/** 全局 notice 存储单例（mysql2 仅在 DATABASE_PROVIDER=mysql 时才会被加载） */
export const noticeDb: INoticeStore & { open(): Promise<void> } = {
  async open() {
    if (dbProvider() === 'mysql') {
      const { MysqlNoticeStore } = await import('../mysql/store/notice.js')
      const inst = new MysqlNoticeStore()
      await inst.open()
      _store = inst
    } else {
      const inst = new SqliteNoticeStore()
      inst.open()
      _store = inst
    }
  },
  findAllNotices(tenantId, userId) {
    return _store!.findAllNotices(tenantId, userId)
  },
  findAllEnabledNotices() {
    return _store!.findAllEnabledNotices()
  },
  findNoticeById(id) {
    return _store!.findNoticeById(id)
  },
  createNotice(input) {
    return _store!.createNotice(input)
  },
  updateNotice(id, input) {
    return _store!.updateNotice(id, input)
  },
  deleteNotice(id) {
    return _store!.deleteNotice(id)
  },
  createNoticeLog(input) {
    return _store!.createNoticeLog(input)
  },
  paginateNoticeLogs(tenantId, userId, noticeId, page, pageSize, start, end) {
    return _store!.paginateNoticeLogs(
      tenantId,
      userId,
      noticeId,
      page,
      pageSize,
      start,
      end
    )
  },
}
