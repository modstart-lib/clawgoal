import { randomBytes, scryptSync } from 'node:crypto'
import { type Database } from 'bun:sqlite'
import { execSqlSafe } from '../../migrate.js'
import { getSharedDb } from '../../sqlite.js'
import { createUser } from '../schema/user.js'
import { deepMerge } from '../../../utils/utils.js'
import { safeJsonParse } from '../../../utils/json.js'

export interface UserRow {
  id: number
  tenantId: number
  username: string
  password: string
  passwordSalt: string
  apiData: Record<string, unknown> | null
  isCreator: boolean
  createdAt: Date
  updatedAt: Date
}

function mapUser(r: any): UserRow {
  return {
    id: Number(r.id),
    tenantId: Number(r.tenant_id),
    username: r.username,
    password: r.password,
    passwordSalt: r.password_salt,
    apiData: r.api_data
      ? safeJsonParse(r.api_data, null, 'user.apiData')
      : null,
    isCreator: r.is_creator === 1,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

function now(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

function hashPassword(
  password: string,
  salt?: string
): { hash: string; salt: string } {
  const s = salt || randomBytes(16).toString('hex')
  const hash = scryptSync(password, s, 64).toString('hex')
  return { hash, salt: s }
}

function verifyPassword(
  password: string,
  salt: string,
  storedHash: string
): boolean {
  const { hash } = hashPassword(password, salt)
  return hash === storedHash
}

class UserStore {
  private db!: Database

  private prep(query: string): ReturnType<Database['prepare']> {
    return this.db.prepare(query)
  }

  async open(): Promise<void> {
    this.db = getSharedDb()
    execSqlSafe(this.db, createUser())
  }

  // ── 查询 ──────────────────────────────────────────────────────────

  async findAll(): Promise<UserRow[]> {
    const rows = this.prep('SELECT * FROM user ORDER BY id ASC').all()
    return (rows as any[]).map(mapUser)
  }

  async findById(id: number): Promise<UserRow | null> {
    const r = this.prep('SELECT * FROM user WHERE id = ?').get(id)
    return r ? mapUser(r) : null
  }

  async findByUsername(username: string): Promise<UserRow | null> {
    const r = this.prep('SELECT * FROM user WHERE username = ?').get(username)
    return r ? mapUser(r) : null
  }

  async count(): Promise<number> {
    const r = this.prep('SELECT COUNT(*) as cnt FROM user').get() as any
    return Number(r?.cnt ?? 0)
  }

  // ── 写操作 ────────────────────────────────────────────────────────

  async insert(input: {
    tenantId: number
    username: string
    password: string
    apiData?: Record<string, unknown>
    isCreator?: boolean
  }): Promise<UserRow> {
    const { hash, salt } = hashPassword(input.password)
    const ts = now()
    this.prep(
      `INSERT INTO user (tenant_id, username, password, password_salt, api_data, is_creator, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.tenantId,
      input.username,
      hash,
      salt,
      input.apiData ? JSON.stringify(input.apiData) : null,
      input.isCreator ? 1 : 0,
      ts,
      ts
    )
    const r = this.prep(
      'SELECT * FROM user WHERE id = last_insert_rowid()'
    ).get()
    return mapUser(r)
  }

  async update(
    id: number,
    input: {
      username?: string
      password?: string
      apiData?: Record<string, unknown>
      isCreator?: boolean
    }
  ): Promise<UserRow | null> {
    const ts = now()
    const sets: string[] = ['updated_at = ?']
    const params: any[] = [ts]

    if (input.username !== undefined) {
      sets.push('username = ?')
      params.push(input.username)
    }
    if (input.password !== undefined) {
      const { hash, salt } = hashPassword(input.password)
      sets.push('password = ?')
      params.push(hash)
      sets.push('password_salt = ?')
      params.push(salt)
    }
    if (input.apiData !== undefined) {
      sets.push('api_data = ?')
      params.push(JSON.stringify(input.apiData))
    }
    if (input.isCreator !== undefined) {
      sets.push('is_creator = ?')
      params.push(input.isCreator ? 1 : 0)
    }

    params.push(id)
    const info = this.prep(
      `UPDATE user SET ${sets.join(', ')} WHERE id = ?`
    ).run(...params)
    if (info.changes === 0) return null
    return this.findById(id)
  }

  /** 深合并 apiData 并保存 */
  async updateApiData(
    id: number,
    incoming: Record<string, unknown>
  ): Promise<UserRow | null> {
    const user = await this.findById(id)
    if (!user) return null
    const merged = deepMerge(user.apiData ?? {}, incoming)
    return this.update(id, { apiData: merged })
  }

  async delete(id: number): Promise<boolean> {
    const info = this.prep('DELETE FROM user WHERE id = ?').run(id)
    return info.changes > 0
  }

  // ── 密码验证 ──────────────────────────────────────────────────────

  verifyUserPassword(user: UserRow, plainPassword: string): boolean {
    return verifyPassword(plainPassword, user.passwordSalt, user.password)
  }
}

export const userDb = new UserStore()
