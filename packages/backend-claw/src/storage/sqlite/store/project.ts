import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AddProjectInput,
  ProjectRow,
  UpdateProjectInput,
} from '../../store/types.js'
import { SqliteClawEventStore } from './event.js'
import { SqliteClawMetricStore } from './metric.js'
import { SqliteClawBacklogStore } from './backlog.js'
import { SqliteClawNoteStore } from './note.js'

export class SqliteClawProjectStore {
  private sql: (query: string) => Statement
  readonly event: SqliteClawEventStore
  readonly metric: SqliteClawMetricStore
  readonly backlog: SqliteClawBacklogStore
  readonly note: SqliteClawNoteStore

  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
    this.event = new SqliteClawEventStore(db)
    this.metric = new SqliteClawMetricStore(db)
    this.backlog = new SqliteClawBacklogStore(db)
    this.note = new SqliteClawNoteStore(db)
  }

  // ─── Project ─────────────────────────────────────────────────────────────

  findAllProjects(tenantId: number, userId: number): ProjectRow[] {
    const rows = this.sql(
      'SELECT * FROM claw_project WHERE tenant_id = ? AND user_id = ? ORDER BY updated_at DESC'
    ).all(tenantId, userId) as any[]
    return rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null }))
  }

  findProjectById(id: number): ProjectRow | undefined {
    const row = this.sql('SELECT * FROM claw_project WHERE id = ?').get(id) as any
    return row ? { ...row, meta: row.meta ? JSON.parse(row.meta) : null } : undefined
  }

  insertProject(input: AddProjectInput): ProjectRow {
    const info = this.sql(
      `
      INSERT INTO claw_project (created_at, updated_at, tenant_id, user_id, title, description, status, color, logo, start_at, due_at, meta)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $title, $description, $status, $color, $logo, $startAt, $dueAt, $meta)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'planning',
      color: input.color ?? '#6366f1',
      logo: input.logo ?? null,
      startAt: input.startAt ?? null,
      dueAt: input.dueAt ?? null,
      meta: input.meta != null ? JSON.stringify(input.meta) : null,
    })
    return this.findProjectById(Number(info.lastInsertRowid))!
  }

  updateProject(id: number, input: UpdateProjectInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.description != null) {
      fields.push('description = $description')
      params.description = input.description
    }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.color != null) {
      fields.push('color = $color')
      params.color = input.color
    }
    if (input.logo !== undefined) {
      fields.push('logo = $logo')
      params.logo = input.logo
    }
    if (input.startAt != null) {
      fields.push('start_at = $startAt')
      params.startAt = input.startAt
    }
    if (input.dueAt != null) {
      fields.push('due_at = $dueAt')
      params.dueAt = input.dueAt
    }
    if ('meta' in input) {
      fields.push('meta = $meta')
      params.meta = input.meta != null ? JSON.stringify(input.meta) : null
    }

    if (fields.length === 0) return
    this.sql(`UPDATE claw_project SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteProject(id: number): boolean {
    const row = this.findProjectById(id)
    if (!row) return false
    this.event.deleteEventsByProjectId(id)
    this.metric.deleteMetricByProjectId(id)
    this.backlog.deleteBacklogsByProjectId(id)
    this.note.deleteNotesByProjectId(id)
    this.sql('DELETE FROM claw_project WHERE id = ?').run(id)
    return true
  }
}
