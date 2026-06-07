/**
 * 全局共享 SQLite 数据库实例
 * 数据库路径由 getDbPath() 从 config.dataPath 派生。
 */

import type { Statement } from 'bun:sqlite'
import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config/index.js'
import { createSetting } from './sqlite/schema/setting.js'

/**
 * 将具名参数对象的 key 统一添加 `$` 前缀，以满足 bun:sqlite 1.x 的严格绑定规则。
 */
export function prefixParams(params: unknown): unknown {
  if (params !== null && typeof params === 'object' && !Array.isArray(params)) {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      result[
        k.startsWith('$') || k.startsWith('@') || k.startsWith(':')
          ? k
          : `$${k}`
      ] = v
    }
    return result
  }
  return params
}

export function makeSqlHelper(
  db: Database,
  sqlTransform: (sql: string) => string
): (query: string) => Statement {
  return function sql(query: string): Statement {
    const stmt = db.prepare(sqlTransform(query))
    return new Proxy(stmt, {
      get(target: Statement, prop: string | symbol) {
        if (prop === 'run' || prop === 'get' || prop === 'all') {
          return (...args: unknown[]) => {
            const newArgs = args.map(prefixParams)
            return (
              target[prop as 'run' | 'get' | 'all'] as (
                ...a: unknown[]
              ) => unknown
            )(...newArgs)
          }
        }
        return (target as unknown as Record<string | symbol, unknown>)[prop]
      },
    }) as unknown as Statement
  }
}

/** 数据库文件路径（两个存储共用） */
export function getDbPath(): string {
  return path.join(config.dataPath, 'db', 'database.db')
}

let _db: Database.Database | null = null

/**
 * 获取全局共享的 SQLite 数据库连接（懒加载，首次调用时创建）。
 * WAL 模式与外键约束在创建时统一设置。
 */
export function getSharedDb(): Database.Database {
  if (!_db) {
    const dbPath = getDbPath()
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    _db = new Database(dbPath)
    _db.run('PRAGMA journal_mode = WAL')
    _db.run('PRAGMA foreign_keys = ON')
    _db.run('PRAGMA cache_size = -2000') // 最多 2 MB 页缓存
    _db.run('PRAGMA mmap_size = 0') // 禁用 mmap，减少 External 内存
    _db.run('PRAGMA synchronous = NORMAL') // WAL 模式下 NORMAL 安全且省 I/O
    _db.run('PRAGMA journal_size_limit = 16777216') // WAL 文件上限 16MB，避免无限膨胀
    _db.run('PRAGMA wal_autocheckpoint = 1000') // 每 1000 页（~4MB）自动 checkpoint
    // 启动时强制 checkpoint，合并上次异常退出残留的 WAL 文件，防止索引损坏
    _db.run('PRAGMA wal_checkpoint(TRUNCATE)')
    _db.exec(createSetting())
  }
  return _db
}

/** 关闭共享数据库连接（应用退出时调用一次） */
export function closeSharedDb(): void {
  _db?.close()
  _db = null
}
