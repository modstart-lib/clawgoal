/**
 * Project Note API routes
 *
 * POST /project-note/list    — 查询项目笔记列表 (body: { projectId, type? })
 * POST /project-note/types   — 查询项目已有笔记类型 (body: { projectId })
 * POST /project-note/add     — 新增笔记 (body: { projectId, title, type?, content? })
 * POST /project-note/edit    — 编辑笔记 (body: { id, title?, type?, content? })
 * POST /project-note/delete  — 删除笔记 (body: { id })
 */
import { Router } from 'express'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import { useI18n } from '../../locale/index.js'
import { clawDb } from '../../storage/store/index.js'
import { renderMarkdown } from '../../../../backend/src/utils/markdown.js'
import type { NoteRow } from '../../storage/store/types.js'

const router: Router = Router()

// ─── Formatter ────────────────────────────────────────────────────────────────

function formatNote(row: NoteRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    biz: row.biz ?? '',
    type: row.type ?? '',
    title: row.title,
    content: row.content ?? '',
    meta: row.meta ?? null,
    shareHash: row.share_hash ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/note/list
 * @Summary List
 * @BodyParam projectId number Project ID
 * @BodyParam type string? Filter by note type
 * @ReturnDataExample {"records":[{"id":1,"title":"Note","type":"","content":""}]}
 */
router.post(
  '/claw/note/list',
  apiHandler(async (req, res) => {
    const { projectId, type } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const records = clawDb.findNotesByProjectId(Number(projectId), {
      type: type || undefined,
    })
    return success(res, { records: records.map(formatNote) })
  })
)

/**
 * @Api /api/claw/note/listByBiz
 * @Summary List by projectId + biz
 * @BodyParam projectId number Project ID
 * @BodyParam biz string Biz identifier
 * @ReturnDataExample {"records":[{"id":1,"title":"Note","biz":"mybiz"}]}
 */
router.post(
  '/claw/note/listByBiz',
  apiHandler(async (req, res) => {
    const { projectId, biz } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!biz?.trim())
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.bizRequired'))

    const records = clawDb.findNotesByProjectIdAndBiz(
      Number(projectId),
      biz.trim()
    )
    return success(res, { records: records.map(formatNote) })
  })
)

/**
 * @Api /api/claw/note/paginate
 * @Summary Paginate
 * @BodyParam projectId number Project ID
 * @BodyParam type string? Filter by note type
 * @BodyParam keyword string? Search keyword
 * @BodyParam page number? Page number (default 1)
 * @BodyParam pageSize number? Page size (default 20)
 * @ReturnDataExample {"records":[{"id":1,"title":"Note"}],"total":100}
 */
router.post(
  '/claw/note/paginate',
  apiHandler(async (req, res) => {
    const { projectId, type, keyword, page, pageSize } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const result = clawDb.paginateNotesByProjectId(Number(projectId), {
      type: type || undefined,
      keyword: keyword?.trim() || undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    })
    return success(res, {
      records: result.records.map(formatNote),
      total: result.total,
    })
  })
)

/**
 * @Api /api/claw/note/types
 * @Summary List types
 * @BodyParam projectId number Project ID
 * @ReturnDataExample {"types":["meeting","research"]}
 */
router.post(
  '/claw/note/types',
  apiHandler(async (req, res) => {
    const { projectId } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const types = clawDb.findNoteTypesByProjectId(Number(projectId))
    return success(res, { types })
  })
)

/**
 * @Api /api/claw/note/add
 * @Summary Add
 * @BodyParam projectId number Project ID
 * @BodyParam title string Note title
 * @BodyParam type string? Note category/type
 * @BodyParam content string? Note content
 * @ReturnDataExample {"record":{"id":1,"title":"Note","content":""}}
 */
router.post(
  '/claw/note/add',
  apiHandler(async (req, res) => {
    const { projectId, title, biz, type, content, meta } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!title?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.noteTitleRequired')
      )

    const row = clawDb.insertNote({
      projectId: Number(projectId),
      title: title.trim(),
      biz: biz?.trim() || undefined,
      type: type?.trim() || undefined,
      content: content !== undefined ? String(content) : undefined,
      meta: meta !== undefined ? meta : undefined,
    })
    return success(res, { record: formatNote(row) }, t('claw.noteCreated'))
  })
)

/**
 * @Api /api/claw/note/edit
 * @Summary Edit
 * @BodyParam id number Note ID
 * @BodyParam title string? Updated title
 * @BodyParam type string? Updated type
 * @BodyParam content string? Updated content
 * @ReturnDataExample {"record":{"id":1,"title":"Updated Note"}}
 */
router.post(
  '/claw/note/edit',
  apiHandler(async (req, res) => {
    const { id, title, biz, type, content, meta } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findNoteById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.noteNotFound'))

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title?.trim()
    if (biz !== undefined) updateData.biz = biz?.trim() || null
    if (type !== undefined) updateData.type = type?.trim() || null
    if (content !== undefined) updateData.content = content ?? null
    if (meta !== undefined) updateData.meta = meta ?? null
    clawDb.updateNote(Number(id), updateData)

    const updated = clawDb.findNoteById(Number(id))!
    return success(res, { record: formatNote(updated) }, t('claw.noteUpdated'))
  })
)

/**
 * @Api /api/claw/note/delete
 * @Summary Remove
 * @BodyParam id number Note ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/note/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findNoteById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.noteNotFound'))

    clawDb.deleteNote(Number(id))
    return success(res, null, t('claw.noteDeleted'))
  })
)


/**
 * @Api /api/claw/note/share
 * @Summary Share
 * @BodyParam id number Note ID
 * @ReturnDataExample {"shareHash":"abc123"}
 */
router.post(
  '/claw/note/share',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findNoteById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.noteNotFound'))

    const shareHash =
      row.share_hash ||
      Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    if (!row.share_hash) {
      clawDb.updateNote(Number(id), { shareHash })
    }
    return success(res, { shareHash })
  })
)

/**
 * @Api /api/claw/note/unshare
 * @Summary Unshare
 * @BodyParam id number Note ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/note/unshare',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findNoteById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.noteNotFound'))

    clawDb.updateNote(Number(id), { shareHash: null })
    return success(res, { success: true })
  })
)

/**
 * @Api /api/claw/note/share/:idHash
 * @Summary 公开分享查看笔记，返回 JSON 数据（无需认证）
 * @ReturnDataExample {"title":"笔记标题","type":"","content":{"markdown":"...","html":"..."}}
 */
router.get(
  '/claw/note/share/:idHash',
  apiHandler(async (req, res) => {
    const { idHash } = req.params
    const sep = idHash.lastIndexOf('_')
    if (sep >= 0) {
      const id = Number(idHash.slice(0, sep))
      const hash = idHash.slice(sep + 1)
      if (id && hash) {
        const row = clawDb.findNoteById(id)
        if (row && row.share_hash === hash) {
          const bodyText = row.content || ''
          const html = renderMarkdown(bodyText)
          const data = {
            title: row.title,
            content: { markdown: bodyText, html },
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ...data, type: row.type ?? '' }))
          return
        }
      }
    }
    res.status(404).setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Share link is invalid or closed' }))
  })
)


export default router
