import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AgentMessageRawRow,
  InsertAgentMessageRawInput,
} from '../../store/agentMessageRaw.js'

export class SqliteAgentMessageRawStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  insert(input: InsertAgentMessageRawInput): void {
    this.sql(
      `INSERT INTO claw_agent_message_raw (created_at, updated_at, tenant_id, user_id, session_id, message)
       VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $sessionId, $message)`
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId,
      message: input.message,
    })
  }

  listBySession(sessionId: number, limit = 200): AgentMessageRawRow[] {
    return this.sql(
      'SELECT * FROM claw_agent_message_raw WHERE session_id = ? ORDER BY id ASC LIMIT ?'
    ).all(sessionId, limit) as AgentMessageRawRow[]
  }

  deleteBySession(sessionId: number): number {
    const info = this.sql(
      'DELETE FROM claw_agent_message_raw WHERE session_id = ?'
    ).run(sessionId)
    return Number(info.changes)
  }

  deleteByAgent(tenantId: number, userId: number, agentId: number): number {
    const info = this.sql(
      `DELETE FROM claw_agent_message_raw WHERE session_id IN (
        SELECT id FROM claw_agent_session WHERE tenant_id = ? AND user_id = ? AND agent_id = ?
       )`
    ).run(tenantId, userId, agentId)
    return Number(info.changes)
  }
}
