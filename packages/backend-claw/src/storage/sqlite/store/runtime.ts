import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AddRuntimeInput,
  RunnerInfo,
  RuntimeRow,
  UpdateRuntimeInput,
} from '../../store/runtime.js'

export class SqliteClawRuntimeStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findAllRuntimes(tenantId: number, userId: number): RuntimeRow[] {
    return this.sql(
      'SELECT * FROM claw_runtime WHERE tenant_id = ? AND user_id = ? ORDER BY id ASC'
    ).all(tenantId, userId) as RuntimeRow[]
  }

  findRuntimeById(id: number): RuntimeRow | undefined {
    return this.sql('SELECT * FROM claw_runtime WHERE id = ?').get(id) as
      | RuntimeRow
      | undefined
  }

  findRuntimeByToken(token: string): RuntimeRow | undefined {
    return this.sql('SELECT * FROM claw_runtime WHERE token = ?').get(token) as
      | RuntimeRow
      | undefined
  }

  findRuntimeByName(
    tenantId: number,
    userId: number,
    name: string
  ): RuntimeRow | undefined {
    return this.sql(
      'SELECT * FROM claw_runtime WHERE tenant_id = ? AND user_id = ? AND name = ?'
    ).get(tenantId, userId, name) as RuntimeRow | undefined
  }

  insertRuntime(input: AddRuntimeInput): RuntimeRow {
    const info = this.sql(
      `
      INSERT INTO claw_runtime (created_at, updated_at, tenant_id, user_id, name, title, token, status)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $name, $title, $token, 'offline')
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      name: input.name,
      title: input.title,
      token: input.token,
    })
    return this.findRuntimeById(Number(info.lastInsertRowid))!
  }

  updateRuntime(id: number, input: UpdateRuntimeInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.token != null) {
      fields.push('token = $token')
      params.token = input.token
    }
    if ('runners' in input) {
      fields.push('runners = $runners')
      params.runners =
        input.runners != null ? JSON.stringify(input.runners) : null
    }

    if (fields.length === 0) return
    this.sql(`UPDATE claw_runtime SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  setRuntimeStatus(id: number, status: 'online' | 'offline'): void {
    if (status === 'online') {
      this.sql(
        `UPDATE claw_runtime SET status = ?, active_at = datetime('now', 'localtime') WHERE id = ?`
      ).run(status, id)
    } else {
      this.sql(`UPDATE claw_runtime SET status = ? WHERE id = ?`).run(
        status,
        id
      )
    }
  }

  resetAllRuntimesToOffline(): void {
    this.sql(`UPDATE claw_runtime SET status = 'offline'`).run()
  }

  setRuntimeRunners(id: number, runners: RunnerInfo[]): void {
    this.sql(`UPDATE claw_runtime SET runners = ? WHERE id = ?`).run(
      JSON.stringify(runners),
      id
    )
  }

  deleteRuntime(id: number): boolean {
    const row = this.findRuntimeById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_runtime WHERE id = ?').run(id)
    return true
  }
}
