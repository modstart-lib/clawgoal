/**
 * Claw SQLite 增量迁移列表
 * 核心表结构已通过 buildInitSql() 中的 CREATE TABLE IF NOT EXISTS 幂等初始化，
 * 此处仅补录新版本新增列或索引的增量变更。
 *
 * 示例：
 * {
 *   name: 'claw_xxx: add yyy column',
 *   check: async () => h.hasTable('claw_xxx') && !h.hasColumn('claw_xxx', 'yyy'),
 *   execute: async () => { db.exec(`ALTER TABLE claw_xxx ADD COLUMN "yyy" TEXT`) },
 * }
 */

import type { Database } from 'bun:sqlite'
import type { MigrateItem } from '../../../../backend/src/storage/migrate.js'
import { useSqliteManage } from '../../../../backend/src/storage/sqlite/migrate.js'

export function buildMigrations(db: Database): MigrateItem[] {
  const h = useSqliteManage(db)
  return [
    // {
    //   name: 'claw_project: add meta column',
    //   check: async () =>
    //     h.hasTable('claw_project') && !h.hasColumn('claw_project', 'meta'),
    //   execute: async () => {
    //     db.exec(`ALTER TABLE claw_project ADD COLUMN "meta" TEXT`)
    //   },
    // },
  ]
}
