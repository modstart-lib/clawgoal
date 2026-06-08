import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AgentToolRow,
  InsertAgentToolInput,
  UpdateAgentToolInput,
} from '../../store/agentTool.js'

export class SqliteAgentToolStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  insert(input: InsertAgentToolInput): AgentToolRow {
    const stmt = this.sql(`
      INSERT INTO claw_agent_tool
        (created_at, updated_at, tenant_id, user_id, agent_id, session_id,
         tool_call_id, tool_name, title, meta, params, status, duration_ms, result, logs, msg_id)
      VALUES
        (datetime('now', 'localtime'), datetime('now', 'localtime'),
         $tenantId, $userId, $agentId, $sessionId,
         $toolCallId, $toolName, $title, $meta, $params, 'running', 0, '', '', $msgId)
    `)
    const info = stmt.run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      title: input.title ?? input.toolName,
      meta: JSON.stringify(input.meta ?? {}),
      params: JSON.stringify(input.params ?? {}),
      msgId: input.msgId ?? 0,
    })
    return this.sql(`SELECT * FROM claw_agent_tool WHERE id = ?`).get(
      Number(info.lastInsertRowid)
    ) as AgentToolRow
  }

  update(id: number, input: UpdateAgentToolInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }
    if (input.status !== undefined) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.durationMs !== undefined) {
      fields.push('duration_ms = $durationMs')
      params.durationMs = input.durationMs
    }
    if (input.result !== undefined) {
      fields.push('result = $result')
      params.result = input.result
    }
    if (fields.length === 0) return
    this.sql(
      `UPDATE claw_agent_tool SET ${fields.join(', ')} WHERE id = $id`
    ).run(params)
  }

  /** 追加日志行到 logs 字段 */
  appendLog(toolCallId: string, line: string): void {
    this.sql(
      `UPDATE claw_agent_tool SET logs = logs || $line WHERE tool_call_id = $toolCallId`
    ).run({ toolCallId, line: line + '\n' })
  }

  findByToolCallId(toolCallId: string): AgentToolRow | undefined {
    return this.sql(
      `SELECT * FROM claw_agent_tool WHERE tool_call_id = ? LIMIT 1`
    ).get(toolCallId) as AgentToolRow | undefined
  }

  list(
    tenantId: number,
    userId: number,
    options?: { agentId?: number; sessionId?: number; limit?: number }
  ): AgentToolRow[] {
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
    params.push(options?.limit ?? 50)
    return this.sql(
      `SELECT * FROM claw_agent_tool WHERE ${conds.join(' AND ')} ORDER BY id DESC LIMIT ?`
    ).all(...params) as AgentToolRow[]
  }
}
