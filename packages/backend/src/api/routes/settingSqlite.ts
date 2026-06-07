/**
 * SQLite management API routes
 * - Manage SQLite databases in ./data directory
 */
import { Database } from 'bun:sqlite'
import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { resolvePath } from '../../config/env.js'
import { DB_PATH, getSharedDb } from '../../storage/sqlite.js'
import {
  CHUNKS_DB_PATH,
  getChunksDb,
} from '../../storage/sqlite/store/chunk.js'
import { apiHandler } from '../../utils/api.js'
import { error, success } from '../../utils/response.js'
import { supervisorMiddleware } from '../middlewares/auth.js'
import { ResponseCodes } from '../types/constants.js'

const router: Router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATA_ROOT = () => resolvePath('data')

function safeDataPath(relativePath: string): string | null {
  const root = DATA_ROOT()
  const resolved = path.resolve(root, relativePath)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null
  return resolved
}

const _dbRegistry = new Map<string, Database>()

function getOrOpenDb(abs: string): Database {
  if (abs === DB_PATH) return getSharedDb() as unknown as Database
  if (abs === CHUNKS_DB_PATH) return getChunksDb()
  let db = _dbRegistry.get(abs)
  if (!db) {
    db = new Database(abs)
    _dbRegistry.set(abs, db)
  }
  return db
}

function findSqliteFiles(
  dir: string,
  relBase: string,
  results: Array<{
    name: string
    path: string
    absPath: string
  }> = []
) {
  if (!fs.existsSync(dir)) return results
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const e of entries) {
    const fullPath = path.join(dir, e.name)
    const relPath = path.join(relBase, e.name)
    if (e.isDirectory()) {
      findSqliteFiles(fullPath, relPath, results)
    } else if (e.isFile() && e.name.endsWith('.db')) {
      results.push({ name: e.name, path: relPath, absPath: fullPath })
    }
  }
  return results
}

function serializeCell(val: unknown): unknown {
  if (val == null) return val
  if (Buffer.isBuffer(val)) {
    return { __type: 'blob', base64: val.toString('base64'), len: val.length }
  }
  if (val instanceof Uint8Array) {
    return {
      __type: 'blob',
      base64: Buffer.from(val).toString('base64'),
      len: val.length,
    }
  }
  return val
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(row)) out[k] = serializeCell(row[k])
  return out
}

// ─── SQLite Management ────────────────────────────────────────────────────────

/**
 * @Api /api/setting/sqlite/list
 * @Summary List setting sqlite
 * @ReturnDataExample [{"name":"database.db","path":"db/database.db","size":102400}]
 */
router.post(
  '/setting/sqlite/list',
  supervisorMiddleware,
  apiHandler(async (_req, res) => {
    const root = DATA_ROOT()
    const dbs = findSqliteFiles(root, '')
    const result = dbs.map((db) => {
      let size = 0
      try {
        size = fs.statSync(db.absPath).size
      } catch {}
      return { name: db.name, path: db.path, size }
    })
    return success(res, result)
  })
)

/**
 * @Api /api/setting/sqlite/tables
 * @Summary Tables
 * @BodyParam dbPath string Relative path to the SQLite database file
 * @ReturnDataExample [{"name":"users","count":5,"size":4096}]
 */
router.post(
  '/setting/sqlite/tables',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { dbPath: relPath } = req.body
    if (!relPath)
      return error(res, ResponseCodes.DEFAULT_ERROR, 'dbPath is required')
    const abs = safeDataPath(relPath)
    if (!abs) return error(res, ResponseCodes.DEFAULT_ERROR, 'Invalid path')
    if (!fs.existsSync(abs))
      return error(res, ResponseCodes.DEFAULT_ERROR, 'Database not found')
    const db = getOrOpenDb(abs)
    const tables = db
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      )
      .all() as Array<{ name: string }>
    const result = tables.map((t) => {
      let count = 0
      let size = 0
      try {
        count = (
          db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as {
            c: number
          }
        ).c
      } catch {}
      try {
        const row = db
          .prepare(`SELECT SUM(pgsize) as s FROM dbstat WHERE name = ?`)
          .get(t.name) as { s: number | null }
        size = row?.s ?? 0
      } catch {}
      return { name: t.name, count, size }
    })
    return success(res, result)
  })
)

/**
 * @Api /api/setting/sqlite/schema
 * @Summary Schema
 * @BodyParam dbPath string Relative path to the SQLite database file
 * @BodyParam table string Table name
 * @ReturnDataExample [{"cid":0,"name":"id","type":"INTEGER","pk":1}]
 */
router.post(
  '/setting/sqlite/schema',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { dbPath: relPath, table } = req.body
    if (!relPath || !table)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        'dbPath and table are required'
      )
    const abs = safeDataPath(relPath)
    if (!abs || !fs.existsSync(abs))
      return error(res, ResponseCodes.DEFAULT_ERROR, 'Database not found')
    const db = getOrOpenDb(abs)
    const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: any
      pk: number
    }>
    return success(res, cols)
  })
)

/**
 * @Api /api/setting/sqlite/rows
 * @Summary Rows
 * @BodyParam dbPath string Relative path to the SQLite database file
 * @BodyParam table string Table name
 * @BodyParam page number? Page number (default: 1)
 * @BodyParam pageSize number? Page size (default: 20)
 * @ReturnDataExample {"rows":[],"total":0,"page":1,"pageSize":20,"totalPages":0}
 */
router.post(
  '/setting/sqlite/rows',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { dbPath: relPath, table, page = 1, pageSize = 20 } = req.body
    if (!relPath || !table)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        'dbPath and table are required'
      )
    const abs = safeDataPath(relPath)
    if (!abs || !fs.existsSync(abs))
      return error(res, ResponseCodes.DEFAULT_ERROR, 'Database not found')
    const db = getOrOpenDb(abs)
    const offset = (page - 1) * pageSize
    const total = (
      db.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get() as { c: number }
    ).c
    const rawRows = db
      .prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`)
      .all(pageSize, offset) as Record<string, unknown>[]
    const rows = rawRows.map(serializeRow)
    return success(res, {
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  })
)

/**
 * @Api /api/setting/sqlite/deleteRow
 * @Summary Delete Row
 * @BodyParam dbPath string Relative path to the SQLite database file
 * @BodyParam table string Table name
 * @BodyParam pkColumn string Primary key column name
 * @BodyParam pkValue any Primary key value
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/setting/sqlite/deleteRow',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { dbPath: relPath, table, pkColumn, pkValue } = req.body
    if (!relPath || !table || !pkColumn)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        'dbPath, table, pkColumn are required'
      )
    const abs = safeDataPath(relPath)
    if (!abs || !fs.existsSync(abs))
      return error(res, ResponseCodes.DEFAULT_ERROR, 'Database not found')
    const db = getOrOpenDb(abs)
    db.prepare(`DELETE FROM "${table}" WHERE "${pkColumn}" = ?`).run(pkValue)
    return success(res, null, 'Deleted')
  })
)

/**
 * @Api /api/setting/sqlite/execute
 * @Summary Execute setting sqlite
 * @BodyParam dbPath string Relative path to the SQLite database file
 * @BodyParam sql string SQL statement(s) to execute
 * @ReturnDataExample {"rows":[],"affected":null}
 */
router.post(
  '/setting/sqlite/execute',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { dbPath: relPath, sql } = req.body
    if (!relPath || !sql)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        'dbPath and sql are required'
      )
    const abs = safeDataPath(relPath)
    if (!abs || !fs.existsSync(abs))
      return error(res, ResponseCodes.DEFAULT_ERROR, 'Database not found')
    const db = getOrOpenDb(abs)
    try {
      const statements = sql
        .split(/;/)
        .map((s: string) => s.replace(/--[^\n]*/g, '').trim())
        .filter((s: string) => s.length > 0)

      if (statements.length === 0)
        return error(
          res,
          ResponseCodes.DEFAULT_ERROR,
          'No SQL statements found'
        )

      const isQuery =
        statements.length === 1 &&
        /^\s*(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(statements[0])

      if (isQuery) {
        const rows = db.prepare(statements[0]).all()
        return success(res, { rows, affected: null })
      } else {
        let totalAffected = 0
        for (const s of statements) {
          const result = db.prepare(s).run()
          totalAffected += result.changes ?? 0
        }
        return success(res, { rows: null, affected: totalAffected })
      }
    } catch (e: any) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        e?.message || 'SQL execution failed'
      )
    }
  })
)

/**
 * @Api /api/setting/sqlite/updateRow
 * @Summary Update Row
 * @BodyParam dbPath string Relative path to the SQLite database file
 * @BodyParam table string Table name
 * @BodyParam pkColumn string Primary key column name
 * @BodyParam pkValue any Primary key value
 * @BodyParam data object Updated row data (key-value pairs)
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/setting/sqlite/updateRow',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { dbPath: relPath, table, pkColumn, pkValue, data } = req.body
    if (!relPath || !table || !pkColumn || !data)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        'dbPath, table, pkColumn, data are required'
      )
    const abs = safeDataPath(relPath)
    if (!abs || !fs.existsSync(abs))
      return error(res, ResponseCodes.DEFAULT_ERROR, 'Database not found')
    const db = getOrOpenDb(abs)
    const keys = Object.keys(data).filter((k) => {
      if (k === pkColumn) return false
      const val = data[k]
      if (val !== null && typeof val === 'object' && val.__type === 'blob')
        return false
      return true
    })
    if (keys.length === 0)
      return error(res, ResponseCodes.DEFAULT_ERROR, 'No fields to update')
    const setClause = keys.map((k) => `"${k}" = ?`).join(', ')
    const values: any[] = keys.map((k) => data[k])
    values.push(pkValue)
    db.prepare(
      `UPDATE "${table}" SET ${setClause} WHERE "${pkColumn}" = ?`
    ).run(...values)
    return success(res, null, 'Updated')
  })
)

export default router
