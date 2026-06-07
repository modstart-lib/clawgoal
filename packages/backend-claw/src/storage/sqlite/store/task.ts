import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type { ClawTaskRow } from '../../store/task.js'

export class SqliteClawTaskStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findAllTasks(
    tenantId: number,
    userId: number,
    options?: {
      status?: string
      agentId?: number
      limit?: number
      source?: string
      projectId?: number
    }
  ): ClawTaskRow[] {
    const conditions: string[] = ['tenant_id = ?', 'user_id = ?']
    const params: unknown[] = [tenantId, userId]
    if (options?.status && options.status !== 'all') {
      conditions.push('status = ?')
      params.push(options.status)
    }
    if (options?.agentId) {
      conditions.push('agent_id = ?')
      params.push(options.agentId)
    }
    if (options?.source && options.source !== 'all') {
      conditions.push('source = ?')
      params.push(options.source)
    }
    if (options?.projectId != null) {
      conditions.push('project_id = ?')
      params.push(options.projectId)
    }
    const where = `WHERE ${conditions.join(' AND ')}`
    const limit = options?.limit ? `LIMIT ${options.limit}` : 'LIMIT 100'
    return this.sql(
      `SELECT * FROM claw_task ${where} ORDER BY created_at DESC ${limit}`
    ).all(...params) as ClawTaskRow[]
  }

  paginateTasks(
    tenantId: number,
    userId: number,
    options: {
      status?: string
      agentId?: number
      keyword?: string
      source?: string
      hasParent?: boolean
      rootOnly?: boolean
      projectId?: number
      page: number
      pageSize: number
    }
  ): { items: ClawTaskRow[]; total: number } {
    const conditions: string[] = ['tenant_id = ?', 'user_id = ?']
    const params: unknown[] = [tenantId, userId]
    if (options.status && options.status !== 'all') {
      conditions.push('status = ?')
      params.push(options.status)
    }
    if (options.agentId) {
      conditions.push('agent_id = ?')
      params.push(options.agentId)
    }
    if (options.keyword) {
      const kw = options.keyword.trim()
      const parsed = kw.replace(/^#/, '')
      const numId = parseInt(parsed, 10)
      if (!isNaN(numId) && String(numId) === parsed) {
        conditions.push('id = ?')
        params.push(numId)
      } else {
        conditions.push('(title LIKE ? OR description LIKE ?)')
        params.push(`%${kw}%`, `%${kw}%`)
      }
    }
    if (options.source && options.source !== 'all') {
      conditions.push('source = ?')
      params.push(options.source)
    }
    if (options.rootOnly) {
      conditions.push('root_id = 0')
    } else if (options.hasParent === true) {
      conditions.push('parent_id > 0')
    } else if (options.hasParent === false) {
      conditions.push('parent_id = 0')
    }
    if (options.projectId != null) {
      conditions.push('project_id = ?')
      params.push(options.projectId)
    }
    const where = `WHERE ${conditions.join(' AND ')}`
    const total = (
      this.sql(`SELECT COUNT(*) as cnt FROM claw_task ${where}`).get(
        ...params
      ) as { cnt: number }
    ).cnt
    const offset = (options.page - 1) * options.pageSize
    const items = this.sql(
      `SELECT * FROM claw_task ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...params, options.pageSize, offset) as ClawTaskRow[]
    return { items, total }
  }

  findTaskById(id: number): ClawTaskRow | undefined {
    return this.sql('SELECT * FROM claw_task WHERE id = ?').get(id) as
      | ClawTaskRow
      | undefined
  }

  insertTask(input: any): ClawTaskRow {
    const info = this.sql(
      `
      INSERT INTO claw_task (created_at, updated_at, tenant_id, user_id, agent_id, start_at, end_at, status, status_remark, title, description, processing, result, objective_id, key_result_id, session_id, due_at, estimated_hours, shared_content, source, parent_id, root_id, sort, needs, project_id, logs)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $agentId, $startAt, $endAt, $status, $statusRemark, $title, $description, $processing, $result, $objectiveId, $keyResultId, $sessionId, $dueAt, $estimatedHours, $sharedContent, $source, $parentId, $rootId, $sort, $needs, $projectId, '[]')
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId ?? null,
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      status: input.status ?? 'draft',
      statusRemark: input.statusRemark ?? null,
      title: input.title,
      description: input.description ?? null,
      processing: input.processing ?? null,
      result: input.result ?? null,
      objectiveId: input.objectiveId ?? 0,
      keyResultId: input.keyResultId ?? 0,
      sessionId: input.sessionId ?? 0,
      dueAt: input.dueAt ?? null,
      estimatedHours: input.estimatedHours ?? null,
      sharedContent:
        input.sharedContent != null
          ? JSON.stringify(input.sharedContent)
          : null,
      source: input.source ?? 'manual',
      parentId: input.parentId ?? 0,
      rootId: input.rootId ?? 0,
      sort: input.sort ?? 0,
      needs: input.needs != null ? JSON.stringify(input.needs) : '[]',
      projectId: input.projectId ?? null,
    })
    return this.findTaskById(Number(info.lastInsertRowid))!
  }

  getNextChildSort(parentId: number): number {
    const siblings = this.findChildTasks(parentId)
    if (!siblings.length) return 0
    return Math.max(...siblings.map((s) => (s as any).sort ?? 0)) + 1
  }

  updateTask(id: number, input: any): void {
    const fields: string[] = ["updated_at = datetime('now', 'localtime')"]
    const params: Record<string, unknown> = { id }

    if (input.agentId != null) {
      fields.push('agent_id = $agentId')
      params.agentId = input.agentId
    }
    if (input.startAt != null) {
      fields.push('start_at = $startAt')
      params.startAt = input.startAt
    }
    if (input.endAt != null) {
      fields.push('end_at = $endAt')
      params.endAt = input.endAt
    }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.statusRemark != null) {
      fields.push('status_remark = $statusRemark')
      params.statusRemark = input.statusRemark
    }
    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.description != null) {
      fields.push('description = $description')
      params.description = input.description
    }
    if (input.processing !== undefined) {
      fields.push('processing = $processing')
      params.processing = input.processing ?? null
    }
    if (input.result !== undefined) {
      fields.push('result = $result')
      params.result = input.result ?? null
    }
    if (input.objectiveId != null) {
      fields.push('objective_id = $objectiveId')
      params.objectiveId = input.objectiveId
    }
    if (input.keyResultId != null) {
      fields.push('key_result_id = $keyResultId')
      params.keyResultId = input.keyResultId
    }
    if (input.sessionId !== undefined) {
      fields.push('session_id = $sessionId')
      params.sessionId = input.sessionId ?? 0
    }
    if (input.dueAt !== undefined) {
      fields.push('due_at = $dueAt')
      params.dueAt = input.dueAt
    }
    if (input.estimatedHours !== undefined) {
      fields.push('estimated_hours = $estimatedHours')
      params.estimatedHours = input.estimatedHours
    }
    if (input.sharedContent !== undefined) {
      fields.push('shared_content = $sharedContent')
      params.sharedContent =
        input.sharedContent != null ? JSON.stringify(input.sharedContent) : null
    }
    if (input.source !== undefined && input.source !== null) {
      fields.push('source = $source')
      params.source = input.source
    }
    if (input.parentId !== undefined) {
      fields.push('parent_id = $parentId')
      params.parentId = input.parentId ?? 0
    }
    if (input.rootId !== undefined) {
      fields.push('root_id = $rootId')
      params.rootId = input.rootId ?? 0
    }
    if (input.needs !== undefined) {
      fields.push('needs = $needs')
      params.needs = input.needs != null ? JSON.stringify(input.needs) : '[]'
    }

    this.sql(`UPDATE claw_task SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteTask(id: number): boolean {
    const row = this.findTaskById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_task WHERE id = ?').run(id)
    return true
  }

  /** 追加一条日志到 logs JSON 数组 */
  appendTaskLog(id: number, entry: string): void {
    const row = this.findTaskById(id)
    if (!row) return
    let logs: string[] = []
    try {
      logs = JSON.parse(row.logs || '[]')
    } catch {}
    logs.push(entry)
    if (logs.length > 500) logs = logs.slice(-500)
    this.sql(
      `UPDATE claw_task SET logs = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(JSON.stringify(logs), id)
  }

  /** 清空日志 */
  clearTaskLogs(id: number): void {
    this.sql(
      `UPDATE claw_task SET logs = '[]', updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(id)
  }

  /** 查询某个 project 下是否有正在执行的任务 */
  hasRunningTaskForProject(projectId: number): boolean {
    const row = this.sql(
      `SELECT id FROM claw_task WHERE project_id = ? AND status = 'running' LIMIT 1`
    ).get(projectId) as { id: number } | undefined
    return !!row
  }

  /** 查询某个 agent 下是否有正在执行的任务 */
  hasRunningTaskForAgent(agentId: number): boolean {
    const row = this.sql(
      `SELECT id FROM claw_task WHERE agent_id = ? AND status = 'running' LIMIT 1`
    ).get(agentId) as { id: number } | undefined
    return !!row
  }

  updateTaskStatus(
    id: number,
    status: string,
    statusRemark?: string | null
  ): void {
    this.sql(
      `
      UPDATE claw_task SET status = ?, status_remark = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
    `
    ).run(status, statusRemark ?? null, id)
  }

  countTasksByStatus(
    tenantId: number,
    userId: number,
    options?: { projectId?: number }
  ): Record<string, number> {
    if (options?.projectId != null) {
      const rows = this.sql(
        'SELECT status, COUNT(*) as cnt FROM claw_task WHERE tenant_id = ? AND user_id = ? AND project_id = ? GROUP BY status'
      ).all(tenantId, userId, options.projectId) as {
        status: string
        cnt: number
      }[]
      const result: Record<string, number> = {}
      for (const row of rows) result[row.status] = row.cnt
      return result
    }
    const rows = this.sql(
      'SELECT status, COUNT(*) as cnt FROM claw_task WHERE tenant_id = ? AND user_id = ? GROUP BY status'
    ).all(tenantId, userId) as { status: string; cnt: number }[]
    const result: Record<string, number> = {}
    for (const row of rows) result[row.status] = row.cnt
    return result
  }

  findTasksByKeyResultId(
    tenantId: number,
    userId: number,
    keyResultId: number
  ): ClawTaskRow[] {
    return this.sql(
      `SELECT * FROM claw_task WHERE tenant_id = ? AND user_id = ? AND key_result_id = ? ORDER BY created_at DESC LIMIT 50`
    ).all(tenantId, userId, keyResultId) as ClawTaskRow[]
  }

  findChildTasks(taskId: number): ClawTaskRow[] {
    return this.sql(
      'SELECT * FROM claw_task WHERE parent_id = ? ORDER BY sort ASC, created_at ASC'
    ).all(taskId) as ClawTaskRow[]
  }

  findDescendants(rootTaskId: number): ClawTaskRow[] {
    return this.sql(
      'SELECT * FROM claw_task WHERE root_id = ? ORDER BY sort ASC, created_at ASC'
    ).all(rootTaskId) as ClawTaskRow[]
  }

  findDescendantsByRootIds(rootIds: number[]): ClawTaskRow[] {
    if (rootIds.length === 0) return []
    const placeholders = rootIds.map(() => '?').join(',')
    return this.sql(
      `SELECT * FROM claw_task WHERE root_id IN (${placeholders}) ORDER BY sort ASC, created_at ASC`
    ).all(...rootIds) as ClawTaskRow[]
  }

  findReadyTasksWithAgent(): ClawTaskRow[] {
    return this.sql(
      "SELECT * FROM claw_task WHERE status = 'ready' AND agent_id IS NOT NULL ORDER BY created_at ASC"
    ).all() as ClawTaskRow[]
  }

  /**
   * 解析任务的 needs 字段为数字数组
   */
  private parseNeeds(needsStr: string): string[] {
    try {
      const parsed = JSON.parse(needsStr || '[]')
      return Array.isArray(parsed)
        ? parsed.map(String).filter((s) => Number(s) > 0)
        : []
    } catch {
      return []
    }
  }

  /**
   * 检查一个任务的依赖是否全部完成（status = success）
   */
  isTaskNeedsMet(task: ClawTaskRow): boolean {
    const needs = this.parseNeeds(task.needs)
    if (needs.length === 0) return true
    for (const depIdStr of needs) {
      const dep = this.findTaskById(Number(depIdStr))
      if (!dep || dep.status !== 'success') return false
    }
    return true
  }

  /**
   * 当父任务变为 ready 时，检查子任务中 queue 状态且依赖已满足的 → 晋升为 ready
   * @returns 被晋升的子任务 ID 列表
   */
  checkAndPromoteQueuedChildren(parentId: number): number[] {
    const children = this.findChildTasks(parentId)
    const promoted: number[] = []
    for (const child of children) {
      if (child.status !== 'queue') continue
      if (this.isTaskNeedsMet(child)) {
        this.updateTaskStatus(child.id, 'ready', null)
        promoted.push(child.id)
      }
    }
    return promoted
  }

  /**
   * 当某任务完成后，检查同级任务中 queue 状态且依赖已全部满足的 → 晋升为 ready
   * @returns 被晋升的同级任务 ID 列表
   */
  checkAndPromoteQueuedSiblings(completedTaskId: number): number[] {
    const task = this.findTaskById(completedTaskId)
    if (!task) return []
    // 获取同级任务
    const siblings =
      task.parent_id > 0
        ? this.findChildTasks(task.parent_id)
        : (this.sql(
            "SELECT * FROM claw_task WHERE parent_id = 0 AND tenant_id = ? AND user_id = ? AND status = 'queue'"
          ).all(task.tenant_id, task.user_id) as ClawTaskRow[])
    const promoted: number[] = []
    for (const sibling of siblings) {
      if (sibling.id === completedTaskId) continue
      if (sibling.status !== 'queue') continue
      if (this.isTaskNeedsMet(sibling)) {
        this.updateTaskStatus(sibling.id, 'ready', null)
        promoted.push(sibling.id)
      }
    }
    return promoted
  }

  /**
   * 当子任务完成后，检查父任务：
   * 1. 如果所有子任务均 success → 父任务也自动设为 success，并向上级联
   * 2. 如果父任务处于 pending 且所有子任务 success → 笔升为 ready
   * @returns 状态发生变化的父任务 ID，没有则返回 null
   */
  checkAndAutoCompleteParent(taskId: number): number | null {
    const task = this.findTaskById(taskId)
    if (!task || task.parent_id === 0) return null

    const parent = this.findTaskById(task.parent_id)
    if (!parent) return null

    const siblings = this.findChildTasks(parent.id)
    const allSuccess = siblings.every((s) => s.status === 'success')
    if (!allSuccess) return null

    // 所有子任务均完成→父任务自动完成
    this.updateTaskStatus(parent.id, 'success', null)
    // 向上级联
    this.checkAndAutoCompleteParent(parent.id)
    return parent.id
  }
}
