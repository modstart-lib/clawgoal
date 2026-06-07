import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AddChannelInput,
  ChannelRow,
  UpdateChannelInput,
} from '../../store/channel.js'

export class SqliteClawChannelStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findAllChannels(
    tenantId: number,
    userId: number,
    onlyEnabled = false
  ): ChannelRow[] {
    if (onlyEnabled) {
      return this.sql(
        'SELECT * FROM claw_channel WHERE tenant_id = ? AND user_id = ? AND enable = 1'
      ).all(tenantId, userId) as ChannelRow[]
    }
    return this.sql(
      'SELECT * FROM claw_channel WHERE tenant_id = ? AND user_id = ?'
    ).all(tenantId, userId) as ChannelRow[]
  }

  findAllEnabledChannels(): ChannelRow[] {
    return this.sql(
      'SELECT * FROM claw_channel WHERE enable = 1'
    ).all() as ChannelRow[]
  }

  findChannelById(id: number): ChannelRow | undefined {
    return this.sql('SELECT * FROM claw_channel WHERE id = ?').get(id) as
      | ChannelRow
      | undefined
  }

  insertChannel(input: AddChannelInput): ChannelRow {
    const stmt = this.sql(`
      INSERT INTO claw_channel (created_at, updated_at, tenant_id, user_id, title, enable, is_global, type, config, status)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $title, $enable, $isGlobal, $type, $config, 'pending')
    `)
    const info = stmt.run({
      tenantId: input.tenantId,
      userId: input.userId,
      title: input.title,
      enable: input.enable !== false ? 1 : 0,
      isGlobal: input.isGlobal ? 1 : 0,
      type: input.type,
      config: input.config ? JSON.stringify(input.config) : null,
    })
    return this.findChannelById(Number(info.lastInsertRowid))!
  }

  updateChannel(id: number, input: UpdateChannelInput): void {
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
    if (input.isGlobal != null) {
      fields.push('is_global = $isGlobal')
      params.isGlobal = input.isGlobal ? 1 : 0
    }
    if (input.type != null) {
      fields.push('type = $type')
      params.type = input.type
    }
    if (input.config != null) {
      fields.push('config = $config')
      params.config = JSON.stringify(input.config)
    }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }

    if (fields.length === 0) return
    this.sql(`UPDATE claw_channel SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  markChannelSuccess(id: number): void {
    this.sql(`UPDATE claw_channel SET status = 'success' WHERE id = ?`).run(id)
  }

  deleteChannel(id: number): boolean {
    const row = this.findChannelById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_channel WHERE id = ?').run(id)
    return true
  }
}
