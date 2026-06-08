import type { Pool } from 'mysql2/promise'
import { runMigrations } from '../../migrate.js'
import { getSharedPool } from '../../mysql.js'
import type {
  ApiTokenRow,
  CreateApiTokenInput,
  IApiTokenStore,
  PaginateResult,
  UpdateApiTokenInput,
} from '../../store/base.js'
import { createApiToken } from '../schema.js'

function mapApiToken(r: any): ApiTokenRow {
  return {
    id: Number(r.id),
    tenantId: Number(r.tenant_id),
    userId: Number(r.user_id),
    token: r.token,
    permissions: r.permissions ?? '',
    expire: r.expire instanceof Date ? r.expire : new Date(r.expire),
    title: r.title ?? null,
    lastUseTime: r.last_use_time
      ? r.last_use_time instanceof Date
        ? r.last_use_time
        : new Date(r.last_use_time)
      : null,
    createdAt:
      r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    updatedAt:
      r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at),
  }
}

export class MysqlApiTokenStore implements IApiTokenStore {
  private pool!: Pool

  async open(): Promise<void> {
    this.pool = await getSharedPool()
    await this.pool.execute(createApiToken())
    await runMigrations([
      {
        name: 'api_token: add last_use_time column',
        check: async () => {
          const rows = await this.query(
            'SHOW COLUMNS FROM `api_token` LIKE ?',
            ['last_use_time']
          )
          return rows.length === 0
        },
        execute: async () => {
          await this.pool.execute(
            'ALTER TABLE `api_token` ADD COLUMN `last_use_time` DATETIME NULL'
          )
        },
      },
    ])
  }

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

  async findAllApiTokens(
    tenantId: number,
    userId: number
  ): Promise<ApiTokenRow[]> {
    const rows = await this.query(
      'SELECT * FROM `api_token` WHERE `tenant_id` = ? AND `user_id` = ? ORDER BY `created_at` DESC',
      [tenantId, userId]
    )
    return rows.map(mapApiToken)
  }

  async paginateApiTokens(
    tenantId: number,
    userId: number,
    page: number,
    pageSize: number
  ): Promise<PaginateResult<ApiTokenRow>> {
    const offset = (page - 1) * pageSize
    const [rows, countRows] = await Promise.all([
      this.query(
        'SELECT * FROM `api_token` WHERE `tenant_id` = ? AND `user_id` = ? ORDER BY `created_at` DESC LIMIT ? OFFSET ?',
        [tenantId, userId, pageSize, offset]
      ),
      this.query<any>(
        'SELECT COUNT(*) AS c FROM `api_token` WHERE `tenant_id` = ? AND `user_id` = ?',
        [tenantId, userId]
      ),
    ])
    const total = Number(countRows[0].c)
    return {
      data: rows.map(mapApiToken),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async findApiTokenById(id: number): Promise<ApiTokenRow | null> {
    const rows = await this.query('SELECT * FROM `api_token` WHERE `id` = ?', [
      id,
    ])
    return rows.length ? mapApiToken(rows[0]) : null
  }

  async findApiTokenByToken(token: string): Promise<ApiTokenRow | null> {
    const rows = await this.query(
      'SELECT * FROM `api_token` WHERE `token` = ?',
      [token]
    )
    return rows.length ? mapApiToken(rows[0]) : null
  }

  async createApiToken(data: CreateApiTokenInput): Promise<ApiTokenRow> {
    const { insertId } = await this.execute(
      'INSERT INTO `api_token` (`tenant_id`, `user_id`, `token`, `permissions`, `expire`, `title`) VALUES (?, ?, ?, ?, ?, ?)',
      [
        data.tenantId,
        data.userId,
        data.token,
        data.permissions,
        data.expire,
        data.title ?? null,
      ]
    )
    return (await this.findApiTokenById(Number(insertId)))!
  }

  async updateApiToken(
    id: number,
    data: UpdateApiTokenInput
  ): Promise<ApiTokenRow> {
    const fields: string[] = []
    const params: any[] = []
    if (data.token !== undefined) {
      fields.push('`token` = ?')
      params.push(data.token)
    }
    if (data.permissions !== undefined) {
      fields.push('`permissions` = ?')
      params.push(data.permissions)
    }
    if (data.expire !== undefined) {
      fields.push('`expire` = ?')
      params.push(data.expire)
    }
    if (data.title !== undefined) {
      fields.push('`title` = ?')
      params.push(data.title)
    }
    if (data.lastUseTime !== undefined) {
      fields.push('`last_use_time` = ?')
      params.push(data.lastUseTime ?? null)
    }
    params.push(id)
    await this.pool.execute(
      `UPDATE \`api_token\` SET ${fields.join(', ')} WHERE \`id\` = ?`,
      params
    )
    return (await this.findApiTokenById(id))!
  }

  async deleteApiToken(id: number): Promise<void> {
    await this.pool.execute('DELETE FROM `api_token` WHERE `id` = ?', [id])
  }
}
