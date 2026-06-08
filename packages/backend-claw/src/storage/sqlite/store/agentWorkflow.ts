import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AgentWorkflowRow,
  AgentWorkflowNodeRow,
  InsertAgentWorkflowInput,
  InsertAgentWorkflowNodeInput,
  UpdateAgentWorkflowInput,
  UpdateAgentWorkflowNodeInput,
} from '../../store/agentWorkflow.js'

export class SqliteAgentWorkflowStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  insertWorkflow(input: InsertAgentWorkflowInput): AgentWorkflowRow {
    const stmt = this.sql(`
      INSERT INTO claw_agent_workflow
        (created_at, updated_at, tenant_id, user_id, agent_id, session_id, start_at, status, state)
      VALUES
        (datetime('now', 'localtime'), datetime('now', 'localtime'),
         $tenantId, $userId, $agentId, $sessionId, $startAt, 'running', $state)
    `)
    const info = stmt.run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      startAt: input.startAt ?? new Date().toISOString(),
      state: JSON.stringify(input.state ?? {}),
    })
    return this.sql(`SELECT * FROM claw_agent_workflow WHERE id = ?`).get(
      Number(info.lastInsertRowid)
    ) as AgentWorkflowRow
  }

  updateWorkflow(id: number, input: UpdateAgentWorkflowInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }
    if (input.endAt !== undefined) {
      fields.push('end_at = $endAt')
      params.endAt = input.endAt
    }
    if (input.status !== undefined) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.state !== undefined) {
      fields.push('state = $state')
      params.state = JSON.stringify(input.state)
    }
    if (fields.length === 0) return
    this.sql(
      `UPDATE claw_agent_workflow SET ${fields.join(', ')} WHERE id = $id`
    ).run(params)
  }

  listWorkflows(
    tenantId: number,
    userId: number,
    agentId?: number,
    sessionId?: number,
    limit = 50
  ): AgentWorkflowRow[] {
    const conds: string[] = ['tenant_id = ?', 'user_id = ?']
    const params: unknown[] = [tenantId, userId]
    if (agentId != null) {
      conds.push('agent_id = ?')
      params.push(agentId)
    }
    if (sessionId != null) {
      conds.push('session_id = ?')
      params.push(sessionId)
    }
    params.push(limit)
    return this.sql(
      `SELECT * FROM claw_agent_workflow WHERE ${conds.join(' AND ')} ORDER BY id DESC LIMIT ?`
    ).all(...params) as AgentWorkflowRow[]
  }

  findWorkflowById(id: number): AgentWorkflowRow | undefined {
    return this.sql(`SELECT * FROM claw_agent_workflow WHERE id = ?`).get(
      id
    ) as AgentWorkflowRow | undefined
  }

  // ─── Nodes ────────────────────────────────────────────────────────────────

  insertWorkflowNode(
    input: InsertAgentWorkflowNodeInput
  ): AgentWorkflowNodeRow {
    const stmt = this.sql(`
      INSERT INTO claw_agent_workflow_node
        (created_at, updated_at, tenant_id, user_id, agent_id, session_id, workflow_id,
         start_at, status, input, output, state, logs)
      VALUES
        (datetime('now', 'localtime'), datetime('now', 'localtime'),
         $tenantId, $userId, $agentId, $sessionId, $workflowId,
         $startAt, 'running', $input, '{}', $state, '[]')
    `)
    const info = stmt.run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      workflowId: input.workflowId,
      startAt: input.startAt ?? new Date().toISOString(),
      input: JSON.stringify(input.input ?? {}),
      state: JSON.stringify(input.state ?? {}),
    })
    return this.sql(`SELECT * FROM claw_agent_workflow_node WHERE id = ?`).get(
      Number(info.lastInsertRowid)
    ) as AgentWorkflowNodeRow
  }

  updateWorkflowNode(id: number, input: UpdateAgentWorkflowNodeInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }
    if (input.endAt !== undefined) {
      fields.push('end_at = $endAt')
      params.endAt = input.endAt
    }
    if (input.status !== undefined) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.output !== undefined) {
      fields.push('output = $output')
      params.output = JSON.stringify(input.output)
    }
    if (input.state !== undefined) {
      fields.push('state = $state')
      params.state = JSON.stringify(input.state)
    }
    if (input.logs !== undefined) {
      fields.push('logs = $logs')
      params.logs = JSON.stringify(input.logs)
    }
    if (fields.length === 0) return
    this.sql(
      `UPDATE claw_agent_workflow_node SET ${fields.join(', ')} WHERE id = $id`
    ).run(params)
  }

  listWorkflowNodes(workflowId: number): AgentWorkflowNodeRow[] {
    return this.sql(
      `SELECT * FROM claw_agent_workflow_node WHERE workflow_id = ? ORDER BY id ASC`
    ).all(workflowId) as AgentWorkflowNodeRow[]
  }
}
