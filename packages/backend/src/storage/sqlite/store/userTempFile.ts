import type { Database } from 'bun:sqlite'
import { execSqlSafe } from '../migrate.js'
import { makeSqlHelper } from '../../sqlite.js'
import type {
  CreateUserTempFileInput,
  IUserTempFileStore,
  UserTempFileRow,
} from '../../store/userTempFile.js'
import { createUserTempFile } from '../schema/userTempFile.js'

function mapRow(r: any): UserTempFileRow {
  return {
    id: Number(r.id),
    tenantId: Number(r.tenant_id),
    userId: Number(r.user_id),
    path: r.path,
    ext: r.ext,
    localPath: r.local_path,
    expireAt: new Date(r.expire_at),
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

export class SqliteUserTempFileStore implements IUserTempFileStore {
  private sql: ReturnType<typeof makeSqlHelper>

  constructor(db: Database) {
    execSqlSafe(db, createUserTempFile())
    this.sql = makeSqlHelper(db, (q) => q)
  }

  async open(): Promise<void> {}

  async create(input: CreateUserTempFileInput): Promise<UserTempFileRow> {
    const ts = nowStr()
    const expireStr = input.expireAt
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)
    const info = this.sql(
      `INSERT OR REPLACE INTO temp_file (tenant_id, user_id, path, ext, local_path, expire_at, created_at, updated_at)
       VALUES ($tenantId, $userId, $path, $ext, $localPath, $expireAt, $createdAt, $updatedAt)`
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      path: input.path,
      ext: input.ext,
      localPath: input.localPath,
      expireAt: expireStr,
      createdAt: ts,
      updatedAt: ts,
    }) as any
    const row = this.sql(`SELECT * FROM temp_file WHERE id = $id`).get({
      id: info.lastInsertRowid,
    })
    return mapRow(row)
  }

  async findByPath(path: string): Promise<UserTempFileRow | null> {
    const row = this.sql(`SELECT * FROM temp_file WHERE path = $path`).get({
      path,
    })
    return row ? mapRow(row) : null
  }

  async deleteExpired(): Promise<number> {
    const now = nowStr()
    const info = this.sql(`DELETE FROM temp_file WHERE expire_at <= $now`).run({
      now,
    }) as any
    return info.changes ?? 0
  }

  async deleteByPath(path: string): Promise<void> {
    this.sql(`DELETE FROM temp_file WHERE path = $path`).run({ path })
  }
}
