/**
 * Project Event API routes
 *
 * POST /claw/event/list      — 分页查询事件  (body: { projectId, page?, pageSize?, type?, keyword? })
 * POST /claw/event/types     — 查询项目已有类型  (body: { projectId })
 * POST /claw/event/add       — 新增事件  (body: { projectId, title, ... })
 * POST /claw/event/edit      — 编辑事件  (body: { id, ...fields })
 * POST /claw/event/delete    — 删除事件  (body: { id })
 * POST /claw/event/getByTitle— 根据标题查找  (body: { projectId, title })
 * POST /claw/event/share     — 生成分享链接  (body: { id })
 * POST /claw/event/unshare   — 关闭分享  (body: { id })
 * GET  /claw/event/:idHash   — 公开分享查看（无需认证）
 */
import { Router } from 'express'
import { ResponseCodes } from '../../../../backend/src/api/types/constants.js'
import { apiHandler } from '../../../../backend/src/utils/api.js'
import { error, success } from '../../../../backend/src/utils/response.js'
import { useI18n } from '../../locale/index.js'
import { clawDb } from '../../storage/store/index.js'
import { renderMarkdown } from '../../../../backend/src/utils/markdown.js'
import { config } from '../../../../backend/src/config/index.js'
import type { EventRow } from '../../storage/store/types.js'

const router: Router = Router()

// ─── Formatter ────────────────────────────────────────────────────────────────

export function formatEvent(row: EventRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    biz: row.biz ?? '',
    title: row.title,
    description: row.description ?? '',
    day: row.day ?? '',
    type: row.type ?? '',
    meta: row.meta ?? null,
    shareHash: row.share_hash ?? null,
    createdAt: row.created_at,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/event/list
 * @Summary List event
 * @BodyParam projectId number Project ID
 * @BodyParam page number? Page number
 * @BodyParam pageSize number? Page size
 * @BodyParam type string? Filter by event type
 * @BodyParam keyword string? Search keyword
 * @ReturnDataExample {"records":[{"id":1,"title":"Event","type":""}],"total":1}
 */
router.post(
  '/claw/event/list',
  apiHandler(async (req, res) => {
    const { projectId, page, pageSize, type, keyword } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const project = clawDb.findProjectById(Number(projectId))
    if (!project)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.projectNotFound'))

    const result = clawDb.findEventsByProjectIdPaginated(Number(projectId), {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      type: type || undefined,
      keyword: keyword || undefined,
    })
    return success(res, {
      records: result.records.map(formatEvent),
      total: result.total,
    })
  })
)

/**
 * @Api /api/claw/event/listByBiz
 * @Summary List event by projectId + biz
 * @BodyParam projectId number Project ID
 * @BodyParam biz string Biz identifier
 * @ReturnDataExample {"records":[{"id":1,"title":"Event","biz":"mybiz"}]}
 */
router.post(
  '/claw/event/listByBiz',
  apiHandler(async (req, res) => {
    const { projectId, biz } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!biz?.trim())
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.bizRequired'))

    const records = clawDb.findEventsByProjectIdAndBiz(
      Number(projectId),
      biz.trim()
    )
    return success(res, { records: records.map(formatEvent) })
  })
)

/**
 * @Api /api/claw/event/types
 * @Summary List types event
 * @BodyParam projectId number Project ID
 * @ReturnDataExample {"types":["milestone","release"]}
 */
router.post(
  '/claw/event/types',
  apiHandler(async (req, res) => {
    const { projectId } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const types = clawDb.findEventTypesByProjectId(Number(projectId))
    return success(res, { types })
  })
)

/**
 * @Api /api/claw/event/add
 * @Summary Add event
 * @BodyParam projectId number Project ID
 * @BodyParam title string Event title
 * @BodyParam description string? Event description
 * @BodyParam day string? Event date
 * @BodyParam type string? Event type/category
 * @BodyParam meta string? Meta JSON string
 * @ReturnDataExample {"record":{"id":1,"title":"Launch","type":"milestone"}}
 */
router.post(
  '/claw/event/add',
  apiHandler(async (req, res) => {
    const { projectId, title, biz, description, day, type, meta } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!title?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.eventNameRequired')
      )

    const project = clawDb.findProjectById(Number(projectId))
    if (!project)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.projectNotFound'))

    const row = clawDb.insertEvent({
      projectId: Number(projectId),
      title: title.trim(),
      biz: biz?.trim() || undefined,
      description: description || undefined,
      day: day || undefined,
      type: type || undefined,
      meta: meta !== undefined ? meta : undefined,
    })
    return success(res, { record: formatEvent(row) }, t('claw.eventAdded'))
  })
)

/**
 * @Api /api/claw/event/edit
 * @Summary Edit event
 * @BodyParam id number Event ID
 * @BodyParam title string? Updated title
 * @BodyParam description string? Updated description
 * @BodyParam day string? Updated date
 * @BodyParam type string? Updated type
 * @BodyParam meta string? Updated meta JSON string
 * @ReturnDataExample {"record":{"id":1,"title":"Updated Event"}}
 */
router.post(
  '/claw/event/edit',
  apiHandler(async (req, res) => {
    const { id, title, biz, description, day, type, meta } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findEventById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.eventNotFound'))

    clawDb.updateEvent(Number(id), {
      title: title?.trim(),
      biz: biz !== undefined ? biz?.trim() || null : undefined,
      description: description !== undefined ? description : undefined,
      day: day !== undefined ? day : undefined,
      type: type !== undefined ? type : undefined,
      meta: meta !== undefined ? meta : undefined,
    })

    const updated = clawDb.findEventById(Number(id))!
    return success(
      res,
      { record: formatEvent(updated) },
      t('claw.eventUpdated')
    )
  })
)

/**
 * @Api /api/claw/event/delete
 * @Summary Remove event
 * @BodyParam id number Event ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/event/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const ok = clawDb.deleteEvent(Number(id))
    if (!ok)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.eventNotFound'))
    return success(res, null, t('claw.eventDeleted'))
  })
)

/**
 * @Api /api/claw/event/getByTitle
 * @Summary Get by title event
 * @BodyParam projectId number Project ID
 * @BodyParam title string Event title to search
 * @ReturnDataExample {"record":{"id":1,"title":"Launch","type":"milestone"}}
 */
router.post(
  '/claw/event/getByTitle',
  apiHandler(async (req, res) => {
    const { projectId, title } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!title?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.eventNameRequired')
      )

    const project = clawDb.findProjectById(Number(projectId))
    if (!project)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.projectNotFound'))

    const row = clawDb.findEventByProjectIdAndTitle(
      Number(projectId),
      title.trim()
    )
    if (!row) return success(res, { record: null })
    return success(res, { record: formatEvent(row) })
  })
)


/**
 * @Api /api/claw/event/share
 * @Summary Share event
 * @BodyParam id number Event ID
 * @ReturnDataExample {"shareHash":"abc123","shareUrl":"https://example.com/claw/event/share/1_abc123"}
 */
router.post(
  '/claw/event/share',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findEventById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.eventNotFound'))

    const shareHash =
      row.share_hash ||
      Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    if (!row.share_hash) {
      clawDb.updateEvent(Number(id), { shareHash })
    }
    const shareUrl = config.url
      ? `${config.url}/claw/event/share/${id}_${shareHash}`
      : `/claw/event/share/${id}_${shareHash}`
    return success(res, { shareHash, shareUrl })
  })
)

/**
 * @Api /api/claw/event/unshare
 * @Summary Unshare event
 * @BodyParam id number Event ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/event/unshare',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findEventById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.eventNotFound'))

    clawDb.updateEvent(Number(id), { shareHash: null })
    return success(res, { success: true })
  })
)

/**
 * @Api /api/claw/event/share/:idHash
 * @Summary 公开分享查看事件，返回 JSON 数据（无需认证）
 * @ReturnDataExample {"title":"事件标题","type":"","day":"2024-01-01","content":{"markdown":"...","html":"..."}}
 */
router.get(
  '/claw/event/share/:idHash',
  apiHandler(async (req, res) => {
    const { idHash } = req.params
    const sep = idHash.lastIndexOf('_')
    if (sep >= 0) {
      const id = Number(idHash.slice(0, sep))
      const hash = idHash.slice(sep + 1)
      if (id && hash) {
        const row = clawDb.findEventById(id)
        if (row && row.share_hash === hash) {
          const bodyText = row.description || ''
          const html = renderMarkdown(bodyText)
          const data = {
            title: row.title,
            content: { markdown: bodyText, html },
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              ...data,
              type: row.type ?? '',
              day: row.day ?? '',
            })
          )
          return
        }
      }
    }
    res.status(404).setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Share link is invalid or closed' }))
  })
)


export default router
