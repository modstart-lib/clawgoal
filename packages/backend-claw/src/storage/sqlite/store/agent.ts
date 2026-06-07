import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import { createLogger } from '../../../kernel/logger.js'
import type {
  AddAgentInput,
  AddAgentMemoryInput,
  AgentMemoryRow,
  AgentRow,
  UpdateAgentInput,
} from '../../store/agent.js'

const logger = createLogger('claw-db')

export class SqliteClawAgentStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findAll(
    tenantId: number,
    userId: number,
    options?: { onlyEnabled?: boolean; projectId?: number }
  ): AgentRow[] {
    const onlyEnabled = options?.onlyEnabled ?? false
    const projectId = options?.projectId
    let query: string
    const params: unknown[] = [tenantId, userId]
    if (onlyEnabled) {
      query =
        'SELECT * FROM claw_agent WHERE tenant_id = ? AND user_id = ? AND enable = 1'
    } else {
      query = 'SELECT * FROM claw_agent WHERE tenant_id = ? AND user_id = ?'
    }
    if (projectId != null) {
      query += ' AND project_id = ?'
      params.push(projectId)
    }
    return this.sql(query).all(...params) as AgentRow[]
  }

  findById(id: number): AgentRow | undefined {
    return this.sql('SELECT * FROM claw_agent WHERE id = ?').get(id) as
      | AgentRow
      | undefined
  }

  countByProjectId(projectId: number): number {
    const row = this.sql(
      'SELECT COUNT(*) as cnt FROM claw_agent WHERE project_id = ?'
    ).get(projectId) as { cnt: number }
    return row.cnt
  }

  findSystemAgent(): AgentRow | undefined {
    return this.sql(
      'SELECT * FROM claw_agent WHERE is_system = 1 LIMIT 1'
    ).get() as AgentRow | undefined
  }

  insert(input: AddAgentInput): AgentRow {
    const hasId = input.id != null
    const sql = hasId
      ? `INSERT OR REPLACE INTO claw_agent (id, created_at, updated_at, tenant_id, user_id, title, role_name, is_system, enable, status, description, avatar, config, channel_ids, webhook_enable, webhook_token, avatar_config, param, project_id)
         VALUES ($id, datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $title, $roleName, $isSystem, $enable, $status, $description, $avatar, $config, $channelIds, $webhookEnable, $webhookToken, $avatarConfig, $param, $projectId)`
      : `INSERT INTO claw_agent (created_at, updated_at, tenant_id, user_id, title, role_name, is_system, enable, status, description, avatar, config, channel_ids, webhook_enable, webhook_token, avatar_config, param, project_id)
         VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $title, $roleName, $isSystem, $enable, $status, $description, $avatar, $config, $channelIds, $webhookEnable, $webhookToken, $avatarConfig, $param, $projectId)`
    const stmt = this.sql(sql)
    const info = stmt.run({
      ...(hasId ? { id: input.id } : {}),
      tenantId: input.tenantId,
      userId: input.userId,
      title: input.title,
      roleName: input.roleName,
      isSystem: input.isSystem ? 1 : 0,
      enable: input.enable !== false ? 1 : 0,
      status: input.status ?? 'idle',
      description: input.description ?? null,
      avatar: input.avatar ?? null,
      config: input.config ? JSON.stringify(input.config) : null,
      channelIds: input.channelIds
        ? JSON.stringify([...new Set(input.channelIds)])
        : null,
      webhookEnable: 0,
      webhookToken: null,
      avatarConfig: input.avatarConfig
        ? JSON.stringify(input.avatarConfig)
        : null,
      param: input.param != null ? JSON.stringify(input.param) : null,
      projectId: input.projectId ?? null,
    })
    return this.findById(Number(info.lastInsertRowid))!
  }

  update(id: number, input: UpdateAgentInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if (input.enable != null) {
      fields.push('enable = $enable')
      params.enable = input.enable ? 1 : 0
    }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.description != null) {
      fields.push('description = $description')
      params.description = input.description
    }
    if (input.avatar != null) {
      fields.push('avatar = $avatar')
      params.avatar = input.avatar
    }
    if (input.config != null) {
      fields.push('config = $config')
      params.config = JSON.stringify(input.config)
    }
    if (input.channelIds != null) {
      fields.push('channel_ids = $channelIds')
      params.channelIds = JSON.stringify([...new Set(input.channelIds)])
    }
    if (input.webhookEnable != null) {
      fields.push('webhook_enable = $webhookEnable')
      params.webhookEnable = input.webhookEnable ? 1 : 0
    }
    if ('webhookToken' in input) {
      fields.push('webhook_token = $webhookToken')
      params.webhookToken = input.webhookToken ?? null
    }
    if ('avatarConfig' in input) {
      fields.push('avatar_config = $avatarConfig')
      params.avatarConfig =
        input.avatarConfig != null ? JSON.stringify(input.avatarConfig) : null
    }
    if ('param' in input) {
      fields.push('param = $param')
      params.param = input.param != null ? JSON.stringify(input.param) : null
    }
    if ('projectId' in input) {
      fields.push('project_id = $projectId')
      params.projectId = input.projectId ?? null
    }

    if (fields.length === 0) return
    this.sql(`UPDATE claw_agent SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  delete(id: number): boolean {
    const row = this.findById(id)
    if (!row) return false
    if (row.is_system) {
      logger.warn(`Refused to delete system agent id=${id}`)
      return false
    }
    this.sql('DELETE FROM claw_agent WHERE id = ?').run(id)
    return true
  }

  findAgentMemories(
    tenantId: number,
    userId: number,
    agentId: number,
    limit = 30
  ): AgentMemoryRow[] {
    return this.sql(
      'SELECT * FROM claw_agent_memory WHERE tenant_id = ? AND user_id = ? AND agent_id = ? ORDER BY day DESC LIMIT ?'
    ).all(tenantId, userId, agentId, limit) as AgentMemoryRow[]
  }

  findAgentMemoryByDay(
    tenantId: number,
    userId: number,
    agentId: number,
    day: string
  ): AgentMemoryRow | undefined {
    return this.sql(
      'SELECT * FROM claw_agent_memory WHERE tenant_id = ? AND user_id = ? AND agent_id = ? AND day = ?'
    ).get(tenantId, userId, agentId, day) as AgentMemoryRow | undefined
  }

  upsertAgentMemory(input: AddAgentMemoryInput): AgentMemoryRow {
    this.sql(
      `INSERT INTO claw_agent_memory (tenant_id, user_id, agent_id, day, content)
       VALUES ($tenantId, $userId, $agentId, $day, $content)
       ON CONFLICT(tenant_id, user_id, agent_id, day) DO UPDATE SET content = excluded.content`
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId: input.agentId,
      day: input.day,
      content: input.content,
    })
    return this.findAgentMemoryByDay(
      input.tenantId,
      input.userId,
      input.agentId,
      input.day
    )!
  }

  deleteAgentMemory(id: number): boolean {
    const row = this.sql('SELECT id FROM claw_agent_memory WHERE id = ?').get(
      id
    )
    if (!row) return false
    this.sql('DELETE FROM claw_agent_memory WHERE id = ?').run(id)
    return true
  }

  deleteAgentMemoriesByAgent(
    tenantId: number,
    userId: number,
    agentId: number
  ): void {
    this.sql(
      'DELETE FROM claw_agent_memory WHERE tenant_id = ? AND user_id = ? AND agent_id = ?'
    ).run(tenantId, userId, agentId)
  }
}
