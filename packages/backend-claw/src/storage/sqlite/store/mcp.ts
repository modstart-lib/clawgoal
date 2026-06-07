import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type { AddMcpInput, McpRow, UpdateMcpInput } from '../../store/mcp.js'

export class SqliteClawMcpStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findAllMcps(tenantId: number, userId: number, onlyEnabled = false): McpRow[] {
    if (onlyEnabled) {
      return this.sql(
        'SELECT * FROM claw_mcp WHERE tenant_id = ? AND user_id = ? AND enable = 1 ORDER BY id ASC'
      ).all(tenantId, userId) as McpRow[]
    }
    return this.sql(
      'SELECT * FROM claw_mcp WHERE tenant_id = ? AND user_id = ? ORDER BY id ASC'
    ).all(tenantId, userId) as McpRow[]
  }

  findMcpById(id: number): McpRow | undefined {
    return this.sql('SELECT * FROM claw_mcp WHERE id = ?').get(id) as
      | McpRow
      | undefined
  }

  findMcpByName(
    tenantId: number,
    userId: number,
    name: string
  ): McpRow | undefined {
    return this.sql(
      'SELECT * FROM claw_mcp WHERE tenant_id = ? AND user_id = ? AND name = ?'
    ).get(tenantId, userId, name) as McpRow | undefined
  }

  insertMcp(input: AddMcpInput): McpRow {
    const info = this.sql(
      `
      INSERT INTO claw_mcp (created_at, updated_at, tenant_id, user_id, name, title, type, enable, config, description)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $name, $title, $type, $enable, $config, $description)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      name: input.name,
      title: input.title,
      type: input.type,
      enable: input.enable !== false ? 1 : 0,
      config: input.config ? JSON.stringify(input.config) : null,
      description: input.description ?? null,
    })
    return this.findMcpById(Number(info.lastInsertRowid))!
  }

  updateMcp(id: number, input: UpdateMcpInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if (input.name != null) {
      fields.push('name = $name')
      params.name = input.name
    }
    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.type != null) {
      fields.push('type = $type')
      params.type = input.type
    }
    if (input.enable != null) {
      fields.push('enable = $enable')
      params.enable = input.enable ? 1 : 0
    }
    if (input.config != null) {
      fields.push('config = $config')
      params.config = JSON.stringify(input.config)
    }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.description != null) {
      fields.push('description = $description')
      params.description = input.description
    }
    if (input.tools !== undefined) {
      fields.push('tools = $tools')
      params.tools = input.tools
    }

    if (fields.length === 0) return
    this.sql(`UPDATE claw_mcp SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteMcp(id: number): boolean {
    const row = this.findMcpById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_mcp WHERE id = ?').run(id)
    return true
  }
}
