import { type Database } from 'bun:sqlite'
import { execSqlSafe } from '../../migrate.js'
import { getSharedDb } from '../../sqlite.js'
import type {
  CreateNoticeInput,
  CreateNoticeLogInput,
  INoticeStore,
  NoticeLogRow,
  NoticeRow,
  PaginateResult,
  UpdateNoticeInput,
} from '../../store/notice.js'
import { createNotice } from '../schema/notice.js'
import { safeJsonParse } from '../../../utils/json.js'

function now(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

function mapNotice(r: any): NoticeRow {
  return {
    id: Number(r.id),
    tenantId: Number(r.tenant_id),
    userId: Number(r.user_id),
    title: r.title,
    enable: Boolean(r.enable),
    rateLimitEnable: Boolean(r.rate_limit_enable),
    rateInterval: Number(r.rate_interval),
    type: r.type,
    config: r.config ? safeJsonParse(r.config, {}, 'notice.config') : {},
    proxyName: r.proxy_name ?? null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

function mapNoticeLog(r: any): NoticeLogRow {
  return {
    id: Number(r.id),
    tenantId: Number(r.tenant_id),
    userId: Number(r.user_id),
    noticeId: Number(r.notice_id),
    title: r.title,
    content: r.content,
    status: r.status,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

export class SqliteNoticeStore implements INoticeStore {
  private db!: Database

  private prep(query: string): ReturnType<Database['prepare']> {
    return this.db.prepare(query)
  }

  open(): void {
    this.db = getSharedDb()
    execSqlSafe(this.db, createNotice())
  }

  // ── Notice ─────────────────────────────────────────────────────────────────

  async findAllNotices(tenantId: number, userId: number): Promise<NoticeRow[]> {
    return (
      this.prep(
        'SELECT * FROM notice WHERE tenant_id = ? AND user_id = ? ORDER BY id ASC'
      ).all(tenantId, userId) as any[]
    ).map(mapNotice)
  }

  async findAllEnabledNotices(): Promise<NoticeRow[]> {
    return (
      this.prep(
        'SELECT * FROM notice WHERE enable = 1 ORDER BY id ASC'
      ).all() as any[]
    ).map(mapNotice)
  }

  async findNoticeById(id: number): Promise<NoticeRow | null> {
    const r = this.prep('SELECT * FROM notice WHERE id = ?').get(id)
    return r ? mapNotice(r) : null
  }

  async createNotice(input: CreateNoticeInput): Promise<NoticeRow> {
    const ts = now()
    const info = this.prep(
      `
      INSERT INTO notice (tenant_id, user_id, title, enable, rate_limit_enable, rate_interval, type, config, proxy_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      input.tenantId,
      input.userId,
      input.title,
      input.enable ? 1 : 0,
      input.rateLimitEnable ? 1 : 0,
      input.rateInterval ?? 60,
      input.type,
      JSON.stringify(input.config ?? {}),
      input.proxyName ?? null,
      ts,
      ts
    )
    return (await this.findNoticeById(Number(info.lastInsertRowid)))!
  }

  async updateNotice(id: number, input: UpdateNoticeInput): Promise<NoticeRow> {
    const fields: string[] = ['updated_at = ?']
    const params: unknown[] = [now()]
    if (input.title != null) {
      fields.push('title = ?')
      params.push(input.title)
    }
    if (input.enable != null) {
      fields.push('enable = ?')
      params.push(input.enable ? 1 : 0)
    }
    if (input.rateLimitEnable != null) {
      fields.push('rate_limit_enable = ?')
      params.push(input.rateLimitEnable ? 1 : 0)
    }
    if (input.rateInterval != null) {
      fields.push('rate_interval = ?')
      params.push(input.rateInterval)
    }
    if (input.type != null) {
      fields.push('type = ?')
      params.push(input.type)
    }
    if (input.config != null) {
      fields.push('config = ?')
      params.push(JSON.stringify(input.config))
    }
    if ('proxyName' in input) {
      fields.push('proxy_name = ?')
      params.push(input.proxyName ?? null)
    }
    params.push(id)
    this.prep(`UPDATE notice SET ${fields.join(', ')} WHERE id = ?`).run(
      ...params
    )
    return (await this.findNoticeById(id))!
  }

  async deleteNotice(id: number): Promise<void> {
    this.prep('DELETE FROM notice WHERE id = ?').run(id)
    this.prep('DELETE FROM notice_log WHERE notice_id = ?').run(id)
  }

  // ── NoticeLog ──────────────────────────────────────────────────────────────

  async createNoticeLog(input: CreateNoticeLogInput): Promise<NoticeLogRow> {
    const ts = now()
    const info = this.prep(
      `
      INSERT INTO notice_log (tenant_id, user_id, notice_id, title, content, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      input.tenantId,
      input.userId,
      input.noticeId,
      input.title,
      input.content,
      input.status ?? 'success',
      ts,
      ts
    )
    const r = this.prep('SELECT * FROM notice_log WHERE id = ?').get(
      Number(info.lastInsertRowid)
    )
    return mapNoticeLog(r)
  }

  async paginateNoticeLogs(
    tenantId: number,
    userId: number,
    noticeId: number | null,
    page: number,
    pageSize: number,
    startTime?: string | null,
    endTime?: string | null
  ): Promise<PaginateResult<NoticeLogRow>> {
    const offset = (page - 1) * pageSize
    const whereParts: string[] = ['tenant_id = ?', 'user_id = ?']
    const whereParams: unknown[] = [tenantId, userId]

    if (noticeId != null) {
      whereParts.push('notice_id = ?')
      whereParams.push(noticeId)
    }
    if (startTime) {
      whereParts.push('created_at >= ?')
      whereParams.push(startTime.length === 19 ? `${startTime}.000` : startTime)
    }
    if (endTime) {
      whereParts.push('created_at <= ?')
      whereParams.push(endTime.length === 19 ? `${endTime}.999` : endTime)
    }

    const whereSql = whereParts.join(' AND ')
    const rows = this.prep(
      `SELECT * FROM notice_log WHERE ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...whereParams, pageSize, offset) as any[]
    const total = (
      this.prep(`SELECT COUNT(*) AS c FROM notice_log WHERE ${whereSql}`).get(
        ...whereParams
      ) as any
    ).c

    return {
      data: rows.map(mapNoticeLog),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    }
  }
}
