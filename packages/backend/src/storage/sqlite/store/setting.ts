import { getSharedDb } from '../../sqlite.js'
import type { ISettingStore, SettingRow } from '../../store/base.js'

function now(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

function mapSetting(r: any): SettingRow {
  return {
    id: Number(r.id),
    name: r.name,
    value: r.value,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

export class SqliteSettingStore implements ISettingStore {
  async getSetting(name: string): Promise<SettingRow | null> {
    const db = getSharedDb()
    const r = db.prepare('SELECT * FROM setting WHERE name = ?').get(name)
    return r ? mapSetting(r) : null
  }

  async upsertSetting(name: string, value: string): Promise<void> {
    const db = getSharedDb()
    const ts = now()
    db.prepare(
      `
      INSERT INTO setting (name, value, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `
    ).run(name, value, ts, ts)
  }

  async getManySettings(names: string[]): Promise<SettingRow[]> {
    if (!names.length) return []
    const db = getSharedDb()
    const placeholders = names.map(() => '?').join(', ')
    const rows = db
      .prepare(`SELECT * FROM setting WHERE name IN (${placeholders})`)
      .all(...names)
    return (rows as any[]).map(mapSetting)
  }
}
