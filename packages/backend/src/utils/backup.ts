/**
 * Automatic database backup scheduler.
 *
 * When `backup.enable` is true in the config, a per-minute ticker checks
 * whether the current (timezone-adjusted) wall-clock minute matches the
 * configured cron expression.  When it does, it copies:
 *
 *   ./data/db/database.db  →  ./data/backup/<YYYYMMDD_HHmmss>/db/database.db
 *   ./data/config.yaml     →  ./data/backup/<YYYYMMDD_HHmmss>/config.yaml
 *
 * The timezone used for cron evaluation is `config.timezone` (same setting
 * used by the cron scheduler).
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { matchesCron } from './cron.js'
import { resolvePath } from '../config/env.js'
import { config } from '../config/index.js'
import { createNamedLogger } from './logger.js'

const logger = createNamedLogger('backup')

/** Source file to back up, relative to project root */
const DB_SOURCE_REL = 'data/db/database.db'

/** Source config file to back up, relative to project root */
const CONFIG_SOURCE_REL = 'data/config.yaml'

/** Destination root directory for backups, relative to project root */
const BACKUP_ROOT_REL = 'data/backup'

/** Pad a number to two digits */
const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Build a timestamp string in the form YYYYMMDD_HHmmss.
 * Uses the UTC offset from `config.timezone` so backup directory names
 * reflect the user's local time (same as the cron scheduler).
 */
function buildTimestamp(date: Date): string {
  const offsetMs = config.timezone * 60 * 60 * 1000
  const local = new Date(date.getTime() + offsetMs)
  const YYYY = local.getUTCFullYear()
  const MM = pad2(local.getUTCMonth() + 1)
  const DD = pad2(local.getUTCDate())
  const hh = pad2(local.getUTCHours())
  const mm = pad2(local.getUTCMinutes())
  const ss = pad2(local.getUTCSeconds())
  return `${YYYY}${MM}${DD}_${hh}${mm}${ss}`
}

/**
 * Perform a single backup run: copy the SQLite database to a timestamped
 * subdirectory under `data/backup/`.
 *
 * @returns The destination file path on success, or null if the source
 *          file does not exist (nothing to back up yet).
 */
export function runBackup(now: Date = new Date()): string | null {
  const src = resolvePath(DB_SOURCE_REL)
  const configSrc = resolvePath(CONFIG_SOURCE_REL)

  if (!existsSync(src)) {
    logger.warn({ src }, 'Backup skipped — source database file not found')
    return null
  }

  const ts = buildTimestamp(now)
  const dest = join(resolvePath(BACKUP_ROOT_REL), ts, 'db', 'database.db')
  const configDest = join(resolvePath(BACKUP_ROOT_REL), ts, 'config.yaml')

  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)

  if (existsSync(configSrc)) {
    mkdirSync(dirname(configDest), { recursive: true })
    copyFileSync(configSrc, configDest)
  } else {
    logger.warn(
      { configSrc },
      'Config backup skipped — source config file not found'
    )
  }

  logger.info({ src, dest, configSrc, configDest }, 'Backup snapshot completed')
  return dest
}

/**
 * Remove backup snapshot directories that are older than `keepDays` days.
 * Directory names are expected to follow the `YYYYMMDD_HHmmss` pattern
 * produced by `buildTimestamp`; anything that does not match is left alone.
 * When `keepDays` is 0 all backups are retained.
 */
export function cleanOldBackups(
  keepDays: number,
  now: Date = new Date()
): void {
  if (keepDays <= 0) return

  const root = resolvePath(BACKUP_ROOT_REL)
  if (!existsSync(root)) return

  const cutoffMs = now.getTime() - keepDays * 24 * 60 * 60 * 1000
  const TS_RE = /^\d{8}_\d{6}$/

  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return
  }

  for (const entry of entries) {
    if (!TS_RE.test(entry)) continue

    const entryPath = join(root, entry)
    let mtime: number
    try {
      mtime = statSync(entryPath).mtimeMs
    } catch {
      continue
    }

    if (mtime < cutoffMs) {
      try {
        rmSync(entryPath, { recursive: true, force: true })
        logger.info({ entry }, 'Old backup snapshot removed')
      } catch (err) {
        logger.error({ err, entry }, 'Failed to remove old backup snapshot')
      }
    }
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/** Last minute we already fired a backup so we never double-fire. */
let lastBackupMinute = -1

/** Node timer handle (allow clean shutdown if needed). */
let intervalId: ReturnType<typeof setInterval> | undefined

/**
 * Start the per-minute backup scheduler.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initBackupScheduler(): void {
  if (!config.backup.enable) {
    logger.info('Backup scheduler disabled (backup.enable = false)')
    return
  }

  if (intervalId !== undefined) {
    logger.warn('Backup scheduler already started — ignoring duplicate init')
    return
  }

  const cron = config.backup.cron
  logger.info({ cron }, 'Backup scheduler started')

  // Align the first tick to the start of the next minute (same strategy as
  const now = Date.now()
  const msUntilNextMinute = 60_000 - (now % 60_000)

  setTimeout(() => {
    tick(cron)
    intervalId = setInterval(() => tick(cron), 60_000)
  }, msUntilNextMinute)
}

/** Stop the backup scheduler (useful for graceful shutdown / tests). */
export function stopBackupScheduler(): void {
  if (intervalId !== undefined) {
    clearInterval(intervalId)
    intervalId = undefined
  }
}

function tick(cron: string): void {
  const nowUtc = new Date()

  // Apply timezone offset so the cron expression is evaluated in local time
  const offsetMs = config.timezone * 60 * 60 * 1000
  const now = new Date(nowUtc.getTime() + offsetMs)

  // Build a unique minute index to prevent double-firing
  const currentMinute = Math.floor(nowUtc.getTime() / 60_000)
  if (currentMinute === lastBackupMinute) return

  if (!matchesCron(cron, now)) return

  lastBackupMinute = currentMinute
  logger.info(
    { cron, time: now.toISOString() },
    'Backup cron matched — running backup'
  )

  try {
    const dest = runBackup(nowUtc)
    if (dest) {
      logger.info({ dest }, 'Backup finished successfully')
      cleanOldBackups(config.backup.keepDays, nowUtc)
    }
  } catch (err) {
    logger.error({ err }, 'Backup failed')
  }
}
