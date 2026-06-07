import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  ClawTaskJobRow,
  InsertClawTaskJobInput,
  UpdateClawTaskJobInput,
} from '../../store/task_job.js'

export class SqliteClawTaskJobStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findReadyTaskJobs(): ClawTaskJobRow[] {
    return this.sql(
      "SELECT * FROM claw_task_job WHERE status = 'ready' ORDER BY sort ASC, created_at ASC"
    ).all() as ClawTaskJobRow[]
  }

  findTaskJobsByTaskId(taskId: number): ClawTaskJobRow[] {
    return this.sql(
      'SELECT * FROM claw_task_job WHERE task_id = ? ORDER BY sort ASC'
    ).all(taskId) as ClawTaskJobRow[]
  }

  findTaskJobsByAgentId(agentId: number, status?: string): ClawTaskJobRow[] {
    if (status) {
      return this.sql(
        'SELECT * FROM claw_task_job WHERE agent_id = ? AND status = ? ORDER BY sort ASC'
      ).all(agentId, status) as ClawTaskJobRow[]
    }
    return this.sql(
      'SELECT * FROM claw_task_job WHERE agent_id = ? ORDER BY sort ASC'
    ).all(agentId) as ClawTaskJobRow[]
  }

  findAllTaskJobs(
    tenantId: number,
    userId: number,
    options?: {
      taskId?: number
      agentId?: number
      status?: string
      keyword?: string
      dateStart?: string
      dateEnd?: string
      page?: number
      pageSize?: number
    }
  ): { items: ClawTaskJobRow[]; total: number } {
    const conditions: string[] = ['tenant_id = ?', 'user_id = ?']
    const params: unknown[] = [tenantId, userId]
    if (options?.taskId) {
      conditions.push('task_id = ?')
      params.push(options.taskId)
    }
    if (options?.agentId) {
      conditions.push('agent_id = ?')
      params.push(options.agentId)
    }
    if (options?.status && options.status !== 'all') {
      conditions.push('status = ?')
      params.push(options.status)
    }
    if (options?.keyword) {
      const kw = options.keyword.trim()
      const parsed = kw.replace(/^#/, '')
      const numId = parseInt(parsed, 10)
      if (!isNaN(numId) && String(numId) === parsed) {
        conditions.push('id = ?')
        params.push(numId)
      } else {
        conditions.push('(input LIKE ? OR output LIKE ?)')
        params.push(`%${kw}%`, `%${kw}%`)
      }
    }
    if (options?.dateStart) {
      conditions.push('created_at >= ?')
      params.push(options.dateStart)
    }
    if (options?.dateEnd) {
      conditions.push('created_at <= ?')
      params.push(options.dateEnd)
    }
    const where = `WHERE ${conditions.join(' AND ')}`
    const total = (
      this.sql(`SELECT COUNT(*) as cnt FROM claw_task_job ${where}`).get(
        ...params
      ) as { cnt: number }
    ).cnt
    const page = options?.page ?? 1
    const pageSize = options?.pageSize ?? 20
    const offset = (page - 1) * pageSize
    const items = this.sql(
      `SELECT * FROM claw_task_job ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as ClawTaskJobRow[]
    return { items, total }
  }

  findTaskJobById(id: number): ClawTaskJobRow | undefined {
    return this.sql('SELECT * FROM claw_task_job WHERE id = ?').get(id) as
      | ClawTaskJobRow
      | undefined
  }

  insertTaskJob(input: InsertClawTaskJobInput): ClawTaskJobRow {
    const info = this.sql(
      `
      INSERT INTO claw_task_job (created_at, updated_at, tenant_id, user_id, agent_id, task_id, task_objective_id, task_key_result_id, source_agent_id, sort, status, input, meta)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $agentId, $taskId, $taskObjectiveId, $taskKeyResultId, $sourceAgentId, $sort, $status, $input, $meta)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      taskId: input.taskId ?? 0,
      taskObjectiveId: input.taskObjectiveId ?? 0,
      taskKeyResultId: input.taskKeyResultId ?? 0,
      sourceAgentId: input.sourceAgentId ?? 0,
      sort: input.sort ?? 0,
      status: input.status ?? 'draft',
      input: input.input ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    })
    return this.findTaskJobById(Number(info.lastInsertRowid))!
  }

  updateTaskJob(id: number, input: UpdateClawTaskJobInput): void {
    const fields: string[] = [`updated_at = datetime('now', 'localtime')`]
    const params: Record<string, unknown> = { id }

    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.output !== undefined) {
      fields.push('output = $output')
      params.output = input.output
    }
    if (input.meta !== undefined) {
      fields.push('meta = $meta')
      params.meta = input.meta ? JSON.stringify(input.meta) : null
    }
    if (input.input !== undefined) {
      fields.push('input = $input')
      params.input = input.input
    }
    if (input.agentId != null) {
      fields.push('agent_id = $agentId')
      params.agentId = input.agentId
    }

    this.sql(
      `UPDATE claw_task_job SET ${fields.join(', ')} WHERE id = $id`
    ).run(params)
  }

  updateTaskJobStatus(
    id: number,
    status: string,
    output?: string | null
  ): void {
    this.sql(
      `UPDATE claw_task_job SET status = ?, output = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(status, output ?? null, id)
  }

  /** 将同一 taskId 下所有未完成的作业设置为 canceled */
  cancelRemainingTaskJobsByTaskId(taskId: number): void {
    this.sql(
      `UPDATE claw_task_job SET status = 'canceled', updated_at = datetime('now', 'localtime') WHERE task_id = ? AND status NOT IN ('success', 'fail', 'canceled')`
    ).run(taskId)
  }

  countTaskJobsByStatus(
    tenantId: number,
    userId: number
  ): Record<string, number> {
    const rows = this.sql(
      'SELECT status, COUNT(*) as cnt FROM claw_task_job WHERE tenant_id = ? AND user_id = ? GROUP BY status'
    ).all(tenantId, userId) as { status: string; cnt: number }[]
    const result: Record<string, number> = {}
    for (const row of rows) result[row.status] = row.cnt
    return result
  }

  deleteTaskJob(id: number): boolean {
    const row = this.findTaskJobById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_task_job WHERE id = ?').run(id)
    return true
  }
}
