/**
 * Database initialization
 * Replaces the old Prisma-based migration runner.
 * Both writePubDb and clawDb create their tables idempotently on open(),
 * so no separate migration step is needed.
 */
import { logger } from '../utils/logger.js'
import { apiTokenDb } from './store/apiToken.js'
import { userDb } from './sqlite/store/user.js'
import { modelLogDb } from './store/modelLog.js'
import { noticeDb } from './store/notice.js'
import { paramDb } from './store/userParam.js'
import { userTempFileDb } from './store/userTempFile.js'
import { getSharedDb } from './sqlite.js'
import { buildMigrations } from './sqlite/migrate.js'

// ─── 统一迁移类型（定义在 sqlite/migrate.ts，此处 re-export 保持向后兼容）────
export type { MigrateItem } from './sqlite/migrate.js'

/** 依次运行迁移项，check 通过才 execute，并打印 name */
export async function runMigrations(
  items: import('./sqlite/migrate.js').MigrateItem[]
): Promise<void> {
  for (const item of items) {
    if (await item.check()) {
      logger.info(`Migrating: ${item.name}`)
      try {
        await item.execute()
      } catch (e: any) {
        throw Object.assign(
          new Error(`Migration failed: ${item.name} — ${e?.message ?? e}`),
          { cause: e }
        )
      }
    }
  }
}

// SQLite 辅助工具 re-export，保持向后兼容
export { execSqlSafe, useSqliteManage } from './sqlite/migrate.js'

/**
 * Initialize the database
 * Called on application startup
 */
export async function initDatabase(): Promise<void> {
  try {
    logger.info('Initializing database...')
    await paramDb.open()
    await apiTokenDb.open()
    await userDb.open()
    await noticeDb.open()
    modelLogDb.open()
    await userTempFileDb.open()

    // 集中执行 SQLite 核心表增量迁移（MySQL 路径下跳过）
    if ((process.env.DATABASE_PROVIDER ?? 'sqlite').toLowerCase() !== 'mysql') {
      await runMigrations(buildMigrations(getSharedDb()))
    }

    logger.info('Database initialization completed')
  } catch (error: any) {
    logger.error(
      { error },
      `Database initialization failed: ${error?.message ?? error}`
    )
    process.exit(1)
  }
}
