/**
 * Project Backlog API routes（需求池）
 *
 * POST /backlog/list       — 查询项目需求池列表 (body: { projectId, status?, priority?, sortBy? })
 * POST /backlog/types      — 查询项目已有需求类型 (body: { projectId })
 * POST /backlog/add        — 新增需求 (body: { projectId, title, status?, priority?, type?, source?, reason?, detail?, dueAt? })
 * POST /backlog/edit       — 编辑需求 (body: { id, title?, status?, priority?, type?, source?, reason?, detail?, dueAt? })
 * POST /backlog/delete     — 删除需求 (body: { id })
 * POST /backlog/status     — 快速更新状态 (body: { id, status, reason? })
 * POST /backlog/getBySource— 按来源查询需求 (body: { source, projectId? })
 */
import { Router } from 'express'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import { useI18n } from '../../locale/index.js'
import { clawDb } from '../../storage/store/index.js'
import type { BacklogRow } from '../../storage/store/types.js'

const router: Router = Router()

const VALID_STATUSES = ['pending', 'active', 'pool', 'dropped', 'done']

function nowLocaltime(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

// ─── Formatter ────────────────────────────────────────────────────────────────

function formatBacklog(row: BacklogRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    priority: (row.priority ?? 'medium') as 'high' | 'medium' | 'low',
    type: row.type ?? '',
    dueAt: row.due_at ?? '',
    source: row.source ?? '',
    reason: row.reason ?? '',
    activeAt: row.active_at ?? '',
    doneAt: row.done_at ?? '',
    detail: row.detail ?? '',
    meta: row.meta ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/backlog/list
 * @Summary List backlog
 * @BodyParam projectId number Project ID
 * @BodyParam status string? Filter by status (pending|active|pool|dropped|done)
 * @BodyParam priority string? Filter by priority (high|medium|low)
 * @BodyParam sortBy string? Sort order: status (default) | priority
 */
router.post(
  '/claw/backlog/list',
  apiHandler(async (req, res) => {
    const { projectId, status, priority, sortBy } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const records = clawDb.findBacklogsByProjectId(Number(projectId), {
      status: status || undefined,
      priority: priority || undefined,
      sortBy: sortBy === 'priority' ? 'priority' : 'status',
    })
    return success(res, { records: records.map(formatBacklog) })
  })
)

/**
 * @Api /api/claw/backlog/paginate
 * @Summary Paginate backlog
 * @BodyParam projectId number Project ID
 * @BodyParam page number? Page number (default 1)
 * @BodyParam pageSize number? Page size (default 20)
 * @BodyParam status string? Filter by status (pending|active|pool|dropped|done)
 * @BodyParam priority string? Filter by priority (high|medium|low)
 * @BodyParam type string? Filter by type
 * @BodyParam keyword string? Keyword search
 * @BodyParam sortBy string? Sort order: status (default) | priority
 * @ReturnDataExample {"records":[],"total":0}
 */
router.post(
  '/claw/backlog/paginate',
  apiHandler(async (req, res) => {
    const {
      projectId,
      page,
      pageSize,
      status,
      priority,
      type,
      keyword,
      sortBy,
    } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const result = clawDb.paginateBacklogsByProjectId(Number(projectId), {
      status: status || undefined,
      priority: priority || undefined,
      type: type || undefined,
      keyword: keyword || undefined,
      sortBy: sortBy === 'priority' ? 'priority' : 'status',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    })
    return success(res, {
      records: result.records.map(formatBacklog),
      total: result.total,
    })
  })
)

/**
 * @Api /api/claw/backlog/types
 * @Summary List types backlog
 * @BodyParam projectId number Project ID
 */
router.post(
  '/claw/backlog/types',
  apiHandler(async (req, res) => {
    const { projectId } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const types = clawDb.findBacklogTypesByProjectId(Number(projectId))
    return success(res, { types })
  })
)

/**
 * @Api /api/claw/backlog/add
 * @Summary Add backlog
 * @BodyParam projectId number Project ID
 * @BodyParam title string Backlog title
 * @BodyParam status string? Initial status (default: pending)
 * @BodyParam priority string? Priority: high | medium (default) | low
 * @BodyParam type string? Category
 * @BodyParam source string? Source
 * @BodyParam reason string? Drop reason (required when status=dropped)
 * @BodyParam detail string? Detailed description
 * @BodyParam dueAt string? Due date (ISO string)
 */
router.post(
  '/claw/backlog/add',
  apiHandler(async (req, res) => {
    const {
      projectId,
      title,
      status,
      type,
      source,
      reason,
      detail,
      dueAt,
      priority,
      meta,
    } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!title?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.todoTitleRequired')
      )
    const finalStatus = status || 'pending'
    if (finalStatus === 'dropped' && !reason?.trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.todoReasonRequired')
      )
    }

    const activeAt = finalStatus === 'active' ? nowLocaltime() : undefined
    const doneAt = finalStatus === 'done' ? nowLocaltime() : undefined

    const row = clawDb.insertBacklog({
      projectId: Number(projectId),
      title: title.trim(),
      status: finalStatus,
      type: type?.trim() || undefined,
      dueAt: dueAt || undefined,
      source: source?.trim() || undefined,
      reason: reason?.trim() || undefined,
      activeAt,
      doneAt,
      detail: detail?.trim() || undefined,
      priority: priority || 'medium',
      meta: meta !== undefined ? meta : undefined,
    })
    return success(res, { record: formatBacklog(row) }, t('claw.todoCreated'))
  })
)

/**
 * @Api /api/claw/backlog/edit
 * @Summary Edit backlog
 * @BodyParam id number Backlog ID
 * @BodyParam title string? Updated title
 * @BodyParam status string? Updated status
 * @BodyParam priority string? Updated priority: high | medium | low
 * @BodyParam type string? Updated type
 * @BodyParam source string? Source
 * @BodyParam reason string? Drop reason (required when status=dropped)
 * @BodyParam detail string? Detailed description
 * @BodyParam dueAt string? Updated due date
 */
router.post(
  '/claw/backlog/edit',
  apiHandler(async (req, res) => {
    const {
      id,
      title,
      status,
      type,
      source,
      reason,
      detail,
      dueAt,
      priority,
      meta,
    } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findBacklogById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.todoNotFound'))

    if (status === 'dropped' && !reason?.trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.todoReasonRequired')
      )
    }

    const update: Parameters<typeof clawDb.updateBacklog>[1] = {}
    if (title !== undefined) update.title = title?.trim()
    if (type !== undefined) update.type = type?.trim() || null
    if (dueAt !== undefined) update.dueAt = dueAt || null
    if (source !== undefined) update.source = source?.trim() || null
    if (reason !== undefined) update.reason = reason?.trim() || null
    if (detail !== undefined) update.detail = detail?.trim() || null
    if (priority !== undefined) update.priority = priority || null
    if (meta !== undefined) update.meta = meta ?? null

    if (status !== undefined) {
      update.status = status
      // Auto-set timestamp fields
      if (status === 'active' && row.active_at == null) {
        update.activeAt = nowLocaltime()
      }
      if (status === 'done' && row.done_at == null) {
        update.doneAt = nowLocaltime()
      }
    }

    clawDb.updateBacklog(Number(id), update)
    const updated = clawDb.findBacklogById(Number(id))!
    return success(
      res,
      { record: formatBacklog(updated) },
      t('claw.todoUpdated')
    )
  })
)

/**
 * @Api /api/claw/backlog/delete
 * @Summary Remove backlog
 * @BodyParam id number Backlog ID
 */
router.post(
  '/claw/backlog/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findBacklogById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.todoNotFound'))

    clawDb.deleteBacklog(Number(id))
    return success(res, null, t('claw.todoDeleted'))
  })
)

/**
 * @Api /api/claw/backlog/status
 * @Summary Status
 * @BodyParam id number Backlog ID
 * @BodyParam status string New status: pending|active|pool|dropped|done
 * @BodyParam reason string? Required when status=dropped
 */
router.post(
  '/claw/backlog/status',
  apiHandler(async (req, res) => {
    const { id, status, reason } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    if (!status)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.todoStatusRequired')
      )
    if (!VALID_STATUSES.includes(status)) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.todoStatusInvalid')
      )
    }
    if (status === 'dropped' && !reason?.trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.todoReasonRequired')
      )
    }

    const row = clawDb.findBacklogById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.todoNotFound'))

    const update: Parameters<typeof clawDb.updateBacklog>[1] = {
      status,
    }
    if (reason?.trim()) update.reason = reason.trim()
    if (status === 'active' && row.active_at == null) {
      update.activeAt = nowLocaltime()
    }
    if (status === 'done' && row.done_at == null) {
      update.doneAt = nowLocaltime()
    }

    clawDb.updateBacklog(Number(id), update)
    const updated = clawDb.findBacklogById(Number(id))!
    return success(
      res,
      { record: formatBacklog(updated) },
      t('claw.todoStatusUpdated')
    )
  })
)

/**
 * @Api /api/claw/backlog/getBySource
 * @Summary Query backlogs by source
 * @BodyParam source string Source identifier to filter by
 * @BodyParam projectId? number Optionally limit to a specific project
 * @ReturnDataExample {"records":[{"id":1,"projectId":2,"title":"Some backlog","source":"channel-123"}]}
 */
router.post(
  '/claw/backlog/getBySource',
  apiHandler(async (req, res) => {
    const { source, projectId } = req.body
    const { t } = useI18n(req)
    if (!source?.trim())
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const records = clawDb.findBacklogsBySource(
      source.trim(),
      projectId ? Number(projectId) : undefined
    )
    return success(res, { records: records.map(formatBacklog) })
  })
)

export default router
