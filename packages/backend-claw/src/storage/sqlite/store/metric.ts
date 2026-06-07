import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AddMetricInput,
  DeleteMetricItemInput,
  MetricItemRow,
  MetricRow,
  UpdateMetricInput,
  UpsertMetricItemInput,
} from '../../store/types.js'

export class SqliteClawMetricStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findMetricByProjectId(projectId: number): MetricRow[] {
    return this.sql(
      'SELECT * FROM claw_metric WHERE project_id = ? ORDER BY sort ASC, id ASC'
    ).all(projectId) as MetricRow[]
  }

  findMetricById(id: number): MetricRow | undefined {
    return this.sql('SELECT * FROM claw_metric WHERE id = ?').get(id) as
      | MetricRow
      | undefined
  }

  insertMetric(input: AddMetricInput): MetricRow {
    const info = this.sql(
      `
      INSERT INTO claw_metric (created_at, updated_at, project_id, name, title, sort, remark, summary_mode)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $projectId, $name, $title, $sort, $remark, $summaryMode)
    `
    ).run({
      projectId: input.projectId,
      name: input.name,
      title: input.title,
      sort: input.sort ?? 0,
      remark: input.remark ?? null,
      summaryMode: input.summaryMode ?? 'sum',
    })
    return this.findMetricById(Number(info.lastInsertRowid))!
  }

  updateMetric(id: number, input: UpdateMetricInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }
    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.sort != null) {
      fields.push('sort = $sort')
      params.sort = input.sort
    }
    if ('remark' in input) {
      fields.push('remark = $remark')
      params.remark = input.remark ?? null
    }
    if (input.summaryMode != null) {
      fields.push('summary_mode = $summaryMode')
      params.summaryMode = input.summaryMode
    }
    if (fields.length === 0) return
    this.sql(`UPDATE claw_metric SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteMetric(id: number): boolean {
    const row = this.findMetricById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_metric WHERE id = ?').run(id)
    return true
  }

  deleteMetricByProjectId(projectId: number): void {
    this.sql('DELETE FROM claw_metric WHERE project_id = ?').run(projectId)
  }

  findMetricItems(
    projectId: number,
    options: { name?: string; startDay?: string; endDay?: string } = {}
  ): MetricItemRow[] {
    const conditions = ['project_id = ?']
    const params: unknown[] = [projectId]
    if (options.name) {
      conditions.push('name = ?')
      params.push(options.name)
    }
    if (options.startDay) {
      conditions.push('day >= ?')
      params.push(options.startDay)
    }
    if (options.endDay) {
      conditions.push('day <= ?')
      params.push(options.endDay)
    }
    return this.sql(
      `SELECT * FROM claw_metric_item WHERE ${conditions.join(' AND ')} ORDER BY day ASC, name ASC`
    ).all(...params) as MetricItemRow[]
  }

  upsertMetricItem(input: UpsertMetricItemInput): MetricItemRow {
    this.sql(
      `
      INSERT INTO claw_metric_item (created_at, updated_at, project_id, day, name, value, remark)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $projectId, $day, $name, $value, $remark)
      ON CONFLICT(project_id, day, name) DO UPDATE SET
        value      = excluded.value,
        remark     = excluded.remark,
        updated_at = datetime('now', 'localtime')
    `
    ).run({
      projectId: input.projectId,
      day: input.day,
      name: input.name,
      value: input.value,
      remark: input.remark ?? null,
    })

    return this.sql(
      'SELECT * FROM claw_metric_item WHERE project_id = ? AND day = ? AND name = ?'
    ).get(input.projectId, input.day, input.name) as MetricItemRow
  }

  deleteMetricItems(input: DeleteMetricItemInput): void {
    const conditions = ['project_id = ?']
    const params: unknown[] = [input.projectId]
    if (input.day) {
      conditions.push('day = ?')
      params.push(input.day)
    }
    if (input.name) {
      conditions.push('name = ?')
      params.push(input.name)
    }
    this.sql(
      `DELETE FROM claw_metric_item WHERE ${conditions.join(' AND ')}`
    ).run(...params)
  }
}
