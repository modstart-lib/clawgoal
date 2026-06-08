import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AgentAuditRow,
  InsertAgentAuditInput,
  UpdateAgentAuditInput,
} from '../../store/agentAudit.js'

export class SqliteAgentAuditStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  insert(input: InsertAgentAuditInput): AgentAuditRow {
    const stmt = this.sql(`
      INSERT INTO claw_agent_audit
        (created_at, updated_at, tenant_id, user_id, agent_id, task_id, session_id, type, content, status)
      VALUES
        (datetime('now', 'localtime'), datetime('now', 'localtime'),
         $tenantId, $userId, $agentId, $taskId, $sessionId, $type, $content, 'pending')
    `)
    const info = stmt.run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      taskId: input.taskId ?? 0,
      sessionId: input.sessionId ?? 0,
      type: input.type ?? 'diff',
      content: JSON.stringify(input.content),
    })
    return this.sql(`SELECT * FROM claw_agent_audit WHERE id = ?`).get(
      Number(info.lastInsertRowid)
    ) as AgentAuditRow
  }

  findById(id: number): AgentAuditRow | undefined {
    return this.sql(`SELECT * FROM claw_agent_audit WHERE id = ?`).get(id) as
      | AgentAuditRow
      | undefined
  }

  findByIdAndUser(id: number, userId: number): AgentAuditRow | undefined {
    return this.sql(
      `SELECT * FROM claw_agent_audit WHERE id = ? AND user_id = ?`
    ).get(id, userId) as AgentAuditRow | undefined
  }

  update(id: number, input: UpdateAgentAuditInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }
    if (input.status !== undefined) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.content !== undefined) {
      fields.push('content = $content')
      params.content = JSON.stringify(input.content)
    }
    if (fields.length === 0) return
    this.sql(
      `UPDATE claw_agent_audit SET ${fields.join(', ')} WHERE id = $id`
    ).run(params)
  }

  list(
    tenantId: number,
    userId: number,
    options?: {
      agentId?: number
      sessionId?: number
      status?: string
      limit?: number
    }
  ): AgentAuditRow[] {
    const conds: string[] = ['tenant_id = ?', 'user_id = ?']
    const params: unknown[] = [tenantId, userId]
    if (options?.agentId != null) {
      conds.push('agent_id = ?')
      params.push(options.agentId)
    }
    if (options?.sessionId != null) {
      conds.push('session_id = ?')
      params.push(options.sessionId)
    }
    if (options?.status != null) {
      conds.push('status = ?')
      params.push(options.status)
    }
    params.push(options?.limit ?? 50)
    return this.sql(
      `SELECT * FROM claw_agent_audit WHERE ${conds.join(' AND ')} ORDER BY id DESC LIMIT ?`
    ).all(...params) as AgentAuditRow[]
  }
}
