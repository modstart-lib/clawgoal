import { type Database } from 'bun:sqlite'
import { execSqlSafe } from '../../migrate.js'
import { getSharedDb } from '../../sqlite.js'
import type { IParamStore, ParamRow } from '../../store/base.js'
import { createParam } from '../schema/userParam.js'

function now(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

export class SqliteParamStore implements IParamStore {
  private db!: Database

  private prep(query: string): ReturnType<Database['prepare']> {
    return this.db.prepare(query)
  }

  open(): void {
    this.db = getSharedDb()
    execSqlSafe(this.db, createParam())
  }

  async getParam(
    tenantId: number,
    userId: number,
    name: string
  ): Promise<string | null> {
    const r = this.prep(
      'SELECT value FROM user_param WHERE tenant_id = ? AND user_id = ? AND name = ?'
    ).get(tenantId, userId, name) as any
    return r ? r.value : null
  }

  async setParam(
    tenantId: number,
    userId: number,
    name: string,
    value: string,
    scope?: string,
    remark?: string
  ): Promise<void> {
    const ts = now()
    this.db.transaction(() => {
      this.prep(
        `INSERT OR IGNORE INTO user_param (tenant_id, user_id, name, value, scope, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(tenantId, userId, name, value, scope ?? '', remark ?? '', ts, ts)
      this.prep(
        `UPDATE user_param SET value = ?, scope = ?, remark = ?, updated_at = ? WHERE tenant_id = ? AND user_id = ? AND name = ?`
      ).run(value, scope ?? '', remark ?? '', ts, tenantId, userId, name)
    })()
  }

  async findParamByNameAndValue(
    name: string,
    value: string
  ): Promise<{ tenantId: number; userId: number } | null> {
    const r = this.prep(
      'SELECT tenant_id, user_id FROM user_param WHERE name = ? AND value = ? LIMIT 1'
    ).get(name, value) as any
    if (!r) return null
    return { tenantId: Number(r.tenant_id), userId: Number(r.user_id) }
  }

  async deleteParam(
    tenantId: number,
    userId: number,
    name: string
  ): Promise<void> {
    this.prep(
      'DELETE FROM user_param WHERE tenant_id = ? AND user_id = ? AND name = ?'
    ).run(tenantId, userId, name)
  }

  async listByPrefix(
    tenantId: number,
    userId: number,
    prefix: string
  ): Promise<ParamRow[]> {
    return this.prep(
      'SELECT name, value, scope, remark FROM user_param WHERE tenant_id = ? AND user_id = ? AND name LIKE ? ORDER BY name ASC'
    ).all(tenantId, userId, `${prefix}%`) as ParamRow[]
  }
}
