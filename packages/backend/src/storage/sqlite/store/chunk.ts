/**
 * 向量 Embedding 专用 SQLite 数据库管理
 *
 * 两类数据库：
 *   chunks.db       — 全局共享向量库（getChunksDb）
 *   embedding_<biz>.db — 按业务域独立向量库（getEmbeddingDb）
 *
 * 环境变量 CLAW_CHUNKS_DB_PATH 可覆盖 chunks.db 默认路径。
 */

import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { resolvePath } from '../../../config/env.js'
import { createNamedLogger } from '../../../utils/logger.js'
import { createEmbeddingSchema } from '../schema/chunk.js'

const logger = createNamedLogger('storage_chunks')

export const CHUNKS_DB_PATH =
  process.env.CLAW_CHUNKS_DB_PATH ?? resolvePath('data/db/chunks.db')

let _db: Database | null = null

function applyChunkPragmas(db: Database): void {
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')
  db.run('PRAGMA mmap_size = 0')
  db.run('PRAGMA synchronous = NORMAL')
  db.run('PRAGMA journal_size_limit = 16777216')
  db.run('PRAGMA wal_autocheckpoint = 1000')
}

/**
 * 获取全局共享的向量数据库连接（懒加载）。
 * 自动建表（幂等）。
 */
export function getChunksDb(): Database {
  if (_db) return _db

  const dir = path.dirname(CHUNKS_DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  _db = new Database(CHUNKS_DB_PATH)
  applyChunkPragmas(_db)
  _db.run('PRAGMA cache_size = -2000')
  _db.run('PRAGMA wal_checkpoint(TRUNCATE)')
  _db.exec(createEmbeddingSchema())
  logger.info(`Chunks DB initialized at ${CHUNKS_DB_PATH}`)
  return _db
}

/** 关闭全局 chunks 数据库连接（应用退出时调用一次） */
export function closeChunksDb(): void {
  _db?.close()
  _db = null
}

// ─── Per-biz embedding databases ─────────────────────────────────────────────

const _bizDbs = new Map<string, Database>()

/**
 * 获取指定业务域的向量数据库连接（懒加载单例）。
 * 每个 biz 对应独立文件 data/db/embedding_<biz>.db。
 */
export function getEmbeddingDb(biz: string): Database {
  const existing = _bizDbs.get(biz)
  if (existing) return existing

  const dbPath = resolvePath(`data/db/embedding_${biz}.db`)
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const db = new Database(dbPath)
  applyChunkPragmas(db)
  db.run('PRAGMA cache_size = -1000')
  db.exec(createEmbeddingSchema())
  _bizDbs.set(biz, db)
  logger.info(`Embedding DB initialized at ${dbPath}`)
  return db
}

/** 关闭所有 biz embedding 数据库连接 */
export function closeEmbeddingDbs(): void {
  for (const db of _bizDbs.values()) {
    db.close()
  }
  _bizDbs.clear()
}

/** 关闭并删除指定 biz 的 embedding 数据库文件（含 WAL/SHM 附属文件） */
export function deleteEmbeddingDb(biz: string): void {
  const existing = _bizDbs.get(biz)
  if (existing) {
    existing.close()
    _bizDbs.delete(biz)
  }
  const dbPath = resolvePath(`data/db/embedding_${biz}.db`)
  for (const suffix of ['', '-wal', '-shm']) {
    const p = dbPath + suffix
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
  logger.info(`Embedding DB deleted: ${dbPath}`)
}
