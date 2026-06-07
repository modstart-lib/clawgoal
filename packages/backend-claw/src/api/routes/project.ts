/**
 * Project API routes
 *
 * POST /claw/project/list    — 查询所有项目（含事件）
 * POST /claw/project/detail  — 获取项目详情
 * POST /claw/project/add     — 新建项目
 * POST /claw/project/edit    — 编辑项目  (body: { id, ...fields })
 * POST /claw/project/delete  — 删除项目  (body: { id })
 * POST /claw/project/summary — 获取项目摘要
 */
import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants.js'
import { getEmbeddingProvider } from '../../../../backend/src/model/embedding/sqliteVecProvider.js'
import { apiHandler } from '../../../../backend/src/utils/api.js'
import { error, success } from '../../../../backend/src/utils/response.js'
import { useI18n } from '../../locale/index.js'
import { clawDb } from '../../storage/store/index.js'
import { getProjectSummary } from '../../utils/projectSummary.js'
import { formatEvent } from './event.js'
import type { EventRow, ProjectRow } from '../../storage/store/types.js'

/** 预设颜色池，创建项目时若未指定颜色则随机选取 */
const PROJECT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
]

function randomProjectColor(): string {
  return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
}

const router: Router = Router()

const DEFAULT_PROJECT_METRIC = [
  { name: 'pv', title: 'pv访问量', sort: 10 },
  { name: 'uv', title: 'uv独立访客', sort: 15 },
  { name: 'income', title: 'income收入', sort: 20 },
  { name: 'refund', title: 'refund退款', sort: 30 },
  { name: 'userCount', title: 'userCount用户数', sort: 40 },
  { name: 'dau', title: 'dau日活', sort: 50 },
]

// ─── Formatter ────────────────────────────────────────────────────────────────

function formatProject(
  row: ProjectRow,
  events: EventRow[],
  noteCount = 0,
  pendingTodoCount = 0,
  backlogCount = 0,
  wikiCount = 0,
  objectiveCount = 0,
  taskCount = 0,
  agentCount = 0
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    color: row.color,
    logo: row.logo ?? '',
    startAt: row.start_at ?? '',
    dueAt: row.due_at ?? '',
    meta: row.meta ?? null,
    events: events.map(formatEvent),
    noteCount,
    pendingTodoCount,
    backlogCount,
    wikiCount,
    objectiveCount,
    taskCount,
    agentCount,
    createdAt: row.created_at,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/project/list
 * @Summary List project
 * @ReturnDataExample {"records":[{"id":1,"title":"My Project","status":"planning","events":[]}]}
 */
router.post(
  '/claw/project/list',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const projects = clawDb.findAllProjects(tenantId, userId)
    const result = projects.map((p) => {
      const events = clawDb.findEventsByProjectId(p.id)
      const notes = clawDb.findNotesByProjectId(p.id)
      const pendingTodos = clawDb.findBacklogsByProjectId(p.id, {
        status: 'pending',
      })
      const backlogs = clawDb.findBacklogsByProjectId(p.id)
      const wikis = clawDb.findWikisByProjectId(p.id)
      const objectives = clawDb.findAllObjectives(tenantId, userId, {
        projectId: p.id,
      })
      const { total: taskCount } = clawDb.paginateTasks(tenantId, userId, {
        projectId: p.id,
        rootOnly: true,
        page: 1,
        pageSize: 1,
      })
      const agentCount = clawDb.countAgentsByProjectId(p.id)
      return formatProject(
        p,
        events,
        notes.length,
        pendingTodos.length,
        backlogs.length,
        wikis.length,
        objectives.length,
        taskCount,
        agentCount
      )
    })
    return success(res, { records: result })
  })
)

/**
 * @Api /api/claw/project/detail
 * @Summary Get detail project
 * @BodyParam id number Project ID
 * @ReturnDataExample {"record":{"id":1,"title":"My Project","status":"planning"}}
 */
router.post(
  '/claw/project/detail',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findProjectById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.projectNotFound'))

    const events = clawDb.findEventsByProjectId(Number(id))
    return success(res, { record: formatProject(row, events) })
  })
)

/**
 * @Api /api/claw/project/add
 * @Summary Add project
 * @BodyParam title string Project title
 * @BodyParam description string? Description
 * @BodyParam status string? Status (default: planning)
 * @BodyParam color string? Hex color
 * @BodyParam logo string? Logo URL
 * @BodyParam startAt string? Start date
 * @BodyParam dueAt string? Due date
 * @BodyParam meta string? Meta JSON string
 * @ReturnDataExample {"record":{"id":1,"title":"My Project","status":"planning"}}
 */
router.post(
  '/claw/project/add',
  apiHandler(async (req, res) => {
    const { title, description, status, color, logo, startAt, dueAt, meta } = req.body
    const { t } = useI18n(req)
    if (!title?.trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.projectNameRequired')
      )
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const row = clawDb.insertProject({
      tenantId,
      userId,
      title: title.trim(),
      description: description || undefined,
      status: status || 'planning',
      color: color?.trim() || randomProjectColor(),
      logo: logo?.trim() || undefined,
      startAt: startAt || undefined,
      dueAt: dueAt || undefined,
      meta: meta !== undefined ? meta : undefined,
    })

    for (const metric of DEFAULT_PROJECT_METRIC) {
      clawDb.insertMetric({
        projectId: row.id,
        name: metric.name,
        title: metric.title,
        sort: metric.sort,
      })
    }

    return success(
      res,
      { record: formatProject(row, []) },
      t('claw.projectCreated')
    )
  })
)

/**
 * @Api /api/claw/project/edit
 * @Summary Edit project
 * @BodyParam id number Project ID
 * @BodyParam title string? Updated title
 * @BodyParam description string? Updated description
 * @BodyParam status string? Updated status
 * @BodyParam color string? Updated color
 * @BodyParam logo string? Updated logo
 * @BodyParam startAt string? Updated start date
 * @BodyParam dueAt string? Updated due date
 * @BodyParam meta string? Updated meta JSON string
 * @ReturnDataExample {"record":{"id":1,"title":"Updated Project"}}
 */
router.post(
  '/claw/project/edit',
  apiHandler(async (req, res) => {
    const { id, title, description, status, color, logo, startAt, dueAt, meta } =
      req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findProjectById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.projectNotFound'))

    clawDb.updateProject(Number(id), {
      title: title?.trim(),
      description: description !== undefined ? description : undefined,
      status: status || undefined,
      color: color || undefined,
      logo: logo !== undefined ? logo || null : undefined,
      startAt: startAt !== undefined ? startAt : undefined,
      dueAt: dueAt !== undefined ? dueAt : undefined,
      meta: meta !== undefined ? meta : undefined,
    })

    const updated = clawDb.findProjectById(Number(id))!
    const events = clawDb.findEventsByProjectId(Number(id))
    return success(
      res,
      { record: formatProject(updated, events) },
      t('claw.projectUpdated')
    )
  })
)

/**
 * @Api /api/claw/project/delete
 * @Summary Remove project
 * @BodyParam id number Project ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/project/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const ok = clawDb.deleteProject(Number(id))
    if (!ok)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.projectNotFound'))
    getEmbeddingProvider()
      .deleteAll('Wiki', String(id))
      .catch(() => {})
    return success(res, null, t('claw.projectDeleted'))
  })
)

/**
 * @Api /api/claw/project/summary
 * @Summary Get project summary in markdown format
 * @BodyParam id number Project ID
 * @ReturnDataExample {"summary":"## Project: my-project\n..."}
 */
router.post(
  '/claw/project/summary',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t, locale } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const project = clawDb.findProjectById(Number(id))
    if (!project)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.projectNotFound'))

    const lang = locale === 'zh-CN' ? 'zh' : 'en'
    const summary = getProjectSummary(Number(id), lang)
    return success(res, { summary })
  })
)

export default router
