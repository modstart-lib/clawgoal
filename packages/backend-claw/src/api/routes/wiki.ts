/**
 * Project Wiki API routes
 *
 * POST /wiki/list    — 查询项目知识库列表 (body: { projectId, keyword? })
 * POST /wiki/get     — 获取知识库详情     (body: { id })
 * POST /wiki/add     — 新增知识库条目     (body: { projectId, title?, content?, sourceUrl?, type?, syncUrl?, syncPath?, syncInterval? })
 * POST /wiki/edit    — 编辑知识库条目     (body: { id, title?, content?, sourceUrl?, type?, syncUrl?, syncPath?, syncInterval? })
 * POST /wiki/delete  — 删除知识库条目     (body: { id })
 * POST /wiki/sync-logs — 查询同步日志     (body: { wikiId, limit? })
 */
import { HumanMessage } from '@langchain/core/messages'
import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { getModelConfigList } from '../../../../backend/src/config/index.js'
import { getEmbeddingProvider } from '../../../../backend/src/model/embedding/sqliteVecProvider.js'
import { modelCall } from '../../../../backend/src/model/model/index.js'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import { syncPathWikiById, syncWikiById } from '../../cron/wikiSync.js'
import { useI18n } from '../../locale/index.js'
import { clawDb } from '../../storage/store/index.js'
import type { WikiRow } from '../../storage/store/types.js'

const router: Router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatWiki(row: WikiRow) {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    biz: row.biz ?? '',
    status: row.status,
    type: row.type,
    title: row.title,
    content: row.content ?? '',
    sourceUrl: row.source_url ?? '',
    syncUrl: row.sync_url ?? '',
    syncPath: row.sync_path ?? '',
    syncInterval: row.sync_interval,
    nextSyncTime: row.next_sync_time ?? '',
    statusRemark: row.status_remark ?? '',
    meta: row.meta ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 异步写入 embedding（内部自动分片 + MD5 去重），失败时静默忽略 */
async function tryUpsertEmbedding(
  projectId: number,
  wikiId: number,
  text: string
): Promise<void> {
  try {
    await getEmbeddingProvider().upsert('Wiki', `${projectId}:${wikiId}`, text)
  } catch {
    // 静默失败，不影响主流程
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/wiki/list
 * @Summary List wiki
 * @BodyParam projectId number Project ID
 * @BodyParam keyword string? Search keyword
 * @ReturnDataExample {"records":[{"id":1,"title":"Wiki Entry","type":"manual","status":"success"}]}
 */
router.post(
  '/claw/wiki/list',
  apiHandler(async (req, res) => {
    const { projectId, keyword } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const records = clawDb.searchWikis(Number(projectId), {
      keyword: keyword?.trim() || undefined,
      limit: 200,
    })
    return success(res, { records: records.map(formatWiki) })
  })
)

/**
 * @Api /api/claw/wiki/listByBiz
 * @Summary List wiki by projectId + biz
 * @BodyParam projectId number Project ID
 * @BodyParam biz string Biz identifier
 * @ReturnDataExample {"records":[{"id":1,"title":"Wiki","biz":"mybiz"}]}
 */
router.post(
  '/claw/wiki/listByBiz',
  apiHandler(async (req, res) => {
    const { projectId, biz } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!biz?.trim())
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.bizRequired'))

    const records = clawDb.findWikisByProjectIdAndBiz(
      Number(projectId),
      biz.trim()
    )
    return success(res, { records: records.map(formatWiki) })
  })
)

/**
 * @Api /api/claw/wiki/paginate
 * @Summary Paginate wiki
 * @BodyParam projectId number Project ID
 * @BodyParam keyword string? Search keyword
 * @BodyParam page number? Page number (default 1)
 * @BodyParam pageSize number? Page size (default 20)
 * @ReturnDataExample {"records":[{"id":1,"title":"Wiki"}],"total":100}
 */
router.post(
  '/claw/wiki/paginate',
  apiHandler(async (req, res) => {
    const { projectId, keyword, page, pageSize } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const result = clawDb.paginateWikis(Number(projectId), {
      keyword: keyword?.trim() || undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    })
    return success(res, {
      records: result.records.map(formatWiki),
      total: result.total,
    })
  })
)

/**
 * @Api /api/claw/wiki/get
 * @Summary Get wiki
 * @BodyParam id number Wiki entry ID
 * @ReturnDataExample {"record":{"id":1,"title":"Wiki","content":"","type":"manual"}}
 */
router.post(
  '/claw/wiki/get',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findWikiById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.wikiNotFound'))
    return success(res, { record: formatWiki(row) })
  })
)

/**
 * @Api /api/claw/wiki/add
 * @Summary Add wiki
 * @BodyParam projectId number Project ID
 * @BodyParam title string? Entry title
 * @BodyParam content string? Entry content (for manual type)
 * @BodyParam type string? Entry type: manual|syncUrl|syncPath (default: manual)
 * @BodyParam syncUrl string? URL to sync from (for syncUrl type)
 * @BodyParam syncPath string? File path to sync from (for syncPath type)
 * @BodyParam syncInterval number? Sync interval in days
 * @BodyParam meta string? Meta JSON string
 * @ReturnDataExample {"record":{"id":1,"title":"Wiki","type":"manual","status":"processing"}}
 */
router.post(
  '/claw/wiki/add',
  apiHandler(async (req, res) => {
    const authReq = req as unknown as AuthRequest
    const {
      projectId,
      title,
      biz,
      content,
      sourceUrl,
      type,
      syncUrl,
      syncPath,
      syncInterval,
      meta,
    } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const wikiType = type || 'manual'
    if (wikiType === 'syncUrl' && !syncUrl?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.wikiSyncUrlRequired')
      )
    if (wikiType === 'syncPath' && !syncPath?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.wikiSyncPathRequired')
      )
    if (wikiType === 'manual' && !title?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.wikiTitleRequired')
      )

    // syncUrl 类型：检查同一项目下是否已存在相同 syncUrl，去重
    if (wikiType === 'syncUrl' && syncUrl?.trim()) {
      const existing = clawDb.findWikisByProjectId(Number(projectId))
      const duplicate = existing.find((w) => w.sync_url === syncUrl.trim())
      if (duplicate)
        return error(
          res,
          ResponseCodes.DEFAULT_ERROR,
          t('claw.wikiSyncUrlRequired')
        )
    }

    const userId = authReq.user.userId
    const tenantId = authReq.user.tenantId
    const interval = syncInterval ? Number(syncInterval) : 1
    const nextSyncTime =
      wikiType === 'syncUrl' || wikiType === 'syncPath'
        ? new Date(Date.now() + interval * 86400_000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ')
        : null

    const row = clawDb.insertWiki({
      tenantId,
      userId: Number(userId),
      projectId: Number(projectId),
      biz: biz?.trim() || undefined,
      title: title?.trim() || syncUrl?.trim() || syncPath?.trim() || '',
      content: content ? String(content) : undefined,
      sourceUrl: sourceUrl?.trim() || undefined,
      type: wikiType,
      syncUrl:
        wikiType === 'syncUrl' ? syncUrl?.trim() || undefined : undefined,
      syncPath:
        wikiType === 'syncPath' ? syncPath?.trim() || undefined : undefined,
      syncInterval: interval,
      nextSyncTime: nextSyncTime ?? undefined,
      status: 'processing',
      meta: meta !== undefined ? meta : undefined,
    })

    if (wikiType === 'syncUrl') {
      syncWikiById(row.id).catch(() => {})
    } else if (wikiType === 'syncPath') {
      syncPathWikiById(row.id).catch(() => {})
    } else {
      ;(async () => {
        const textForEmbed = [row.title, content || '']
          .filter(Boolean)
          .join('\n')
        await tryUpsertEmbedding(Number(projectId), row.id, textForEmbed)
        clawDb.updateWiki(row.id, { status: 'success' })
      })().catch(() => {
        clawDb.updateWiki(row.id, { status: 'fail' })
      })
    }

    const fresh = clawDb.findWikiById(row.id)!
    return success(res, { record: formatWiki(fresh) }, t('claw.wikiCreated'))
  })
)

/**
 * @Api /api/claw/wiki/edit
 * @Summary Edit wiki
 * @BodyParam id number Wiki entry ID
 * @BodyParam title string? Updated title
 * @BodyParam content string? Updated content
 * @BodyParam type string? Updated type
 * @BodyParam syncUrl string? Updated sync URL
 * @BodyParam syncPath string? Updated sync path
 * @BodyParam syncInterval number? Updated sync interval
 * @BodyParam meta string? Updated meta JSON string
 * @ReturnDataExample {"record":{"id":1,"title":"Updated Wiki"}}
 */
router.post(
  '/claw/wiki/edit',
  apiHandler(async (req, res) => {
    const {
      id,
      title,
      biz,
      content,
      sourceUrl,
      type,
      syncUrl,
      syncPath,
      syncInterval,
      meta,
    } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findWikiById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.wikiNotFound'))

    const updateData: Record<string, unknown> = {}
    if (title != null) updateData.title = title.trim()
    if (biz !== undefined) updateData.biz = biz?.trim() || null
    if (content !== undefined) updateData.content = content || null
    if (sourceUrl !== undefined)
      updateData.sourceUrl = sourceUrl?.trim() || null
    if (type != null) updateData.type = type
    if (syncUrl !== undefined) updateData.syncUrl = syncUrl?.trim() || null
    if (syncPath !== undefined) updateData.syncPath = syncPath?.trim() || null
    if (meta !== undefined) updateData.meta = meta
    if (syncInterval != null) {
      const interval = Number(syncInterval)
      updateData.syncInterval = interval
      const wikiType = type ?? row.type
      if (wikiType === 'syncUrl' || wikiType === 'syncPath') {
        updateData.nextSyncTime = new Date(Date.now() + interval * 86400_000)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ')
      }
    }

    const needsReEmbed = title != null || content !== undefined
    if (needsReEmbed) {
      updateData.status = 'processing'
    }

    clawDb.updateWiki(Number(id), updateData as any)

    if (needsReEmbed) {
      const updated = clawDb.findWikiById(Number(id))!
      const textForEmbed = [updated.title, updated.content || '']
        .filter(Boolean)
        .join('\n')
      ;(async () => {
        await tryUpsertEmbedding(updated.project_id, Number(id), textForEmbed)
        clawDb.updateWiki(Number(id), { status: 'success' })
      })().catch(() => {
        clawDb.updateWiki(Number(id), { status: 'fail' })
      })
    }

    const updated = clawDb.findWikiById(Number(id))!
    return success(res, { record: formatWiki(updated) }, t('claw.wikiUpdated'))
  })
)

/**
 * @Api /api/claw/wiki/delete
 * @Summary Remove wiki
 * @BodyParam id number Wiki entry ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/wiki/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findWikiById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.wikiNotFound'))

    clawDb.deleteWiki(Number(id))
    // 异步清理向量
    getEmbeddingProvider()
      .delete('Wiki', `${row.project_id}:${id}`)
      .catch(() => {})
    return success(res, null, t('claw.wikiDeleted'))
  })
)

/**
 * @Api /api/claw/wiki/syncLogs
 * @Summary Get sync logs wiki
 * @BodyParam wikiId number Wiki entry ID
 * @BodyParam limit number? Max records (default: 20)
 * @ReturnDataExample {"records":[{"id":1,"status":"success","createdAt":""}]}
 */
router.post(
  '/claw/wiki/syncLogs',
  apiHandler(async (req, res) => {
    const { wikiId, limit } = req.body
    const { t } = useI18n(req)
    if (!wikiId) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const records = clawDb.listWikiSyncLogs(
      Number(wikiId),
      limit ? Number(limit) : 20
    )
    return success(res, { records })
  })
)

/**
 * @Api /api/claw/wiki/allSyncLogs
 * @Summary Get all sync logs wiki
 * @BodyParam projectId number Project ID
 * @BodyParam page number? Page number
 * @BodyParam pageSize number? Page size
 * @ReturnDataExample {"records":[],"total":0,"page":1,"pageSize":20}
 */
router.post(
  '/claw/wiki/allSyncLogs',
  apiHandler(async (req, res) => {
    const { projectId, page, pageSize } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const currentPage = Math.max(1, Number(page) || 1)
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20))
    const offset = (currentPage - 1) * size

    const total = clawDb.countAllWikiSyncLogs(Number(projectId))
    const records = clawDb.listAllWikiSyncLogs(Number(projectId), {
      limit: size,
      offset,
    })
    return success(res, { records, total, page: currentPage, pageSize: size })
  })
)

/**
 * @Api /api/claw/wiki/sync
 * @Summary Sync wiki
 * @BodyParam id number Wiki entry ID (must be syncUrl or syncPath type)
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/wiki/sync',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findWikiById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.wikiNotFound'))

    if (row.type === 'syncUrl') {
      if (!row.sync_url)
        return error(
          res,
          ResponseCodes.DEFAULT_ERROR,
          t('claw.wikiSyncUrlNotConfigured')
        )
      syncWikiById(Number(id)).catch(() => {})
    } else if (row.type === 'syncPath') {
      if (!row.sync_path)
        return error(
          res,
          ResponseCodes.DEFAULT_ERROR,
          t('claw.wikiSyncPathNotConfigured')
        )
      syncPathWikiById(Number(id)).catch(() => {})
    } else {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.wikiNotSyncType'))
    }

    return success(res, null, t('claw.wikiSyncTriggered'))
  })
)

/**
 * @Api /api/claw/wiki/chat
 * @Summary Chat wiki
 * @BodyParam projectId number Project ID
 * @BodyParam text string? Chat question text
 * @BodyParam images string[]? Image URLs for vision-based queries
 * @ReturnDataExample {"answer":"AI generated answer...","refs":[{"id":1,"title":"Wiki"}]}
 */
router.post(
  '/claw/wiki/chat',
  apiHandler(async (req, res) => {
    const authReq = req as unknown as AuthRequest
    const { projectId, text, images } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!text?.trim() && !(Array.isArray(images) && images.length > 0)) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.wikiChatQueryRequired')
      )
    }

    const userId = authReq.user.userId
    const tenantId = authReq.user.tenantId

    // ── 若有图片，先用视觉模型描述图片内容 ────────────────────────────────────
    let effectiveQuery = text?.trim() || '请描述图片'
    if (Array.isArray(images) && images.length > 0) {
      try {
        const imgContent: any[] = [
          {
            type: 'text',
            text: '请简洁描述以下图片的内容，用于语义检索，只需输出核心关键词和主题，不超过100字。',
          },
        ]
        for (const img of images) {
          if (img?.url) {
            imgContent.push({ type: 'image_url', image_url: { url: img.url } })
          } else if (img?.data && img?.mimeType) {
            imgContent.push({
              type: 'image_url',
              image_url: { url: `data:${img.mimeType};base64,${img.data}` },
            })
          }
        }
        const descResult = await modelCall({
          tenantId,
          userId,
          biz: 'Claw',
          bizId: String(projectId),
          modelConfigList: await getModelConfigList(
            userId,
            tenantId,
            'default'
          ),
          appendMessages: [new HumanMessage({ content: imgContent })],
          temperature: 0.1,
          maxRetry: 1,
          context: 'wiki-chat-image-desc',
        })
        if (descResult.type === 'text' && descResult.content) {
          effectiveQuery = `${effectiveQuery}\n${descResult.content}`.trim()
        }
      } catch {
        // 图片描述失败不影响后续搜索
      }
    }

    // ── 语义检索知识库 ────────────────────────────────────────────────────────
    const topK = 5
    const hits = await getEmbeddingProvider()
      .searchChunk('Wiki', effectiveQuery, {
        scope: String(projectId),
        topK: topK * 3,
        chunksBefore: 1,
        chunksAfter: 1,
      })
      .catch(() => [])

    // 按 wiki id 聚合，保留最高分 chunk 及其上下文
    const wikiHitMap = new Map<number, { score: number; chunks: string[] }>()
    for (const hit of hits) {
      // scope 格式："{projectId}:{wikiId}"
      const wikiId = Number(hit.scope.split(':')[1])
      if (Number.isNaN(wikiId)) continue
      const existing = wikiHitMap.get(wikiId)
      if (!existing || hit.score > existing.score) {
        wikiHitMap.set(wikiId, { score: hit.score, chunks: hit.chunks })
      }
    }

    const topWikiIds = Array.from(wikiHitMap.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, topK)
      .map(([id]) => id)

    // 获取相关 wiki 条目，使用 searchChunk 返回的上下文片段
    const wikiDocs: Array<{ id: number; title: string; snippet: string }> = []
    for (const id of topWikiIds) {
      const wiki = clawDb.findWikiById(id)
      if (!wiki) continue
      const hit = wikiHitMap.get(id)!
      const snippet = hit.chunks.join('\n').slice(0, 1500)
      wikiDocs.push({ id: wiki.id, title: wiki.title, snippet })
    }

    // 若向量搜索无结果，降级为关键词搜索
    if (wikiDocs.length === 0) {
      const fallback = clawDb.searchWikis(Number(projectId), {
        keyword: effectiveQuery,
        limit: topK,
      })
      for (const w of fallback) {
        if (!w.content) continue
        wikiDocs.push({
          id: w.id,
          title: w.title,
          snippet: w.content.slice(0, 1000),
        })
      }
    }

    // ── 构建系统提示 ──────────────────────────────────────────────────────────
    let systemPrompt =
      "You are a Project Wiki assistant. Answer the user's question based strictly on the provided knowledge base content.\n\n"
    if (wikiDocs.length > 0) {
      systemPrompt += '## Relevant Knowledge Base Content\n\n'
      for (const doc of wikiDocs) {
        systemPrompt += `### ${doc.title}\n${doc.snippet}\n\n`
      }
      systemPrompt +=
        'Answer the user based on the knowledge base content above. If no relevant information is found, you may answer from general knowledge and note that the information was not found in the knowledge base.'
    } else {
      systemPrompt +=
        'No relevant content found in the knowledge base. Please answer the user based on general knowledge.'
    }

    const msgContent: any[] = [
      { type: 'text', text: text?.trim() || 'Please describe the image.' },
    ]
    if (Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (img?.url) {
          msgContent.push({ type: 'image_url', image_url: { url: img.url } })
        } else if (img?.data && img?.mimeType) {
          msgContent.push({
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          })
        }
      }
    }
    const callResult = await modelCall({
      tenantId,
      userId,
      biz: 'Claw',
      bizId: String(projectId),
      modelConfigList: await getModelConfigList(userId, tenantId, 'default'),
      systemPrompt,
      appendMessages: [new HumanMessage({ content: msgContent })],
      temperature: 0.3,
      maxRetry: 1,
    })
    const answer = callResult.type === 'text' ? callResult.content : ''

    return success(res, {
      answer,
      references: wikiDocs.map((w) => ({ id: w.id, title: w.title })),
    })
  })
)

export default router
