import type { Database, Statement } from 'bun:sqlite'
import { makeSqlHelper } from '../../../../../backend/src/storage/sqlite.js'
import type {
  AddWikiInput,
  InsertWikiSyncLogInput,
  WikiRow,
  WikiSyncLogRow,
  UpdateWikiInput,
  UpdateWikiSyncLogInput,
} from '../../store/wiki.js'

export class SqliteClawWikiStore {
  private sql: (query: string) => Statement
  constructor(db: Database) {
    this.sql = makeSqlHelper(db, (q) => q)
  }

  findWikisByProjectId(
    projectId: number,
    options?: { status?: string }
  ): WikiRow[] {
    const rows = options?.status
      ? (this.sql(
          'SELECT * FROM claw_wiki WHERE project_id = ? AND status = ? ORDER BY id DESC'
        ).all(projectId, options.status) as any[])
      : (this.sql(
          'SELECT * FROM claw_wiki WHERE project_id = ? ORDER BY id DESC'
        ).all(projectId) as any[])
    return rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null }))
  }

  findWikiById(id: number): WikiRow | undefined {
    const row = this.sql('SELECT * FROM claw_wiki WHERE id = ?').get(id) as any
    return row ? { ...row, meta: row.meta ? JSON.parse(row.meta) : null } : undefined
  }

  searchWikis(
    projectId: number,
    options?: { keyword?: string; limit?: number }
  ): WikiRow[] {
    const limit = options?.limit ?? 50
    let rows: any[]
    if (options?.keyword) {
      const kw = options.keyword.trim()
      const parsed = kw.replace(/^#/, '')
      const numId = parseInt(parsed, 10)
      if (!isNaN(numId) && String(numId) === parsed) {
        rows = this.sql(
          'SELECT * FROM claw_wiki WHERE project_id = ? AND id = ? LIMIT ?'
        ).all(projectId, numId, limit) as any[]
      } else {
        const like = `%${kw}%`
        rows = this.sql(
          'SELECT * FROM claw_wiki WHERE project_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY id DESC LIMIT ?'
        ).all(projectId, like, like, limit) as any[]
      }
    } else {
      rows = this.sql(
        'SELECT * FROM claw_wiki WHERE project_id = ? ORDER BY id DESC LIMIT ?'
      ).all(projectId, limit) as any[]
    }
    return rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null }))
  }

  paginateWikis(
    projectId: number,
    options?: { keyword?: string; page?: number; pageSize?: number }
  ): { records: WikiRow[]; total: number } {
    const page = Math.max(1, options?.page ?? 1)
    const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 20))
    const offset = (page - 1) * pageSize

    const conditions: string[] = ['project_id = ?']
    const params: unknown[] = [projectId]

    if (options?.keyword?.trim()) {
      const kw = options.keyword.trim()
      const parsed = kw.replace(/^#/, '')
      const numId = parseInt(parsed, 10)
      if (!isNaN(numId) && String(numId) === parsed) {
        conditions.push('id = ?')
        params.push(numId)
      } else {
        conditions.push('(title LIKE ? OR content LIKE ?)')
        params.push(`%${kw}%`, `%${kw}%`)
      }
    }

    const where = conditions.join(' AND ')
    const total = (
      this.sql(`SELECT COUNT(*) as cnt FROM claw_wiki WHERE ${where}`).get(
        ...params
      ) as { cnt: number }
    ).cnt
    const records = this.sql(
      `SELECT * FROM claw_wiki WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as any[]
    return { records: records.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null })), total }
  }

  findDueSyncWikis(): WikiRow[] {
    const rows = this.sql(
      "SELECT * FROM claw_wiki WHERE type = 'syncUrl' AND sync_url IS NOT NULL AND (next_sync_time IS NULL OR next_sync_time <= datetime('now', 'localtime'))"
    ).all() as any[]
    return rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null }))
  }

  findDueSyncPathWikis(): WikiRow[] {
    const rows = this.sql(
      "SELECT * FROM claw_wiki WHERE type = 'syncPath' AND sync_path IS NOT NULL AND (next_sync_time IS NULL OR next_sync_time <= datetime('now', 'localtime'))"
    ).all() as any[]
    return rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null }))
  }

  findWikisByProjectIdAndBiz(
    projectId: number,
    biz: string
  ): WikiRow[] {
    const rows = this.sql(
      'SELECT * FROM claw_wiki WHERE project_id = ? AND biz = ? ORDER BY id DESC'
    ).all(projectId, biz) as any[]
    return rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null }))
  }

  findWikisByPathPrefix(projectId: number, syncPath: string): WikiRow[] {
    const prefix = syncPath.endsWith('/') ? syncPath : syncPath + '/'
    const rows = this.sql(
      "SELECT * FROM claw_wiki WHERE project_id = ? AND type = 'syncPath' AND source_url LIKE ?"
    ).all(projectId, prefix + '%') as any[]
    return rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null }))
  }

  insertWiki(input: AddWikiInput): WikiRow {
    const info = this.sql(
      `
      INSERT INTO claw_wiki (created_at, updated_at, tenant_id, user_id, project_id, biz, status, type, title, content, source_url, sync_url, sync_interval, next_sync_time, sync_path, meta)
      VALUES (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $projectId, $biz, $status, $type, $title, $content, $sourceUrl, $syncUrl, $syncInterval, $nextSyncTime, $syncPath, $meta)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      projectId: input.projectId,
      biz: input.biz?.trim() || null,
      status: input.status ?? 'success',
      type: input.type ?? 'manual',
      title: input.title ?? '',
      content: input.content ?? null,
      sourceUrl: input.sourceUrl ?? null,
      syncUrl: input.syncUrl ?? null,
      syncInterval: input.syncInterval ?? 1,
      nextSyncTime: input.nextSyncTime ?? null,
      syncPath: input.syncPath ?? null,
      meta: input.meta != null ? JSON.stringify(input.meta) : null,
    })
    return this.findWikiById(Number(info.lastInsertRowid))!
  }

  updateWiki(id: number, input: UpdateWikiInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }

    if ('biz' in input) {
      fields.push('biz = $biz')
      params.biz = input.biz?.trim() || null
    }
    if (input.title != null) {
      fields.push('title = $title')
      params.title = input.title
    }
    if ('content' in input) {
      fields.push('content = $content')
      params.content = input.content ?? null
    }
    if ('sourceUrl' in input) {
      fields.push('source_url = $sourceUrl')
      params.sourceUrl = input.sourceUrl ?? null
    }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if (input.type != null) {
      fields.push('type = $type')
      params.type = input.type
    }
    if ('syncUrl' in input) {
      fields.push('sync_url = $syncUrl')
      params.syncUrl = input.syncUrl ?? null
    }
    if ('syncPath' in input) {
      fields.push('sync_path = $syncPath')
      params.syncPath = input.syncPath ?? null
    }
    if (input.syncInterval != null) {
      fields.push('sync_interval = $syncInterval')
      params.syncInterval = input.syncInterval
    }
    if ('nextSyncTime' in input) {
      fields.push('next_sync_time = $nextSyncTime')
      params.nextSyncTime = input.nextSyncTime ?? null
    }
    if ('statusRemark' in input) {
      fields.push('status_remark = $statusRemark')
      params.statusRemark = input.statusRemark ?? null
    }
    if ('meta' in input) {
      fields.push('meta = $meta')
      params.meta = input.meta != null ? JSON.stringify(input.meta) : null
    }

    if (fields.length === 0) return
    this.sql(`UPDATE claw_wiki SET ${fields.join(', ')} WHERE id = $id`).run(
      params
    )
  }

  deleteWiki(id: number): boolean {
    const row = this.findWikiById(id)
    if (!row) return false
    this.sql('DELETE FROM claw_wiki WHERE id = ?').run(id)
    this.sql('DELETE FROM claw_wiki_sync_log WHERE wiki_id = ?').run(id)
    return true
  }

  deleteWikisByProjectId(projectId: number): void {
    this.sql('DELETE FROM claw_wiki_sync_log WHERE project_id = ?').run(
      projectId
    )
    this.sql('DELETE FROM claw_wiki WHERE project_id = ?').run(projectId)
  }

  insertWikiSyncLog(input: InsertWikiSyncLogInput): WikiSyncLogRow {
    const info = this.sql(
      `
      INSERT INTO claw_wiki_sync_log (tenant_id, user_id, project_id, wiki_id, url, status, content, error)
      VALUES ($tenantId, $userId, $projectId, $wikiId, $url, $status, $content, $error)
    `
    ).run({
      tenantId: input.tenantId,

      userId: input.userId,
      projectId: input.projectId,
      wikiId: input.wikiId,
      url: input.url,
      status: input.status ?? 'processing',
      content: input.content ?? null,
      error: input.error ?? null,
    })
    return this.sql('SELECT * FROM claw_wiki_sync_log WHERE id = ?').get(
      Number(info.lastInsertRowid)
    ) as WikiSyncLogRow
  }

  updateWikiSyncLog(id: number, input: UpdateWikiSyncLogInput): void {
    const fields: string[] = []
    const params: Record<string, unknown> = { id }
    if (input.status != null) {
      fields.push('status = $status')
      params.status = input.status
    }
    if ('content' in input) {
      fields.push('content = $content')
      params.content = input.content ?? null
    }
    if ('error' in input) {
      fields.push('error = $error')
      params.error = input.error ?? null
    }
    if ('statusRemark' in input) {
      fields.push('status_remark = $statusRemark')
      params.statusRemark = input.statusRemark ?? null
    }
    if (fields.length === 0) return
    this.sql(
      `UPDATE claw_wiki_sync_log SET ${fields.join(', ')} WHERE id = $id`
    ).run(params)
  }

  listWikiSyncLogs(wikiId: number, limit = 20): WikiSyncLogRow[] {
    return this.sql(
      'SELECT * FROM claw_wiki_sync_log WHERE wiki_id = ? ORDER BY id DESC LIMIT ?'
    ).all(wikiId, limit) as WikiSyncLogRow[]
  }

  listAllWikiSyncLogs(
    projectId: number,
    options?: { limit?: number; offset?: number }
  ): WikiSyncLogRow[] {
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0
    return this.sql(
      'SELECT * FROM claw_wiki_sync_log WHERE project_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(projectId, limit, offset) as WikiSyncLogRow[]
  }

  countAllWikiSyncLogs(projectId: number): number {
    const row = this.sql(
      'SELECT COUNT(*) as count FROM claw_wiki_sync_log WHERE project_id = ?'
    ).get(projectId) as { count: number }
    return row.count
  }
}
