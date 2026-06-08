import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AddFileInput,
  FileRow,
  UpdateFileInput,
} from '../../store/file.js'

export class SqliteClawFileStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findAllFiles(
    tenantId: number,
    userId: number,
    options: {
      agentId?: number
      ext?: string
      limit?: number
      offset?: number
    } = {}
  ): FileRow[] {
    const conditions: string[] = ['tenant_id = ?', 'user_id = ?']
    const params: unknown[] = [tenantId, userId]
    if (options.agentId !== undefined) {
      conditions.push('agent_id = ?')
      params.push(options.agentId)
    }
    if (options.ext !== undefined) {
      conditions.push('ext = ?')
      params.push(options.ext)
    }
    const where = `WHERE ${conditions.join(' AND ')}`
    const limit = options.limit ?? 100
    const offset = options.offset ?? 0
    return this.sql(
      `SELECT * FROM claw_file ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as FileRow[]
  }

  findFileById(id: number): FileRow | undefined {
    return this.sql('SELECT * FROM claw_file WHERE id = ?').get(id) as
      | FileRow
      | undefined
  }

  findFileByPath(path: string): FileRow | undefined {
    return this.sql('SELECT * FROM claw_file WHERE path = ?').get(path) as
      | FileRow
      | undefined
  }

  insertFile(input: AddFileInput): FileRow {
    const stmt = this.sql(`
      INSERT INTO claw_file (created_at, updated_at, tenant_id, user_id, title, path, ext, size, agent_id)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $title, $path, $ext, $size, $agentId)
    `)
    const info = stmt.run({
      tenantId: input.tenantId,
      userId: input.userId,
      title: input.title,
      path: input.path,
      ext: input.ext.toLowerCase().replace(/^\./, ''),
      size: input.size,
      agentId: input.agentId ?? null,
    })
    return this.findFileById(Number(info.lastInsertRowid))!
  }

  updateFile(id: number, input: UpdateFileInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }
    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.size != null) {
      fields.push('size = $size')
      params.size = input.size
    }
    if (input.agentId != null) {
      fields.push('agent_id = $agentId')
      params.agentId = input.agentId
    }
    if (fields.length === 0) return
    this.sql(`UPDATE claw_file SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteFile(id: number): boolean {
    const row = this.findFileById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_file WHERE id = ?').run(id)
    return true
  }
}
