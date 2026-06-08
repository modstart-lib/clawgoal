import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import { safeJsonParse } from '../../../../../backend/src/utils/json.js'
import type {
  AgentMessageContent,
  AgentMessageItem,
  AgentMessageRow,
  InsertAgentMessageInput,
} from '../../store/agentMessage.js'

export class SqliteAgentMessageStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  private _parseContent(row: AgentMessageRow): AgentMessageContent {
    const parsed = safeJsonParse(
      row.content,
      null,
      'agentMessage.content'
    ) as AgentMessageContent | null
    if (parsed) return parsed
    return {
      role: row.role as 'user' | 'assistant',
      text: row.content,
      timestamp: '0',
    }
  }

  insertAgentMessage(input: InsertAgentMessageInput): AgentMessageRow {
    const info = this.sql(
      `
      INSERT INTO claw_agent_message (created_at, updated_at, tenant_id, user_id, agent_id, session_id, role, content)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $agentId, $sessionId, $role, $content)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId ?? 0,
      role: input.role,
      content: JSON.stringify(input.content),
    })
    return this.sql('SELECT * FROM claw_agent_message WHERE id = ?').get(
      Number(info.lastInsertRowid)
    ) as AgentMessageRow
  }

  updateAgentMessage(id: number, content: AgentMessageContent): void {
    this.sql(
      `
      UPDATE claw_agent_message SET content = $content, updated_at = datetime('now', 'localtime') WHERE id = $id
    `
    ).run({ id, content: JSON.stringify(content) })
  }

  findAgentMessageById(id: number): AgentMessageRow | undefined {
    return (
      (this.sql('SELECT * FROM claw_agent_message WHERE id = ?').get(id) as
        | AgentMessageRow
        | undefined) ?? undefined
    )
  }

  listAgentMessages(
    tenantId: number,
    userId: number,
    agentId: number,
    limit = 100,
    offset = 0
  ): AgentMessageRow[] {
    return this.sql(
      'SELECT * FROM claw_agent_message WHERE tenant_id = ? AND user_id = ? AND agent_id = ? AND is_clear = 0 ORDER BY id ASC LIMIT ? OFFSET ?'
    ).all(tenantId, userId, agentId, limit, offset) as AgentMessageRow[]
  }

  listRecentAgentMessages(
    tenantId: number,
    userId: number,
    agentId: number,
    limit: number,
    sessionId: number
  ): AgentMessageRow[] {
    let rows: AgentMessageRow[]
    if (sessionId > 0) {
      rows = this.sql(
        'SELECT * FROM claw_agent_message WHERE tenant_id = ? AND user_id = ? AND agent_id = ? AND session_id = ? AND is_clear = 0 ORDER BY id DESC LIMIT ?'
      ).all(tenantId, userId, agentId, sessionId, limit) as AgentMessageRow[]
    } else {
      rows = this.sql(
        'SELECT * FROM claw_agent_message WHERE tenant_id = ? AND user_id = ? AND agent_id = ? AND is_clear = 0 ORDER BY id DESC LIMIT ?'
      ).all(tenantId, userId, agentId, limit) as AgentMessageRow[]
    }
    return rows.reverse()
  }

  listAgentMessagesBefore(
    tenantId: number,
    userId: number,
    agentId: number,
    limit = 20,
    beforeId: number | undefined,
    sessionId: number
  ): { rows: AgentMessageItem[]; hasMore: boolean } {
    const fetchLimit = limit + 1
    let rawRows: AgentMessageRow[]
    if (sessionId > 0) {
      if (beforeId != null && beforeId > 0) {
        rawRows = this.sql(
          'SELECT * FROM claw_agent_message WHERE tenant_id = ? AND user_id = ? AND agent_id = ? AND session_id = ? AND is_clear = 0 AND id < ? ORDER BY id DESC LIMIT ?'
        ).all(
          tenantId,
          userId,
          agentId,
          sessionId,
          beforeId,
          fetchLimit
        ) as AgentMessageRow[]
      } else {
        rawRows = this.sql(
          'SELECT * FROM claw_agent_message WHERE tenant_id = ? AND user_id = ? AND agent_id = ? AND session_id = ? AND is_clear = 0 ORDER BY id DESC LIMIT ?'
        ).all(
          tenantId,
          userId,
          agentId,
          sessionId,
          fetchLimit
        ) as AgentMessageRow[]
      }
    } else if (beforeId != null && beforeId > 0) {
      rawRows = this.sql(
        'SELECT * FROM claw_agent_message WHERE tenant_id = ? AND user_id = ? AND agent_id = ? AND is_clear = 0 AND id < ? ORDER BY id DESC LIMIT ?'
      ).all(
        tenantId,
        userId,
        agentId,
        beforeId,
        fetchLimit
      ) as AgentMessageRow[]
    } else {
      rawRows = this.sql(
        'SELECT * FROM claw_agent_message WHERE tenant_id = ? AND user_id = ? AND agent_id = ? AND is_clear = 0 ORDER BY id DESC LIMIT ?'
      ).all(tenantId, userId, agentId, fetchLimit) as AgentMessageRow[]
    }
    const hasMore = rawRows.length > limit
    const rows = (hasMore ? rawRows.slice(0, limit) : rawRows)
      .reverse()
      .map((row) => ({
        id: row.id,
        role: row.role,
        content: this._parseContent(row),
        sessionId: row.session_id,
      }))
    return { rows, hasMore }
  }

  clearAgentMessages(
    tenantId: number,
    userId: number,
    agentId: number
  ): number {
    const info = this.sql(
      'UPDATE claw_agent_message SET is_clear = 1 WHERE tenant_id = ? AND user_id = ? AND agent_id = ? AND is_clear = 0'
    ).run(tenantId, userId, agentId)
    return Number(info.changes)
  }

  deleteAgentMessagesBySession(sessionId: number): number {
    const info = this.sql(
      'DELETE FROM claw_agent_message WHERE session_id = ?'
    ).run(sessionId)
    return Number(info.changes)
  }

  deleteAgentMessagesByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): number {
    const info = this.sql(
      'DELETE FROM claw_agent_message WHERE tenant_id = ? AND user_id = ? AND agent_id = ?'
    ).run(tenantId, userId, agentId)
    return Number(info.changes)
  }
}
