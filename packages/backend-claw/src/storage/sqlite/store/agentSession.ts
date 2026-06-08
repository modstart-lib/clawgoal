import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import { safeJsonParse } from '../../../../../backend/src/utils/json.js'
import type {
  AgentSessionRow,
  InsertAgentSessionInput,
  UpdateAgentSessionInput,
} from '../../store/agentSession.js'

export class SqliteAgentSessionStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  insertChatSession(input: InsertAgentSessionInput): AgentSessionRow {
    const initialData: Record<string, unknown> = {}
    if (input.taskId) initialData.taskId = input.taskId
    if (input.taskMission) initialData.taskMission = input.taskMission
    const info = this.sql(
      `INSERT INTO claw_agent_session (created_at, updated_at, tenant_id, user_id, agent_id, title, message_count, data)
       VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $agentId, $title, 0, $data)`
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      title: input.title,
      data: JSON.stringify(initialData),
    })
    return this.sql('SELECT * FROM claw_agent_session WHERE id = ?').get(
      Number(info.lastInsertRowid)
    ) as AgentSessionRow
  }

  findChatSessionById(id: number): AgentSessionRow | undefined {
    return this.sql('SELECT * FROM claw_agent_session WHERE id = ?').get(id) as
      | AgentSessionRow
      | undefined
  }

  listChatSessions(
    tenantId: number,
    userId: number,
    agentId: number,
    limit = 50,
    offset = 0
  ): AgentSessionRow[] {
    return this.sql(
      'SELECT * FROM claw_agent_session WHERE tenant_id = ? AND user_id = ? AND agent_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(tenantId, userId, agentId, limit, offset) as AgentSessionRow[]
  }

  updateChatSession(id: number, input: UpdateAgentSessionInput): void {
    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    if (input.title !== undefined) {
      sets.push('title = $title')
      params.title = input.title
    }
    if (input.messageCount !== undefined) {
      sets.push('message_count = $messageCount')
      params.messageCount = input.messageCount
    }
    if (sets.length === 0) return
    this.sql(
      `UPDATE claw_agent_session SET ${sets.join(', ')}, updated_at = datetime('now', 'localtime') WHERE id = $id`
    ).run(params)
  }

  incrementMessageCount(id: number, firstMsgText?: string): void {
    this.sql(
      `UPDATE claw_agent_session SET message_count = message_count + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(id)
    if (firstMsgText) {
      const row = this.findChatSessionById(id)
      if (row && !row.title) {
        this.sql(
          `UPDATE claw_agent_session SET title = $title, updated_at = datetime('now', 'localtime') WHERE id = $id`
        ).run({ id, title: firstMsgText.slice(0, 80) })
      }
    }
  }

  deleteChatSession(id: number): boolean {
    const info = this.sql('DELETE FROM claw_agent_session WHERE id = ?').run(id)
    return Number(info.changes) > 0
  }

  updateSessionData(id: number, data: Record<string, unknown>): void {
    this.sql(
      `UPDATE claw_agent_session SET data = $data, updated_at = datetime('now', 'localtime') WHERE id = $id`
    ).run({ id, data: JSON.stringify(data) })
  }

  getSessionData(id: number): Record<string, unknown> {
    const row = this.sql(
      'SELECT data FROM claw_agent_session WHERE id = ?'
    ).get(id) as { data: string } | undefined
    if (!row) return {}
    return safeJsonParse(
      row.data,
      {} as Record<string, unknown>,
      'agentSession.data'
    )
  }

  deleteChatSessionsByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): AgentSessionRow[] {
    const sessions = this.sql(
      'SELECT * FROM claw_agent_session WHERE tenant_id = ? AND user_id = ? AND agent_id = ?'
    ).all(tenantId, userId, agentId) as AgentSessionRow[]
    this.sql(
      'DELETE FROM claw_agent_session WHERE tenant_id = ? AND user_id = ? AND agent_id = ?'
    ).run(tenantId, userId, agentId)
    return sessions
  }

  // ─── Agentic data（替代原 claw_agentic 表，存储在 agentic_data 字段）────────
  upsertAgenticData(sessionId: number, data: Record<string, unknown>): void {
    this.sql(
      `UPDATE claw_agent_session SET agentic_data = $data, updated_at = datetime('now', 'localtime') WHERE id = $id`
    ).run({ id: sessionId, data: JSON.stringify(data) })
  }

  getAgenticData(sessionId: number): Record<string, unknown> | undefined {
    const row = this.sql(
      'SELECT agentic_data FROM claw_agent_session WHERE id = ? AND agentic_data IS NOT NULL'
    ).get(sessionId) as { agentic_data: string } | undefined
    if (!row) return undefined
    return safeJsonParse(
      row.agentic_data,
      undefined,
      'agentSession.agenticData'
    ) as Record<string, unknown> | undefined
  }

  clearAgenticData(sessionId: number): void {
    this.sql(
      `UPDATE claw_agent_session SET agentic_data = NULL, updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(sessionId)
  }

  // ─── History（对话历史，替代文件 cache）──────────────────────────────────────

  saveHistory(sessionId: number, messages: unknown[]): void {
    this.sql(
      `UPDATE claw_agent_session SET history = $history, updated_at = datetime('now', 'localtime') WHERE id = $id`
    ).run({ id: sessionId, history: JSON.stringify(messages) })
  }

  loadHistory(sessionId: number): unknown[] | undefined {
    const row = this.sql(
      'SELECT history FROM claw_agent_session WHERE id = ? AND history IS NOT NULL'
    ).get(sessionId) as { history: string } | undefined
    if (!row) return undefined
    return safeJsonParse(row.history, undefined, 'agentSession.history') as
      | unknown[]
      | undefined
  }

  clearHistory(sessionId: number): void {
    this.sql(
      `UPDATE claw_agent_session SET history = NULL, updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(sessionId)
  }

  clearHistoryByAgent(tenantId: number, userId: number, agentId: number): void {
    this.sql(
      `UPDATE claw_agent_session SET history = NULL, updated_at = datetime('now', 'localtime') WHERE tenant_id = ? AND user_id = ? AND agent_id = ?`
    ).run(tenantId, userId, agentId)
  }
}
