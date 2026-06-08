import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import { safeJsonParse } from '../../../../../backend/src/utils/json.js'
import type {
  AddEventInput,
  EventRow,
  UpdateEventInput,
} from '../../store/types.js'

export class SqliteClawEventStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findEventsByProjectId(projectId: number): EventRow[] {
    const rows = this.sql(
      'SELECT * FROM claw_event WHERE project_id = ? ORDER BY CASE WHEN day IS NULL THEN 1 ELSE 0 END, day DESC'
    ).all(projectId) as any[]
    return rows.map((r) => ({
      ...r,
      meta: safeJsonParse(r.meta, null, 'event.meta'),
    }))
  }

  findEventsByProjectIdPaginated(
    projectId: number,
    options?: {
      page?: number
      pageSize?: number
      type?: string
      keyword?: string
    }
  ): { records: EventRow[]; total: number } {
    const page = Math.max(1, options?.page ?? 1)
    const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 20))
    const offset = (page - 1) * pageSize
    const type = options?.type
    const keyword = options?.keyword?.trim()

    const conditions: string[] = ['project_id = ?']
    const params: unknown[] = [projectId]

    if (type) {
      conditions.push('type = ?')
      params.push(type)
    }
    if (keyword) {
      const parsed = keyword.replace(/^#/, '')
      const numId = parseInt(parsed, 10)
      if (!isNaN(numId) && String(numId) === parsed) {
        conditions.push('id = ?')
        params.push(numId)
      } else {
        conditions.push('(title LIKE ? OR description LIKE ?)')
        params.push(`%${keyword}%`, `%${keyword}%`)
      }
    }

    const where = conditions.join(' AND ')
    const orderBy = 'ORDER BY CASE WHEN day IS NULL THEN 1 ELSE 0 END, day DESC'

    const total = (
      this.sql(`SELECT COUNT(*) as cnt FROM claw_event WHERE ${where}`).get(
        ...params
      ) as { cnt: number }
    ).cnt
    const records = this.sql(
      `SELECT * FROM claw_event WHERE ${where} ${orderBy} LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as any[]
    return {
      records: records.map((r) => ({
        ...r,
        meta: safeJsonParse(r.meta, null, 'event.meta'),
      })),
      total,
    }
  }

  findEventTypesByProjectId(projectId: number): string[] {
    const rows = this.sql(
      "SELECT DISTINCT type FROM claw_event WHERE project_id = ? AND type IS NOT NULL AND type != '' ORDER BY type"
    ).all(projectId) as { type: string }[]
    return rows.map((r) => r.type)
  }

  findEventById(id: number): EventRow | undefined {
    const row = this.sql('SELECT * FROM claw_event WHERE id = ?').get(id) as any
    return row
      ? { ...row, meta: safeJsonParse(row.meta, null, 'event.meta') }
      : undefined
  }

  findEventByProjectIdAndTitle(
    projectId: number,
    title: string
  ): EventRow | undefined {
    const row = this.sql(
      'SELECT * FROM claw_event WHERE project_id = ? AND title = ? LIMIT 1'
    ).get(projectId, title) as any
    return row
      ? { ...row, meta: safeJsonParse(row.meta, null, 'event.meta') }
      : undefined
  }

  findEventByShareHash(shareHash: string): EventRow | undefined {
    const row = this.sql(
      'SELECT * FROM claw_event WHERE share_hash = ? LIMIT 1'
    ).get(shareHash) as any
    return row
      ? { ...row, meta: safeJsonParse(row.meta, null, 'event.meta') }
      : undefined
  }

  findEventsByProjectIdAndBiz(projectId: number, biz: string): EventRow[] {
    const rows = this.sql(
      'SELECT * FROM claw_event WHERE project_id = ? AND biz = ? ORDER BY CASE WHEN day IS NULL THEN 1 ELSE 0 END, day DESC'
    ).all(projectId, biz) as any[]
    return rows.map((r) => ({
      ...r,
      meta: safeJsonParse(r.meta, null, 'event.meta'),
    }))
  }

  insertEvent(input: AddEventInput): EventRow {
    const info = this.sql(
      `
      INSERT INTO claw_event (created_at, updated_at, project_id, biz, title, description, day, type, meta)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $projectId, $biz, $title, $description, $day, $type, $meta)
    `
    ).run({
      projectId: input.projectId,
      biz: input.biz?.trim() || null,
      title: input.title,
      description: input.description ?? null,
      day: input.day ?? null,
      type: input.type ?? null,
      meta: input.meta != null ? JSON.stringify(input.meta) : null,
    })
    return this.findEventById(Number(info.lastInsertRowid))!
  }

  updateEvent(id: number, input: UpdateEventInput): void {
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
    if (input.description != null) {
      fields.push('description = $description')
      params.description = input.description
    }
    if (input.day != null) {
      fields.push('day = $day')
      params.day = input.day
    }
    if (input.type != null) {
      fields.push('type = $type')
      params.type = input.type
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
    this.sql(`UPDATE claw_event SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteEvent(id: number): boolean {
    const row = this.findEventById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_event WHERE id = ?').run(id)
    return true
  }

  deleteEventsByProjectId(projectId: number): void {
    this.sql('DELETE FROM claw_event WHERE project_id = ?').run(projectId)
  }
}
