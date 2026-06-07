import type { Pool } from 'mysql2/promise'
import { getSharedPool } from '../../mysql.js'
import type {
  CreateNoticeInput,
  CreateNoticeLogInput,
  INoticeStore,
  NoticeLogRow,
  NoticeRow,
  PaginateResult,
  UpdateNoticeInput,
} from '../../store/notice.js'
import { createNotice, createNoticeLog } from '../schema.js'

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
    config: r.config ? JSON.parse(r.config) : {},
    proxyName: r.proxy_name ?? null,
    createdAt:
      r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    updatedAt:
      r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at),
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
    createdAt:
      r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    updatedAt:
      r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at),
  }
}

export class MysqlNoticeStore implements INoticeStore {
  private pool!: Pool

  private async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await this.pool.execute(sql, params)
    return rows as T[]
  }

  private async execute(
    sql: string,
    params?: any[]
  ): Promise<{ insertId: number }> {
    const [result] = (await this.pool.execute(sql, params)) as any
    return { insertId: Number(result.insertId) }
  }

  async open(): Promise<void> {
    this.pool = await getSharedPool()
    await this.pool.execute(createNotice())
    await this.pool.execute(createNoticeLog())
    // 迁移：若旧表缺少 proxy_name 列则补充
    try {
      await this.pool.execute(
        'ALTER TABLE `notice` ADD COLUMN `proxy_name` VARCHAR(200) NULL'
      )
    } catch {
      // 列已存在时忽略错误
    }
  }

  async findAllNotices(tenantId: number, userId: number): Promise<NoticeRow[]> {
    const rows = await this.query(
      'SELECT * FROM `notice` WHERE `tenant_id` = ? AND `user_id` = ? ORDER BY `id` ASC',
      [tenantId, userId]
    )
    return rows.map(mapNotice)
  }

  async findAllEnabledNotices(): Promise<NoticeRow[]> {
    const rows = await this.query(
      'SELECT * FROM `notice` WHERE `enable` = 1 ORDER BY `id` ASC',
      []
    )
    return rows.map(mapNotice)
  }

  async findNoticeById(id: number): Promise<NoticeRow | null> {
    const rows = await this.query('SELECT * FROM `notice` WHERE `id` = ?', [id])
    return rows.length ? mapNotice(rows[0]) : null
  }

  async createNotice(input: CreateNoticeInput): Promise<NoticeRow> {
    const { insertId } = await this.execute(
      'INSERT INTO `notice` (`tenant_id`, `user_id`, `title`, `enable`, `rate_limit_enable`, `rate_interval`, `type`, `config`, `proxy_name`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.tenantId,
        input.userId,
        input.title,
        input.enable !== false ? 1 : 0,
        input.rateLimitEnable ? 1 : 0,
        input.rateInterval ?? 60,
        input.type,
        JSON.stringify(input.config ?? {}),
        input.proxyName ?? null,
      ]
    )
    return (await this.findNoticeById(Number(insertId)))!
  }

  async updateNotice(id: number, input: UpdateNoticeInput): Promise<NoticeRow> {
    const fields: string[] = []
    const params: any[] = []
    if (input.title != null) {
      fields.push('`title` = ?')
      params.push(input.title)
    }
    if (input.enable != null) {
      fields.push('`enable` = ?')
      params.push(input.enable ? 1 : 0)
    }
    if (input.rateLimitEnable != null) {
      fields.push('`rate_limit_enable` = ?')
      params.push(input.rateLimitEnable ? 1 : 0)
    }
    if (input.rateInterval != null) {
      fields.push('`rate_interval` = ?')
      params.push(input.rateInterval)
    }
    if (input.type != null) {
      fields.push('`type` = ?')
      params.push(input.type)
    }
    if (input.config != null) {
      fields.push('`config` = ?')
      params.push(JSON.stringify(input.config))
    }
    if ('proxyName' in input) {
      fields.push('`proxy_name` = ?')
      params.push(input.proxyName ?? null)
    }
    if (fields.length) {
      params.push(id)
      await this.pool.execute(
        `UPDATE \`notice\` SET ${fields.join(', ')} WHERE \`id\` = ?`,
        params
      )
    }
    return (await this.findNoticeById(id))!
  }

  async deleteNotice(id: number): Promise<void> {
    await this.pool.execute('DELETE FROM `notice` WHERE `id` = ?', [id])
    await this.pool.execute('DELETE FROM `notice_log` WHERE `notice_id` = ?', [
      id,
    ])
  }

  async createNoticeLog(input: CreateNoticeLogInput): Promise<NoticeLogRow> {
    const { insertId } = await this.execute(
      'INSERT INTO `notice_log` (`tenant_id`, `user_id`, `notice_id`, `title`, `content`, `status`) VALUES (?, ?, ?, ?, ?, ?)',
      [
        input.tenantId,
        input.userId,
        input.noticeId,
        input.title,
        input.content,
        input.status ?? 'success',
      ]
    )
    const rows = await this.query('SELECT * FROM `notice_log` WHERE `id` = ?', [
      Number(insertId),
    ])
    return mapNoticeLog(rows[0])
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
    const whereParts: string[] = ['`tenant_id` = ?', '`user_id` = ?']
    const whereParams: any[] = [tenantId, userId]

    if (noticeId != null) {
      whereParts.push('`notice_id` = ?')
      whereParams.push(noticeId)
    }
    if (startTime) {
      whereParts.push('`created_at` >= ?')
      whereParams.push(startTime)
    }
    if (endTime) {
      whereParts.push('`created_at` <= ?')
      whereParams.push(endTime)
    }

    const whereSql = whereParts.join(' AND ')
    const [rows, countRows] = await Promise.all([
      this.query(
        `SELECT * FROM \`notice_log\` WHERE ${whereSql} ORDER BY \`id\` DESC LIMIT ? OFFSET ?`,
        [...whereParams, pageSize, offset]
      ),
      this.query<any>(
        `SELECT COUNT(*) AS c FROM \`notice_log\` WHERE ${whereSql}`,
        whereParams
      ),
    ])
    const total = Number(countRows[0].c)
    return {
      data: rows.map(mapNoticeLog),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    }
  }
}
