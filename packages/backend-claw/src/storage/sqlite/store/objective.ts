import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AddKeyResultInput,
  AddObjectiveFocusInput,
  AddObjectiveInput,
  KeyResultRow,
  ObjectiveFocusRow,
  ObjectiveRow,
  UpdateKeyResultInput,
  UpdateObjectiveFocusInput,
  UpdateObjectiveInput,
} from '../../store/objective.js'

export class SqliteClawObjectiveStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  // ─── Objective ────────────────────────────────────────────────────────────

  findAllObjectives(
    tenantId: number,
    userId: number,
    options?: { projectId?: number }
  ): ObjectiveRow[] {
    if (options?.projectId != null) {
      return this.sql(
        'SELECT * FROM claw_objective WHERE tenant_id = ? AND user_id = ? AND project_id = ? ORDER BY created_at DESC'
      ).all(tenantId, userId, options.projectId) as ObjectiveRow[]
    }
    return this.sql(
      'SELECT * FROM claw_objective WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC'
    ).all(tenantId, userId) as ObjectiveRow[]
  }

  findObjectiveById(id: number): ObjectiveRow | undefined {
    return this.sql('SELECT * FROM claw_objective WHERE id = ?').get(id) as
      | ObjectiveRow
      | undefined
  }

  insertObjective(input: AddObjectiveInput): ObjectiveRow {
    const info = this.sql(
      `
      INSERT INTO claw_objective (created_at, updated_at, tenant_id, user_id, title, description, status, icon, result, project_id, start_at, end_at, due_at)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $title, $description, $status, $icon, $result, $projectId, $startAt, $endAt, $dueAt)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'active',
      icon: input.icon ?? 'target',
      result: input.result ?? null,
      projectId: input.projectId,
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      dueAt: input.dueAt ?? null,
    })
    return this.findObjectiveById(Number(info.lastInsertRowid))!
  }

  updateObjective(id: number, input: UpdateObjectiveInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.description !== undefined) {
      fields.push('description = $description')
      params.description = input.description
    }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.icon != null) {
      fields.push('icon = $icon')
      params.icon = input.icon
    }
    if (input.result !== undefined) {
      fields.push('result = $result')
      params.result = input.result
    }
    if (input.projectId !== undefined) {
      fields.push('project_id = $projectId')
      params.projectId = input.projectId ?? null
    }
    if (input.startAt !== undefined) {
      fields.push('start_at = $startAt')
      params.startAt = input.startAt
    }
    if (input.endAt !== undefined) {
      fields.push('end_at = $endAt')
      params.endAt = input.endAt
    }
    if (input.dueAt !== undefined) {
      fields.push('due_at = $dueAt')
      params.dueAt = input.dueAt
    }

    if (fields.length === 0) return
    this.sql(
      `UPDATE claw_objective SET ${fields.join(', ')} WHERE id = $id`
    ).run(params)
  }

  deleteObjective(id: number): boolean {
    const row = this.findObjectiveById(id)
    if (!row) return false
    this.deleteKeyResultsByObjectiveId(id)
    this.sql('DELETE FROM claw_objective WHERE id = ?').run(id)
    return true
  }

  // ─── KeyResult ─────────────────────────────────────────────────────────────────

  findAllKeyResults(
    tenantId: number,
    userId: number,
    options?: {
      objectiveId?: number
      status?: string
      page?: number
      pageSize?: number
    }
  ): { items: KeyResultRow[]; total: number } {
    const conditions: string[] = ['tenant_id = ?', 'user_id = ?']
    const params: unknown[] = [tenantId, userId]
    if (options?.objectiveId) {
      conditions.push('objective_id = ?')
      params.push(options.objectiveId)
    }
    if (options?.status && options.status !== 'all') {
      conditions.push('status = ?')
      params.push(options.status)
    }
    const where = `WHERE ${conditions.join(' AND ')}`
    const total = (
      this.sql(`SELECT COUNT(*) as cnt FROM claw_key_result ${where}`).get(
        ...params
      ) as { cnt: number }
    ).cnt
    const page = options?.page ?? 1
    const pageSize = options?.pageSize ?? 20
    const offset = (page - 1) * pageSize
    const items = this.sql(
      `SELECT * FROM claw_key_result ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as KeyResultRow[]
    return { items, total }
  }

  findKeyResultsByObjectiveId(objectiveId: number): KeyResultRow[] {
    return this.sql(
      'SELECT * FROM claw_key_result WHERE objective_id = ? ORDER BY created_at ASC'
    ).all(objectiveId) as KeyResultRow[]
  }

  findKeyResultById(id: number): KeyResultRow | undefined {
    return this.sql('SELECT * FROM claw_key_result WHERE id = ?').get(id) as
      | KeyResultRow
      | undefined
  }

  insertKeyResult(input: AddKeyResultInput): KeyResultRow {
    const info = this.sql(
      `
      INSERT INTO claw_key_result (created_at, updated_at, tenant_id, user_id, objective_id, title, detail, source_project_backlog_id, status, due_at, estimated_hours)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $objectiveId, $title, $detail, $sourceProjectBacklogId, $status, $dueAt, $estimatedHours)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      objectiveId: input.objectiveId,
      title: input.title,
      detail: input.detail ?? '',
      sourceProjectBacklogId: input.sourceProjectBacklogId ?? null,
      status: input.status ?? 'draft',
      dueAt: input.dueAt ?? null,
      estimatedHours: input.estimatedHours ?? null,
    })
    return this.findKeyResultById(Number(info.lastInsertRowid))!
  }

  updateKeyResult(id: number, input: UpdateKeyResultInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.detail != null) {
      fields.push('detail = $detail')
      params.detail = input.detail
    }
    if (input.sourceProjectBacklogId !== undefined) {
      fields.push('source_project_backlog_id = $sourceProjectBacklogId')
      params.sourceProjectBacklogId = input.sourceProjectBacklogId
    }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.dueAt !== undefined) {
      fields.push('due_at = $dueAt')
      params.dueAt = input.dueAt
    }
    if (input.estimatedHours !== undefined) {
      fields.push('estimated_hours = $estimatedHours')
      params.estimatedHours = input.estimatedHours
    }

    if (fields.length === 0) return
    this.sql(
      `UPDATE claw_key_result SET ${fields.join(', ')} WHERE id = $id`
    ).run(params)
  }

  deleteKeyResult(id: number): boolean {
    const row = this.findKeyResultById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_key_result WHERE id = ?').run(id)
    return true
  }

  deleteKeyResultsByObjectiveId(objectiveId: number): void {
    this.sql('DELETE FROM claw_key_result WHERE objective_id = ?').run(
      objectiveId
    )
  }

  // ─── ObjectiveFocus ───────────────────────────────────────────────────────

  findLatestFocus(
    tenantId: number,
    userId: number
  ): ObjectiveFocusRow | undefined {
    return this.sql(
      'SELECT * FROM claw_objective_focus WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(tenantId, userId) as ObjectiveFocusRow | undefined
  }

  findAllFocuses(
    tenantId: number,
    userId: number,
    limit?: number
  ): ObjectiveFocusRow[] {
    const l = limit ?? 20
    return this.sql(
      'SELECT * FROM claw_objective_focus WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(tenantId, userId, l) as ObjectiveFocusRow[]
  }

  findObjectiveFocusById(id: number): ObjectiveFocusRow | undefined {
    return this.sql('SELECT * FROM claw_objective_focus WHERE id = ?').get(
      id
    ) as ObjectiveFocusRow | undefined
  }

  insertObjectiveFocus(input: AddObjectiveFocusInput): ObjectiveFocusRow {
    const info = this.sql(
      `
      INSERT INTO claw_objective_focus (created_at, updated_at, tenant_id, user_id, action_ids, time)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $actionIds, $time)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      actionIds: input.actionIds ? JSON.stringify(input.actionIds) : null,
      time: input.time ?? null,
    })
    return this.findObjectiveFocusById(Number(info.lastInsertRowid))!
  }

  updateObjectiveFocus(id: number, input: UpdateObjectiveFocusInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if (input.actionIds !== undefined) {
      fields.push('action_ids = $actionIds')
      params.actionIds = input.actionIds
        ? JSON.stringify(input.actionIds)
        : null
    }
    if (input.time !== undefined) {
      fields.push('time = $time')
      params.time = input.time
    }

    if (fields.length === 0) return
    this.sql(
      `UPDATE claw_objective_focus SET ${fields.join(', ')} WHERE id = $id`
    ).run(params)
  }

  deleteObjectiveFocus(id: number): boolean {
    const row = this.findObjectiveFocusById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_objective_focus WHERE id = ?').run(id)
    return true
  }
}
