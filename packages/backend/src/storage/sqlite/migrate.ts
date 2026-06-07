/**
 * SQLite 迁移辅助工具
 * 核心表结构已通过各 schema 的 CREATE TABLE IF NOT EXISTS 幂等处理，
 * 此处仅补录后续新增列或索引的增量变更。
 */

import type { Database } from 'bun:sqlite'

// ─── 统一迁移类型（被 migrate.ts 及各模块 migrate.ts 使用）────────────────────

export interface MigrateItem {
  name: string
  /** 返回 true 表示需要执行迁移 */
  check(): Promise<boolean>
  execute(): Promise<void>
}

/**
 * 执行多语句 init SQL，兼容旧库迁移场景。
 *
 * 旧库可能缺少多个后续通过 ALTER TABLE 新增的列（tenant_id、user_id 等），
 * 导致 `CREATE INDEX ... (col)` 报 "no such column"。
 * 此时过滤掉所有 CREATE INDEX / CREATE UNIQUE INDEX 行后重试。
 * 这些索引会在迁移脚本补齐各列后，由下次启动时的 init SQL 完整创建。
 */
export function execSqlSafe(db: Database, sql: string): void {
  try {
    db.exec(sql)
  } catch (e: any) {
    if (!/no such column/i.test(e?.message ?? '')) throw e
    // 过滤所有 CREATE [UNIQUE] INDEX 行，其余保持原样
    const filtered = sql
      .split('\n')
      .filter((line) => {
        const t = line.trim().toUpperCase()
        return !(t.startsWith('CREATE') && t.includes('INDEX'))
      })
      .join('\n')
    db.exec(filtered)
  }
}

/** 为 bun:sqlite Database 创建常用检测辅助方法 */
export function useSqliteManage(db: Database) {
  return {
    hasTable(table: string): boolean {
      const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(table)
      return row != null
    },
    hasColumn(table: string, column: string): boolean {
      const rows = db.prepare(`PRAGMA table_info(${table})`).all() as {
        name: string
      }[]
      return rows.some((r) => r.name === column)
    },
    hasIndex(indexName: string): boolean {
      const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`)
        .get(indexName)
      return row != null
    },
    hasRowWhere(table: string, condition: string): boolean {
      const row = db
        .prepare(`SELECT 1 FROM ${table} WHERE ${condition} LIMIT 1`)
        .get()
      return row != null
    },
    /**
     * 检测并修复 tenant_id 索引损坏问题。
     *
     * 背景：`ALTER TABLE ADD COLUMN "tenant_id" DEFAULT 1` 后立即 `CREATE INDEX` 时，
     * SQLite 懒默认值机制在部分版本下会把列名字符串"tenant_id"写入索引而非值 1，
     * 导致 WHERE/GROUP BY 走索引返回空结果。通过比较全表扫描与索引扫描计数来检测。
     *
     * @returns 是否执行了 REINDEX
     */
    reindexIfCorruptTenantId(): boolean {
      const tables = (
        db
          .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
          .all() as { name: string }[]
      ).map((r) => r.name)
      let corrupt = false
      for (const tbl of tables) {
        const cols = db.prepare(`PRAGMA table_info("${tbl}")`).all() as {
          name: string
        }[]
        if (!cols.some((c) => c.name === 'tenant_id')) continue
        const total = (
          db.prepare(`SELECT COUNT(*) as cnt FROM "${tbl}"`).get() as {
            cnt: number
          }
        ).cnt
        if (total === 0) continue
        // NOT INDEXED 强制全表扫描，不走可能损坏的索引
        const fullScan = (
          db
            .prepare(
              `SELECT COUNT(*) as cnt FROM "${tbl}" NOT INDEXED WHERE tenant_id = 1`
            )
            .get() as { cnt: number }
        ).cnt
        const withIdx = (
          db
            .prepare(`SELECT COUNT(*) as cnt FROM "${tbl}" WHERE tenant_id = 1`)
            .get() as { cnt: number }
        ).cnt
        if (fullScan > 0 && fullScan !== withIdx) {
          corrupt = true
          break
        }
      }
      if (corrupt) {
        db.exec('REINDEX;')
        return true
      }
      return false
    },
  }
}

// ─── Backend 核心表增量迁移列表 ───────────────────────────────────────────────

export function buildMigrations(db: Database): MigrateItem[] {
  // const m = useSqliteManage(db)
  return [
    // 保留示例，新增列迁移参考此格式
    // {
    //   name: 'xxx: add yyy column',
    //   check: async () => m.hasTable('xxx') && !m.hasColumn('xxx', 'yyy'),
    //   execute: async () => { db.exec(`ALTER TABLE "xxx" ADD COLUMN "yyy" TEXT`) },
    // },
  ]
}
