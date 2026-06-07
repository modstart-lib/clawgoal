import type { Pool } from 'mysql2/promise'
import { getSharedPool } from '../../mysql.js'
import type { ISettingStore, SettingRow } from '../../store/base.js'

function mapSetting(r: any): SettingRow {
  return {
    id: Number(r.id),
    name: r.name,
    value: r.value,
    createdAt:
      r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    updatedAt:
      r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at),
  }
}

export class MysqlSettingStore implements ISettingStore {
  private pool!: Pool

  private async getPool(): Promise<Pool> {
    if (!this.pool) this.pool = await getSharedPool()
    return this.pool
  }

  async getSetting(name: string): Promise<SettingRow | null> {
    const pool = await this.getPool()
    const [rows] = (await pool.execute(
      'SELECT * FROM `setting` WHERE `name` = ?',
      [name]
    )) as any
    return rows.length ? mapSetting(rows[0]) : null
  }

  async upsertSetting(name: string, value: string): Promise<void> {
    const pool = await this.getPool()
    await pool.execute(
      'INSERT INTO `setting` (`name`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = CURRENT_TIMESTAMP',
      [name, value]
    )
  }

  async getManySettings(names: string[]): Promise<SettingRow[]> {
    if (!names.length) return []
    const pool = await this.getPool()
    const placeholders = names.map(() => '?').join(', ')
    const [rows] = (await pool.execute(
      `SELECT * FROM \`setting\` WHERE \`name\` IN (${placeholders})`,
      names
    )) as any
    return (rows as any[]).map(mapSetting)
  }
}
