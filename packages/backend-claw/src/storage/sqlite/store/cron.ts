import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AddCronInput,
  CronLogRow,
  CronRow,
  InsertCronLogInput,
  UpdateCronInput,
} from '../../store/cron.js'

export class SqliteClawCronStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findAllCrons(
    tenantId: number,
    userId: number,
    onlyEnabled = false
  ): CronRow[] {
    if (onlyEnabled) {
      return this.sql(
        `SELECT * FROM claw_cron WHERE tenant_id = ? AND user_id = ? AND enable = 1 AND should_run = 1`
      ).all(tenantId, userId) as CronRow[]
    }
    return this.sql(
      'SELECT * FROM claw_cron WHERE tenant_id = ? AND user_id = ?'
    ).all(tenantId, userId) as CronRow[]
  }

  findAllEnabledCrons(): CronRow[] {
    return this.sql(
      'SELECT * FROM claw_cron WHERE enable = 1 AND should_run = 1'
    ).all() as CronRow[]
  }

  findCronsByAgentId(
    tenantId: number,
    userId: number,
    agentId: number
  ): CronRow[] {
    return this.sql(
      'SELECT * FROM claw_cron WHERE tenant_id = ? AND user_id = ? AND agent_id = ?'
    ).all(tenantId, userId, agentId) as CronRow[]
  }

  findCronById(id: number): CronRow | undefined {
    return this.sql('SELECT * FROM claw_cron WHERE id = ?').get(id) as
      | CronRow
      | undefined
  }

  insertCron(input: AddCronInput): CronRow {
    const stmt = this.sql(`
      INSERT INTO claw_cron (created_at, updated_at, tenant_id, user_id, agent_id, title, cron, enable, description, prompt, config, next_run_at, run_once, should_run, success_notify)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $agentId, $title, $cron, $enable, $description, $prompt, $config, $nextRunAt, $runOnce, 1, $successNotify)
    `)
    const info = stmt.run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      title: input.title,
      cron: input.cron,
      enable: input.enable !== false ? 1 : 0,
      description: input.description ?? null,
      prompt: input.prompt,
      config: input.config ? JSON.stringify(input.config) : null,
      nextRunAt: input.nextRunAt ?? null,
      runOnce: input.runOnce ? 1 : 0,
      successNotify: input.successNotify ? 1 : 0,
    })
    return this.findCronById(Number(info.lastInsertRowid))!
  }

  updateCron(id: number, input: UpdateCronInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if (input.agentId != null) {
      fields.push('agent_id = $agentId')
      params.agentId = input.agentId
    }
    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.cron != null) {
      fields.push('cron = $cron')
      params.cron = input.cron
    }
    if (input.enable != null) {
      fields.push('enable = $enable')
      params.enable = input.enable ? 1 : 0
    }
    if (input.description != null) {
      fields.push('description = $description')
      params.description = input.description
    }
    if (input.prompt != null) {
      fields.push('prompt = $prompt')
      params.prompt = input.prompt
    }
    if (input.config != null) {
      fields.push('config = $config')
      params.config = JSON.stringify(input.config)
    }
    if (input.lastRunAt != null) {
      fields.push('last_run_at = $lastRunAt')
      params.lastRunAt = input.lastRunAt
    }
    if (input.nextRunAt != null) {
      fields.push('next_run_at = $nextRunAt')
      params.nextRunAt = input.nextRunAt
    }
    if (input.lastStatus != null) {
      fields.push('last_status = $lastStatus')
      params.lastStatus = input.lastStatus
    }
    if (input.lastStatusRemark != null) {
      fields.push('last_status_remark = $lastStatusRemark')
      params.lastStatusRemark = input.lastStatusRemark
    }
    if (input.lastResult != null) {
      fields.push('last_result = $lastResult')
      params.lastResult = input.lastResult
    }
    if (input.runOnce != null) {
      fields.push('run_once = $runOnce')
      params.runOnce = input.runOnce ? 1 : 0
    }
    if (input.shouldRun != null) {
      fields.push('should_run = $shouldRun')
      params.shouldRun = input.shouldRun ? 1 : 0
    }
    if (input.successNotify != null) {
      fields.push('success_notify = $successNotify')
      params.successNotify = input.successNotify ? 1 : 0
    }

    if (fields.length === 0) return
    this.sql(`UPDATE claw_cron SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteCron(id: number): boolean {
    const row = this.findCronById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_cron WHERE id = ?').run(id)
    return true
  }

  insertCronLog(input: InsertCronLogInput): number {
    const info = this.sql(
      `
      INSERT INTO claw_cron_log (created_at, updated_at, tenant_id, user_id, agent_id, cron_id, title, start_at, end_at, status, status_remark, logs, result)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $agentId, $cronId, $title, $startAt, $endAt, $status, $statusRemark, $logs, $result)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId ?? null,
      cronId: input.cronId,
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt ?? null,
      status: input.status,
      statusRemark: input.statusRemark ?? null,
      logs: input.logs ?? null,
      result: input.result ?? null,
    })
    return Number(info.lastInsertRowid)
  }

  countCronLogs(tenantId: number, userId: number): number {
    const result = this.sql(
      'SELECT COUNT(*) as count FROM claw_cron_log WHERE tenant_id = ? AND user_id = ?'
    ).get(tenantId, userId) as { count: number }
    return result.count
  }

  countCronLogsFiltered(
    tenantId: number,
    userId: number,
    cronId?: number,
    startTime?: string,
    endTime?: string,
    agentId?: number
  ): number {
    const conditions = ['tenant_id = ?', 'user_id = ?']
    const params: (number | string)[] = [tenantId, userId]
    if (cronId !== undefined) {
      conditions.push('cron_id = ?')
      params.push(cronId)
    }
    if (agentId !== undefined) {
      conditions.push('agent_id = ?')
      params.push(agentId)
    }
    if (startTime) {
      conditions.push('start_at >= ?')
      params.push(startTime)
    }
    if (endTime) {
      conditions.push('start_at <= ?')
      params.push(endTime)
    }
    const result = this.sql(
      `SELECT COUNT(*) as count FROM claw_cron_log WHERE ${conditions.join(' AND ')}`
    ).get(...params) as { count: number }
    return result.count
  }

  listCronLogs(
    tenantId: number,
    userId: number,
    cronId?: number,
    limit = 100,
    offset = 0,
    startTime?: string,
    endTime?: string,
    agentId?: number
  ): CronLogRow[] {
    const conditions = ['tenant_id = ?', 'user_id = ?']
    const params: (number | string)[] = [tenantId, userId]
    if (cronId !== undefined) {
      conditions.push('cron_id = ?')
      params.push(cronId)
    }
    if (agentId !== undefined) {
      conditions.push('agent_id = ?')
      params.push(agentId)
    }
    if (startTime) {
      conditions.push('start_at >= ?')
      params.push(startTime)
    }
    if (endTime) {
      conditions.push('start_at <= ?')
      params.push(endTime)
    }
    params.push(limit, offset)
    return this.sql(
      `SELECT * FROM claw_cron_log WHERE ${conditions.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...params) as CronLogRow[]
  }

  deleteCronLog(id: number): boolean {
    const existing = this.sql('SELECT id FROM claw_cron_log WHERE id = ?').get(
      id
    )
    if (!existing) return false
    this.sql('DELETE FROM claw_cron_log WHERE id = ?').run(id)
    return true
  }
}
