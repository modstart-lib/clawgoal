import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import { safeJsonParse } from '../../../../../backend/src/utils/json.js'
import type {
  AddNoteInput,
  NoteRow,
  UpdateNoteInput,
} from '../../store/types.js'

export class SqliteClawNoteStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findNotesByProjectId(
    projectId: number,
    options?: { type?: string }
  ): NoteRow[] {
    const type = options?.type
    const rows = type
      ? (this.sql(
          'SELECT * FROM claw_note WHERE project_id = ? AND type = ? ORDER BY id DESC'
        ).all(projectId, type) as any[])
      : (this.sql(
          'SELECT * FROM claw_note WHERE project_id = ? ORDER BY id DESC'
        ).all(projectId) as any[])
    return rows.map((r) => ({
      ...r,
      meta: safeJsonParse(r.meta, null, 'note.meta'),
    }))
  }

  paginateNotesByProjectId(
    projectId: number,
    options?: {
      type?: string
      keyword?: string
      page?: number
      pageSize?: number
    }
  ): { records: NoteRow[]; total: number } {
    const page = Math.max(1, options?.page ?? 1)
    const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 20))
    const offset = (page - 1) * pageSize

    const conditions: string[] = ['project_id = ?']
    const params: unknown[] = [projectId]

    if (options?.type) {
      conditions.push('type = ?')
      params.push(options.type)
    }
    if (options?.keyword?.trim()) {
      const kw = options.keyword.trim()
      const parsed = kw.replace(/^#/, '')
      const numId = parseInt(parsed, 10)
      if (!isNaN(numId) && String(numId) === parsed) {
        conditions.push('id = ?')
        params.push(numId)
      } else {
        conditions.push('(title LIKE ? OR content LIKE ?)')
        params.push(`%${kw}%`, `%${kw}%`)
      }
    }

    const where = conditions.join(' AND ')
    const total = (
      this.sql(`SELECT COUNT(*) as cnt FROM claw_note WHERE ${where}`).get(
        ...params
      ) as { cnt: number }
    ).cnt
    const records = this.sql(
      `SELECT * FROM claw_note WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as any[]
    return {
      records: records.map((r) => ({
        ...r,
        meta: safeJsonParse(r.meta, null, 'note.meta'),
      })),
      total,
    }
  }

  searchNotes(
    keyword: string,
    options?: { projectId?: number; limit?: number }
  ): NoteRow[] {
    const like = `%${keyword}%`
    const limit = options?.limit ?? 50
    const rows = options?.projectId
      ? (this.sql(
          'SELECT * FROM claw_note WHERE project_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY id DESC LIMIT ?'
        ).all(options.projectId, like, like, limit) as any[])
      : (this.sql(
          'SELECT * FROM claw_note WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC LIMIT ?'
        ).all(like, like, limit) as any[])
    return rows.map((r) => ({
      ...r,
      meta: safeJsonParse(r.meta, null, 'note.meta'),
    }))
  }

  findNotesByProjectIdAndBiz(projectId: number, biz: string): NoteRow[] {
    const rows = this.sql(
      'SELECT * FROM claw_note WHERE project_id = ? AND biz = ? ORDER BY id DESC'
    ).all(projectId, biz) as any[]
    return rows.map((r) => ({
      ...r,
      meta: safeJsonParse(r.meta, null, 'note.meta'),
    }))
  }

  findNoteTypesByProjectId(projectId: number): string[] {
    const rows = this.sql(
      "SELECT DISTINCT type FROM claw_note WHERE project_id = ? AND type IS NOT NULL AND type != '' ORDER BY type"
    ).all(projectId) as { type: string }[]
    return rows.map((r) => r.type)
  }

  findNoteById(id: number): NoteRow | undefined {
    const row = this.sql('SELECT * FROM claw_note WHERE id = ?').get(id) as any
    return row
      ? { ...row, meta: safeJsonParse(row.meta, null, 'note.meta') }
      : undefined
  }

  findNoteByShareHash(shareHash: string): NoteRow | undefined {
    const row = this.sql(
      'SELECT * FROM claw_note WHERE share_hash = ? LIMIT 1'
    ).get(shareHash) as any
    return row
      ? { ...row, meta: safeJsonParse(row.meta, null, 'note.meta') }
      : undefined
  }

  insertNote(input: AddNoteInput): NoteRow {
    const info = this.sql(
      `
      INSERT INTO claw_note (created_at, updated_at, project_id, biz, type, title, content, meta)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $projectId, $biz, $type, $title, $content, $meta)
    `
    ).run({
      projectId: input.projectId,
      biz: input.biz?.trim() || null,
      type: input.type?.trim() || null,
      title: input.title,
      content: input.content ?? null,
      meta: input.meta != null ? JSON.stringify(input.meta) : null,
    })
    return this.findNoteById(Number(info.lastInsertRowid))!
  }

  updateNote(id: number, input: UpdateNoteInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if ('biz' in input) {
      fields.push('biz = $biz')
      params.biz = input.biz?.trim() || null
    }
    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if ('type' in input) {
      fields.push('type = $type')
      params.type = input.type?.trim() || null
    }
    if ('content' in input) {
      fields.push('content = $content')
      params.content = input.content ?? null
    }
    if ('meta' in input) {
      fields.push('meta = $meta')
      params.meta = input.meta != null ? JSON.stringify(input.meta) : null
    }
    if ('shareHash' in input) {
      fields.push('share_hash = $shareHash')
      params.shareHash = input.shareHash ?? null
    }

    if (fields.length === 0) return
    this.sql(`UPDATE claw_note SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteNote(id: number): boolean {
    const row = this.findNoteById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_note WHERE id = ?').run(id)
    return true
  }

  deleteNotesByProjectId(projectId: number): void {
    this.sql('DELETE FROM claw_note WHERE project_id = ?').run(projectId)
  }
}
