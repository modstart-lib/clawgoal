/**
 * MySQL 迁移辅助工具
 */

import type { Pool } from 'mysql2/promise'

/** 为 mysql2 Pool 创建常用检测辅助方法 */
export function useMysqlManage(pool: Pool) {
  return {
    async hasTable(table: string): Promise<boolean> {
      const [rows] = (await pool.execute('SHOW TABLES LIKE ?', [table])) as any
      return rows.length > 0
    },
    async hasColumn(table: string, column: string): Promise<boolean> {
      const [rows] = (await pool.execute(
        `SHOW COLUMNS FROM \`${table}\` LIKE ?`,
        [column]
      )) as any
      return rows.length > 0
    },
    async hasIndex(table: string, indexName: string): Promise<boolean> {
      const [rows] = (await pool.execute(
        `SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`,
        [indexName]
      )) as any
      return rows.length > 0
    },
    async hasRowWhere(table: string, condition: string): Promise<boolean> {
      const [rows] = (await pool.execute(
        `SELECT 1 FROM \`${table}\` WHERE ${condition} LIMIT 1`
      )) as any
      return rows.length > 0
    },
  }
}
