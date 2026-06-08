import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import { safeJsonParse } from '../../../../../backend/src/utils/json.js'
import type {
  AddBacklogInput,
  BacklogRow,
  UpdateBacklogInput,
} from '../../store/types.js'

export class SqliteClawBacklogStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  private readonly PRIORITY_ORDER = `CASE priority
      WHEN 'high'   THEN 0
      WHEN 'medium' THEN 1
      WHEN 'low'    THEN 2
      ELSE 3
    END ASC`

  private readonly STATUS_ORDER = `CASE status
      WHEN 'active'  THEN 0
      WHEN 'pending' THEN 1
      WHEN 'pool'    THEN 2
      WHEN 'dropped' THEN 3
      WHEN 'done'    THEN 4
      ELSE 5
    END ASC`

  private readonly DUE_ORDER = `CASE WHEN due_at IS NULL OR due_at = '' THEN 1 ELSE 0 END ASC, due_at ASC, id DESC`

  findBacklogsByProjectId(
    projectId: number,
    options?: {
      status?: string
      priority?: string
      sortBy?: 'priority' | 'status'
    }
  ): BacklogRow[] {
    const sortBy = options?.sortBy ?? 'status'
    const ORDER =
      sortBy === 'priority'
        ? `ORDER BY ${this.PRIORITY_ORDER}, ${this.STATUS_ORDER}, ${this.DUE_ORDER}`
        : `ORDER BY ${this.STATUS_ORDER}, ${this.PRIORITY_ORDER}, ${this.DUE_ORDER}`

    const conditions: string[] = ['project_id = ?']
    const params: unknown[] = [projectId]
    if (options?.status) {
      conditions.push('status = ?')
      params.push(options.status)
    }
    if (options?.priority) {
      conditions.push('priority = ?')
      params.push(options.priority)
    }
    const rows = this.sql(
      `SELECT * FROM claw_backlog WHERE ${conditions.join(' AND ')} ${ORDER}`
    ).all(...params) as any[]
    return rows.map((r) => ({
      ...r,
      meta: safeJsonParse(r.meta, null, 'backlog.meta'),
    }))
  }

  paginateBacklogsByProjectId(
    projectId: number,
    options?: {
      status?: string
      priority?: string
      type?: string
      keyword?: string
      sortBy?: 'priority' | 'status'
      page?: number
      pageSize?: number
    }
  ): { records: BacklogRow[]; total: number } {
    const sortBy = options?.sortBy ?? 'status'
    const ORDER =
      sortBy === 'priority'
        ? `ORDER BY ${this.PRIORITY_ORDER}, ${this.STATUS_ORDER}, ${this.DUE_ORDER}`
        : `ORDER BY ${this.STATUS_ORDER}, ${this.PRIORITY_ORDER}, ${this.DUE_ORDER}`

    const page = Math.max(1, options?.page ?? 1)
    const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 20))
    const offset = (page - 1) * pageSize

    const conditions: string[] = ['project_id = ?']
    const params: unknown[] = [projectId]

    if (options?.status) {
      conditions.push('status = ?')
      params.push(options.status)
    }
    if (options?.priority) {
      conditions.push('priority = ?')
      params.push(options.priority)
    }
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
        conditions.push('(title LIKE ? OR detail LIKE ?)')
        params.push(`%${kw}%`, `%${kw}%`)
      }
    }

    const where = conditions.join(' AND ')
    const total = (
      this.sql(`SELECT COUNT(*) as cnt FROM claw_backlog WHERE ${where}`).get(
        ...params
      ) as { cnt: number }
    ).cnt
    const records = this.sql(
      `SELECT * FROM claw_backlog WHERE ${where} ${ORDER} LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as any[]
    return {
      records: records.map((r) => ({
        ...r,
        meta: safeJsonParse(r.meta, null, 'backlog.meta'),
      })),
      total,
    }
  }

  findBacklogTypesByProjectId(projectId: number): string[] {
    const rows = this.sql(
      "SELECT DISTINCT type FROM claw_backlog WHERE project_id = ? AND type IS NOT NULL AND type != '' ORDER BY type"
    ).all(projectId) as { type: string }[]
    return rows.map((r) => r.type)
  }

  findBacklogById(id: number): BacklogRow | undefined {
    const row = this.sql('SELECT * FROM claw_backlog WHERE id = ?').get(
      id
    ) as any
    return row
      ? { ...row, meta: safeJsonParse(row.meta, null, 'backlog.meta') }
      : undefined
  }

  findBacklogsBySource(source: string, projectId?: number): BacklogRow[] {
    const rows = projectId
      ? (this.sql(
          'SELECT * FROM claw_backlog WHERE source = ? AND project_id = ? ORDER BY id DESC'
        ).all(source, projectId) as any[])
      : (this.sql(
          'SELECT * FROM claw_backlog WHERE source = ? ORDER BY id DESC'
        ).all(source) as any[])
    return rows.map((r) => ({
      ...r,
      meta: safeJsonParse(r.meta, null, 'backlog.meta'),
    }))
  }

  insertBacklog(input: AddBacklogInput): BacklogRow {
    const info = this.sql(
      `
      INSERT INTO claw_backlog (created_at, updated_at, project_id, title, status, type, due_at, source, reason, active_at, done_at, detail, priority, meta)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $projectId, $title, $status, $type, $dueAt, $source, $reason, $activeAt, $doneAt, $detail, $priority, $meta)
    `
    ).run({
      projectId: input.projectId,
      title: input.title,
      status: input.status ?? 'pending',
      type: input.type ?? null,
      dueAt: input.dueAt ?? null,
      source: input.source ?? null,
      reason: input.reason ?? null,
      activeAt: input.activeAt ?? null,
      doneAt: input.doneAt ?? null,
      detail: input.detail ?? null,
      priority: input.priority ?? 'medium',
      meta: input.meta != null ? JSON.stringify(input.meta) : null,
    })
    return this.findBacklogById(Number(info.lastInsertRowid))!
  }

  updateBacklog(id: number, input: UpdateBacklogInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }
    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if ('type' in input) {
      fields.push('type = $type')
      params.type = input.type ?? null
    }
    if ('dueAt' in input) {
      fields.push('due_at = $dueAt')
      params.dueAt = input.dueAt ?? null
    }
    if ('source' in input) {
      fields.push('source = $source')
      params.source = input.source ?? null
    }
    if ('reason' in input) {
      fields.push('reason = $reason')
      params.reason = input.reason ?? null
    }
    if ('activeAt' in input) {
      fields.push('active_at = $activeAt')
      params.activeAt = input.activeAt ?? null
    }
    if ('doneAt' in input) {
      fields.push('done_at = $doneAt')
      params.doneAt = input.doneAt ?? null
    }
    if ('detail' in input) {
      fields.push('detail = $detail')
      params.detail = input.detail ?? null
    }
    if ('priority' in input) {
      fields.push('priority = $priority')
      params.priority = input.priority ?? null
    }
    if ('meta' in input) {
      fields.push('meta = $meta')
      params.meta = input.meta != null ? JSON.stringify(input.meta) : null
    }
    if (fields.length === 0) return
    this.sql(`UPDATE claw_backlog SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteBacklog(id: number): boolean {
    const row = this.findBacklogById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_backlog WHERE id = ?').run(id)
    return true
  }

  deleteBacklogsByProjectId(projectId: number): void {
    this.sql('DELETE FROM claw_backlog WHERE project_id = ?').run(projectId)
  }
}
