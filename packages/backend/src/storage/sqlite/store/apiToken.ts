import { type Database } from 'bun:sqlite'
import { execSqlSafe } from '../../migrate.js'
import { getSharedDb } from '../../sqlite.js'
import type {
  ApiTokenRow,
  CreateApiTokenInput,
  IApiTokenStore,
  PaginateResult,
  UpdateApiTokenInput,
} from '../../store/base.js'
import { createApiToken } from '../schema/apiToken.js'

function mapApiToken(r: any): ApiTokenRow {
  return {
    id: Number(r.id),
    tenantId: Number(r.tenant_id),
    userId: Number(r.user_id),
    token: r.token,
    permissions: r.permissions ?? '',
    expire: new Date(r.expire),
    title: r.title ?? null,
    lastUseTime: r.last_use_time ? new Date(r.last_use_time) : null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

function now(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

export class SqliteApiTokenStore implements IApiTokenStore {
  private db!: Database

  private prep(query: string): ReturnType<Database['prepare']> {
    return this.db.prepare(query)
  }

  async open(): Promise<void> {
    this.db = getSharedDb()
    execSqlSafe(this.db, createApiToken())
  }

  async findAllApiTokens(
    tenantId: number,
    userId: number
  ): Promise<ApiTokenRow[]> {
    const rows = this.prep(
      'SELECT * FROM api_token WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC'
    ).all(tenantId, userId)
    return (rows as any[]).map(mapApiToken)
  }

  async paginateApiTokens(
    tenantId: number,
    userId: number,
    page: number,
    pageSize: number
  ): Promise<PaginateResult<ApiTokenRow>> {
    const offset = (page - 1) * pageSize
    const rows = this.prep(
      'SELECT * FROM api_token WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(tenantId, userId, pageSize, offset)
    const countRow = this.prep(
      'SELECT COUNT(*) AS c FROM api_token WHERE tenant_id = ? AND user_id = ?'
    ).get(tenantId, userId) as any
    const total = countRow.c
    return {
      data: (rows as any[]).map(mapApiToken),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async findApiTokenById(id: number): Promise<ApiTokenRow | null> {
    const r = this.prep('SELECT * FROM api_token WHERE id = ?').get(id)
    return r ? mapApiToken(r) : null
  }

  async findApiTokenByToken(token: string): Promise<ApiTokenRow | null> {
    const r = this.prep('SELECT * FROM api_token WHERE token = ?').get(token)
    return r ? mapApiToken(r) : null
  }

  async createApiToken(data: CreateApiTokenInput): Promise<ApiTokenRow> {
    const ts = now()
    const expireStr = data.expire
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '')
    const info = this.prep(
      `
      INSERT INTO api_token (tenant_id, user_id, token, permissions, expire, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      data.tenantId,
      data.userId,
      data.token,
      data.permissions,
      expireStr,
      data.title ?? null,
      ts,
      ts
    )
    return (await this.findApiTokenById(Number(info.lastInsertRowid)))!
  }

  async updateApiToken(
    id: number,
    data: UpdateApiTokenInput
  ): Promise<ApiTokenRow> {
    const fields: string[] = ['updated_at = ?']
    const params: any[] = [now()]
    if (data.token !== undefined) {
      fields.push('token = ?')
      params.push(data.token)
    }
    if (data.permissions !== undefined) {
      fields.push('permissions = ?')
      params.push(data.permissions)
    }
    if (data.expire !== undefined) {
      fields.push('expire = ?')
      params.push(data.expire.toISOString().replace('T', ' ').replace('Z', ''))
    }
    if (data.title !== undefined) {
      fields.push('title = ?')
      params.push(data.title)
    }
    if (data.lastUseTime !== undefined) {
      fields.push('last_use_time = ?')
      params.push(
        data.lastUseTime
          ? data.lastUseTime.toISOString().replace('T', ' ').replace('Z', '')
          : null
      )
    }
    params.push(id)
    this.prep(`UPDATE api_token SET ${fields.join(', ')} WHERE id = ?`).run(
      ...params
    )
    return (await this.findApiTokenById(id))!
  }

  async deleteApiToken(id: number): Promise<void> {
    this.prep('DELETE FROM api_token WHERE id = ?').run(id)
  }
}
