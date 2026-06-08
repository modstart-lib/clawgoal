/**
 * Wiki Sync Scheduler
 *
 * Periodically checks for wikis whose next_sync_time has passed (type='syncUrl'),
 * fetches the syncUrl via webToMarkdown logic, updates the wiki content,
 * and logs the result to project_wiki_sync_log.
 *
 * Also handles syncPath type: scans a directory for .md files and syncs them.
 *
 * Default interval: every 60 minutes.
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { AppConfig } from '../../../backend/src/config.js'
import { getEmbeddingProvider } from '../../../backend/src/model/embedding/sqliteVecProvider.js'
import { htmlToMarkdownWithTitle } from '../../../backend/src/utils/utils.js'
import { logger as rootLogger } from '../kernel/logger.js'
import { clawDb } from '../storage/store/index.js'
import { t } from '../locale/index.js'

const logger = rootLogger.child({ module: 'wikiSync' })

// ─── syncUrl logic ────────────────────────────────────────────────────────────

async function syncOneWiki(
  wiki: ReturnType<typeof clawDb.findWikiById> & {}
): Promise<void> {
  const url = wiki.sync_url!
  const logEntry = clawDb.insertWikiSyncLog({
    tenantId: wiki.tenant_id,
    userId: wiki.user_id,
    projectId: wiki.project_id,
    wikiId: wiki.id,
    url,
    status: 'processing',
  })

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': `Mozilla/5.0 (compatible; ${AppConfig.title}/1.0)`,
      },
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const { title, markdown } = htmlToMarkdownWithTitle(html)

    if (markdown.length < 20) {
      throw new Error('Content too short, page may not be accessible')
    }

    // 计算下次同步时间
    const interval = wiki.sync_interval ?? 1
    const nextSyncTime = new Date(Date.now() + interval * 86_400_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')

    // 只在标题为空或仍等于syncUrl时才自动更新标题
    const shouldUpdateTitle = !wiki.title || wiki.title === wiki.sync_url
    clawDb.updateWiki(wiki.id, {
      ...(shouldUpdateTitle && title ? { title } : {}),
      content: markdown,
      nextSyncTime,
      status: 'success',
      statusRemark: null,
    })

    clawDb.updateWikiSyncLog(logEntry.id, {
      status: 'success',
      content: markdown.slice(0, 2000),
    })

    // 更新 embedding（内部自动分片，MD5 去重）
    const finalWiki = clawDb.findWikiById(wiki.id)
    const textForEmbed = [finalWiki?.title, markdown].filter(Boolean).join('\n')
    try {
      await getEmbeddingProvider().upsert(
        'Wiki',
        `${wiki.project_id}:${wiki.id}`,
        textForEmbed
      )
    } catch (e) {
      logger.warn(
        { wikiId: wiki.id, err: e },
        'embedding upsert failed after sync'
      )
    }

    logger.info({ wikiId: wiki.id, url }, 'wiki sync success')
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    clawDb.updateWikiSyncLog(logEntry.id, {
      status: 'fail',
      error: errorMsg,
      statusRemark: errorMsg,
    })
    // 失败时仍推迟下次同步时间（避免无限重试），推迟 1 小时
    const nextSyncTime = new Date(Date.now() + 3_600_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')
    clawDb.updateWiki(wiki.id, {
      nextSyncTime,
      status: 'fail',
      statusRemark: errorMsg,
    })
    logger.warn({ wikiId: wiki.id, url, err: errorMsg }, 'wiki sync failed')
  }
}

// ─── syncPath logic ───────────────────────────────────────────────────────────

const MAX_FILES_LIMIT = 1000

/** 递归扫描目录，收集所有 .md 文件的绝对路径（超过限制时抛出错误） */
function scanMdFiles(dir: string): string[] {
  const results: string[] = []

  function walk(current: string): void {
    const entries = readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        results.push(fullPath)
        if (results.length > MAX_FILES_LIMIT) {
          throw new Error(
            `${t('claw.wikiSyncFileLimitExceeded')} (${MAX_FILES_LIMIT})`
          )
        }
      }
    }
  }

  walk(dir)
  return results
}

async function upsertEmbeddingForWiki(
  projectId: number,
  wikiId: number,
  text: string
): Promise<void> {
  try {
    await getEmbeddingProvider().upsert('Wiki', `${projectId}:${wikiId}`, text)
  } catch (e) {
    logger.warn({ wikiId, err: e }, 'embedding upsert failed')
  }
}

async function syncOneSyncPathWiki(
  wiki: ReturnType<typeof clawDb.findWikiById> & {}
): Promise<void> {
  const syncPath = wiki.sync_path!
  const projectId = wiki.project_id
  const userId = wiki.user_id
  const interval = wiki.sync_interval ?? 1

  const logEntry = clawDb.insertWikiSyncLog({
    tenantId: wiki.tenant_id,
    userId,
    projectId,
    wikiId: wiki.id,
    url: syncPath,
    status: 'processing',
  })

  try {
    // 验证目录存在
    let stat
    try {
      stat = statSync(syncPath)
    } catch {
      throw new Error(`${t('claw.wikiSyncDirNotAccessible')}: ${syncPath}`)
    }
    if (!stat.isDirectory()) {
      throw new Error(`${t('claw.wikiSyncPathNotDir')}: ${syncPath}`)
    }

    // 扫描 .md 文件（超过 1000 个直接报错）
    const mdFiles = scanMdFiles(syncPath)

    // 先删除数据库中以 syncPath 开头但已不存在的 wiki 条目
    const existingWikis = clawDb.findWikisByPathPrefix(projectId, syncPath)
    for (const existing of existingWikis) {
      if (!existing.source_url) continue
      try {
        statSync(existing.source_url)
      } catch {
        // 文件不存在，删除对应 wiki
        clawDb.deleteWiki(existing.id)
        getEmbeddingProvider()
          .delete('Wiki', `${projectId}:${existing.id}`)
          .catch(() => {})
        logger.info(
          { wikiId: existing.id, path: existing.source_url },
          'removed deleted file wiki'
        )
      }
    }

    // 批量新增或更新 wiki 条目
    let upsertCount = 0
    for (const filePath of mdFiles) {
      let content = ''
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        continue
      }

      // 从文件路径生成标题（相对路径，去掉 .md 后缀）
      const relPath = relative(syncPath, filePath)
      const titleFromPath = relPath.replace(/\.md$/i, '').replace(/\\/g, '/')

      // 查找是否已存在以该文件路径为 source_url 的 wiki
      const existing =
        existingWikis.find((w) => w.source_url === filePath) ||
        clawDb
          .findWikisByPathPrefix(projectId, syncPath)
          .find((w) => w.source_url === filePath)

      if (existing) {
        clawDb.updateWiki(existing.id, {
          content,
          status: 'processing',
        })
        const textForEmbed = [existing.title, content]
          .filter(Boolean)
          .join('\n')
        await upsertEmbeddingForWiki(projectId, existing.id, textForEmbed)
        clawDb.updateWiki(existing.id, {
          status: 'success',
          statusRemark: null,
        })
      } else {
        const newWiki = clawDb.insertWiki({
          tenantId: wiki.tenant_id,
          userId,
          projectId,
          title: titleFromPath,
          content,
          sourceUrl: filePath,
          type: 'syncPath',
          syncPath,
          syncInterval: interval,
          status: 'processing',
        })
        const textForEmbed = [titleFromPath, content].filter(Boolean).join('\n')
        await upsertEmbeddingForWiki(projectId, newWiki.id, textForEmbed)
        clawDb.updateWiki(newWiki.id, {
          status: 'success',
          statusRemark: null,
        })
      }
      upsertCount++
    }

    // 更新主 wiki 的同步时间和状态
    const nextSyncTime = new Date(Date.now() + interval * 86_400_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')
    clawDb.updateWiki(wiki.id, {
      nextSyncTime,
      status: 'success',
      statusRemark: null,
    })

    clawDb.updateWikiSyncLog(logEntry.id, {
      status: 'success',
      content: `${t('claw.wikiSyncedFiles')} ${upsertCount}`,
    })

    logger.info(
      { wikiId: wiki.id, syncPath, count: upsertCount },
      'syncPath wiki sync success'
    )
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    clawDb.updateWikiSyncLog(logEntry.id, {
      status: 'fail',
      error: errorMsg,
      statusRemark: errorMsg,
    })
    const nextSyncTime = new Date(Date.now() + 3_600_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')
    clawDb.updateWiki(wiki.id, {
      nextSyncTime,
      status: 'fail',
      statusRemark: errorMsg,
    })
    logger.warn(
      { wikiId: wiki.id, syncPath, err: errorMsg },
      'syncPath wiki sync failed'
    )
  }
}

async function runSyncPass(): Promise<void> {
  // syncUrl 类型
  let wikis: ReturnType<typeof clawDb.findDueSyncWikis>
  try {
    wikis = clawDb.findDueSyncWikis()
  } catch (err) {
    logger.error({ err }, 'findDueSyncWikis failed')
    wikis = []
  }

  if (wikis.length > 0) {
    logger.info({ count: wikis.length }, 'starting syncUrl wiki sync pass')
    for (const wiki of wikis) {
      await syncOneWiki(wiki)
    }
  }

  // syncPath 类型
  let pathWikis: ReturnType<typeof clawDb.findDueSyncPathWikis>
  try {
    pathWikis = clawDb.findDueSyncPathWikis()
  } catch (err) {
    logger.error({ err }, 'findDueSyncPathWikis failed')
    pathWikis = []
  }

  if (pathWikis.length > 0) {
    logger.info({ count: pathWikis.length }, 'starting syncPath wiki sync pass')
    for (const wiki of pathWikis) {
      await syncOneSyncPathWiki(wiki)
    }
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

const INTERVAL_MS = 60 * 60 * 1_000 // 60 minutes
let timerId: ReturnType<typeof setInterval> | null = null

export function initWikiSync(): void {
  if (timerId !== null) return // already started

  // Run once shortly after startup, then on interval
  setTimeout(() => runSyncPass().catch(() => {}), 5_000)
  timerId = setInterval(() => runSyncPass().catch(() => {}), INTERVAL_MS)
  logger.info('wiki sync scheduler started (60 min interval)')
}

export function stopWikiSync(): void {
  if (timerId !== null) {
    clearInterval(timerId)
    timerId = null
  }
}

/**
 * 手动触发指定 syncUrl wiki 立即同步（供 API 路由调用）
 */
export async function syncWikiById(wikiId: number): Promise<void> {
  const wiki = clawDb.findWikiById(wikiId)
  if (!wiki || wiki.type !== 'syncUrl' || !wiki.sync_url) return
  await syncOneWiki(wiki)
}

/**
 * 手动触发指定 syncPath wiki 立即同步（供 API 路由调用）
 */
export async function syncPathWikiById(wikiId: number): Promise<void> {
  const wiki = clawDb.findWikiById(wikiId)
  if (!wiki || wiki.type !== 'syncPath' || !wiki.sync_path) return
  await syncOneSyncPathWiki(wiki)
}
