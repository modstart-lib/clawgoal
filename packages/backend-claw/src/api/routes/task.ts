/**
 * ClawTask API routes
 *
 * Routes:
 *   POST /task/list    — 查询任务列表（支持 status/agentId 过滤）
 *   POST /task/detail  — 查询任务详情  (body: { id })
 *   POST /task/delete  — 删除任务      (body: { id })
 *   POST /task/stop    — 停止任务      (body: { id })
 *   POST /task/retry   — 重试任务      (body: { id })
 */
import { z } from 'zod'
import {
  modelCall,
  resolveModelConfigListByParamName,
} from '../../../../backend/src/model/model/index.js'
import { paramDb } from '../../../../backend/src/storage/store/userParam.js'
import { getProjectSummary } from '../../utils/projectSummary.js'
import { buildUserSystemInfoLangPrompt } from '../../utils/prompt.js'
import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import { getLocale, useI18n } from '../../locale/index.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import { clawDb } from '../../storage/store/index.js'
import {
  formatTask,
  buildTasksWithDescendants,
} from '../../utils/taskFormat.js'

const router: Router = Router()

/**
 * @Api /api/claw/task/add
 * @Summary Add task
 * @BodyParam title string Task title (required)
 * @BodyParam description string? Task description
 * @BodyParam agentId number? Agent ID
 * @BodyParam projectId number? 所属项目 ID
 * @BodyParam needs number[]? Dependency task IDs (same level)
 * @ReturnDataExample {"id":1,"title":"Task","status":"draft","statusText":"草稿"}
 */
router.post(
  '/claw/task/add',
  apiHandler(async (req, res) => {
    const {
      title,
      description,
      agentId,
      dueAt,
      estimatedHours,
      source,
      projectId,
    } = req.body
    const { t, locale } = useI18n(req)
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    if (!title || !String(title).trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskTitleRequired')
      )
    }

    const {
      parentId: addParentId,
      keyResultId: addKeyResultId,
      needs,
    } = req.body
    let addRootId: number | undefined
    if (addParentId) {
      const parentTask = clawDb.findTaskById(Number(addParentId))
      if (parentTask) {
        addRootId =
          parentTask.root_id > 0 ? parentTask.root_id : Number(addParentId)
      }
    }
    const addSort = addParentId
      ? clawDb.getNextChildSort(Number(addParentId))
      : 0
    const needsArr = Array.isArray(needs)
      ? (needs as unknown[]).map(Number).filter(Boolean)
      : []
    const task = clawDb.insertTask({
      tenantId,
      userId,
      title: String(title).trim(),
      description: description ? String(description).trim() : undefined,
      agentId: agentId ? Number(agentId) : undefined,
      status: 'draft',
      dueAt: dueAt || undefined,
      estimatedHours:
        estimatedHours != null ? Number(estimatedHours) : undefined,
      source:
        source && ['manual', 'objective'].includes(source) ? source : 'manual',
      parentId: addParentId ? Number(addParentId) : 0,
      rootId: addRootId,
      keyResultId: addKeyResultId ? Number(addKeyResultId) : 0,
      sort: addSort,
      needs: needsArr,
      projectId: projectId ? Number(projectId) : undefined,
    })

    const agentMap = new Map<number, { title: string; avatar: string | null }>()
    if (task.agent_id) {
      const w = clawDb.findById(task.agent_id)
      if (w)
        agentMap.set(task.agent_id, {
          title: w.title,
          avatar: w.avatar ?? null,
        })
    }

    return success(res, formatTask(task, agentMap, locale))
  })
)

/**
 * @Api /api/claw/task/list
 * @Summary List task
 * @BodyParam status string? Filter by status
 * @BodyParam agentId number? Filter by agent ID
 * @BodyParam projectId number? Filter by project ID
 * @BodyParam limit number? Max records
 * @ReturnDataExample [{"id":1,"title":"Task","status":"success","statusText":"成功"}]
 */
router.post(
  '/claw/task/list',
  apiHandler(async (req, res) => {
    const { status, agentId, limit, projectId } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const locale = getLocale(req)
    const tasks = clawDb.findAllTasks(tenantId, userId, {
      status,
      agentId,
      limit,
      projectId: projectId ? Number(projectId) : undefined,
    })

    const allAgents = clawDb.findAll(tenantId, userId)
    const agentMap = new Map<number, { title: string; avatar: string | null }>(
      allAgents.map((w) => [w.id, { title: w.title, avatar: w.avatar ?? null }])
    )

    return success(
      res,
      tasks.map((task) => formatTask(task, agentMap, locale))
    )
  })
)

/**
 * @Api /api/claw/task/paginate
 * @Summary Paginate task
 * @BodyParam page number Page number (default: 1)
 * @BodyParam pageSize number Page size (default: 50, max: 50)
 * @BodyParam status string? Filter by status
 * @BodyParam projectId number? Filter by project ID
 * @ReturnDataExample {"data":[],"page":1,"pageSize":50,"total":100}
 */
router.post(
  '/claw/task/paginate',
  apiHandler(async (req, res) => {
    const {
      status,
      keyword,
      agentId,
      source,
      rootOnly,
      hasParent,
      projectId,
      page = 1,
      pageSize = 20,
    } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const locale = getLocale(req)

    const safePage = Math.max(1, Number(page))
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize)))

    const { items, total } = clawDb.paginateTasks(tenantId, userId, {
      status,
      agentId: agentId ? Number(agentId) : undefined,
      keyword: keyword ? String(keyword) : undefined,
      source: source && source !== 'all' ? String(source) : undefined,
      rootOnly: rootOnly === true,
      hasParent:
        hasParent === true ? true : hasParent === false ? false : undefined,
      projectId: projectId ? Number(projectId) : undefined,
      page: safePage,
      pageSize: safePageSize,
    })

    const allAgents = clawDb.findAll(tenantId, userId)
    const agentMap = new Map<number, { title: string; avatar: string | null }>(
      allAgents.map((w) => [w.id, { title: w.title, avatar: w.avatar ?? null }])
    )

    const tasksWithDescendants = buildTasksWithDescendants(
      items,
      agentMap,
      locale
    )

    return success(res, {
      data: tasksWithDescendants,
      page: safePage,
      pageSize: safePageSize,
      total,
    })
  })
)

/**
 * @Api /api/claw/task/detail
 * @Summary Get detail task
 * @BodyParam id number Task ID
 * @ReturnDataExample {"id":1,"title":"Task","status":"success","processing":""}
 */
router.post(
  '/claw/task/detail',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t, locale } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const task = clawDb.findTaskById(Number(id))
    if (!task)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.taskNotFound'))

    const allAgents = clawDb.findAll(
      (req as unknown as AuthRequest).user.tenantId,
      (req as unknown as AuthRequest).user.userId
    )
    const agentMap = new Map<number, { title: string; avatar: string | null }>(
      allAgents.map((w) => [w.id, { title: w.title, avatar: w.avatar ?? null }])
    )

    const [result] = buildTasksWithDescendants([task], agentMap, locale)
    return success(res, result)
  })
)

/**
 * @Api /api/claw/task/delete
 * @Summary Remove task
 * @BodyParam id number Task ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/task/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const task = clawDb.findTaskById(Number(id))
    if (!task)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.taskNotFound'))

    if (task.status === 'running') {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskRunningCannotDelete')
      )
    }

    const ok = clawDb.deleteTask(Number(id))
    return success(res, { success: ok })
  })
)

/**
 * @Api /api/claw/task/stop
 * @Summary Stop task
 * @BodyParam id number Task ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/task/stop',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const task = clawDb.findTaskById(Number(id))
    if (!task)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.taskNotFound'))

    if (
      !['draft', 'queue', 'ready', 'asking', 'running'].includes(task.status)
    ) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskStopNotAllowed')
      )
    }

    clawDb.updateTaskStatus(Number(id), 'canceled', 'Manually canceled')
    return success(res, { success: true })
  })
)

/**
 * @Api /api/claw/task/retry
 * @Summary Retry task
 * @BodyParam id number Task ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/task/retry',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const task = clawDb.findTaskById(Number(id))
    if (!task)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.taskNotFound'))

    if (!['failed', 'canceled'].includes(task.status)) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskRetryOnlyFailed')
      )
    }

    clawDb.updateTaskStatus(Number(id), 'queue', null)
    clawDb.updateTask(Number(id), { startAt: null, endAt: null })
    return success(res, { success: true })
  })
)

/**
 * @Api /api/claw/task/edit
 * @Summary Edit task
 * @BodyParam id number Task ID
 * @BodyParam title string? New title
 * @BodyParam description string? New description
 * @BodyParam agentId number? New agent ID
 * @BodyParam dueAt string? New due date
 * @BodyParam estimatedHours number? New estimated hours
 * @BodyParam needs number[]? Dependency task IDs
 */
router.post(
  '/claw/task/edit',
  apiHandler(async (req, res) => {
    const { id, title, description, agentId, dueAt, estimatedHours, needs } =
      req.body
    const { t, locale } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const task = clawDb.findTaskById(Number(id))
    if (!task)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.taskNotFound'))

    if (!['draft', 'queue'].includes(task.status)) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        '\u53ea\u6709\u8349\u7a3f\u6216\u961f\u5217\u4e2d\u7684\u4efb\u52a1\u53ef\u4ee5\u4fee\u6539'
      )
    }

    if (title !== undefined && !String(title).trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskTitleRequired')
      )
    }

    const needsArr = Array.isArray(needs)
      ? (needs as unknown[]).map(String).filter((s) => Number(s) > 0)
      : undefined

    clawDb.updateTask(Number(id), {
      title: title !== undefined ? String(title).trim() : undefined,
      description:
        description !== undefined
          ? String(description).trim() || null
          : undefined,
      agentId:
        agentId != null ? Number(agentId) : agentId === null ? null : undefined,
      dueAt: dueAt !== undefined ? dueAt || null : undefined,
      estimatedHours:
        estimatedHours !== undefined
          ? estimatedHours != null
            ? Number(estimatedHours)
            : null
          : undefined,
      needs: needsArr,
    })

    const updated = clawDb.findTaskById(Number(id))!
    const agentMap = new Map<number, { title: string; avatar: string | null }>()
    if (updated.agent_id) {
      const w = clawDb.findById(updated.agent_id)
      if (w)
        agentMap.set(updated.agent_id, {
          title: w.title,
          avatar: w.avatar ?? null,
        })
    }
    return success(res, formatTask(updated, agentMap, locale))
  })
)

router.post(
  '/claw/task/stats',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { projectId } = req.body
    const counts = clawDb.countTasksByStatus(
      tenantId,
      userId,
      projectId ? { projectId: Number(projectId) } : undefined
    )
    return success(res, { counts })
  })
)

/**
 * @Api /api/claw/task/changeStatus
 * @Summary Change status task
 * @BodyParam id number Task ID
 * @BodyParam status string Target status
 * @BodyParam statusRemark string? Optional remark
 * @ReturnDataExample {"success":true}
 *
 * Allowed transitions:
 *   draft    -> queue | canceled
 *   queue    -> ready | draft | canceled
 *   pending  -> queue | canceled
 *   ready    -> queue | draft | canceled
 *   running  -> failed | canceled
 *   asking   -> queue
 *   failed   -> queue
 *   canceled -> queue
 */
router.post(
  '/claw/task/changeStatus',
  apiHandler(async (req, res) => {
    const { id, status: targetStatus, statusRemark } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    if (!targetStatus)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        '\u7f3a\u5c11\u76ee\u6807\u72b6\u6001'
      )

    const task = clawDb.findTaskById(Number(id))
    if (!task)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.taskNotFound'))

    const current = task.status
    const allowed: Record<string, string[]> = {
      draft: ['queue', 'canceled'],
      queue: ['ready', 'draft', 'canceled'],
      pending: ['queue', 'canceled'],
      ready: ['queue', 'draft', 'canceled'],
      running: ['failed', 'canceled'],
      asking: ['queue'],
      failed: ['queue'],
      canceled: ['queue'],
    }
    if (!(allowed[current] ?? []).includes(targetStatus)) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        `\u4e0d\u5141\u8bb8\u4ece ${current} \u5207\u6362\u5230 ${targetStatus}`
      )
    }

    const remark = statusRemark
      ? String(statusRemark)
      : targetStatus === 'failed'
        ? '\u624b\u52a8\u505c\u6b62'
        : null

    clawDb.updateTaskStatus(Number(id), targetStatus, remark)
    clawEventBus.emit('task:updated', {
      taskId: Number(id),
      status: targetStatus,
    })

    // queue \u72b6\u6001\u4e0b\u68c0\u67e5\u4f9d\u8d56\u662f\u5426\u5df2\u6ee1\u8db3
    if (targetStatus === 'queue') {
      const updatedTask = clawDb.findTaskById(Number(id))!
      if (clawDb.isTaskNeedsMet(updatedTask)) {
        clawDb.updateTaskStatus(Number(id), 'ready', null)
        clawEventBus.emit('task:updated', {
          taskId: Number(id),
          status: 'ready',
        })
      }
    }

    // \u5f53\u4efb\u52a1\u8f6c\u4e3a ready\uff0c\u68c0\u67e5\u5b50\u4efb\u52a1
    if (targetStatus === 'ready') {
      clawDb.checkAndPromoteQueuedChildren(Number(id))
    }

    return success(res, { success: true })
  })
)

/**
 * @Api /api/claw/task/childList
 * @Summary List children task
 * @BodyParam parentId number 父任务 ID
 */
router.post(
  '/claw/task/childList',
  apiHandler(async (req, res) => {
    const { parentId } = req.body
    const { t, locale } = useI18n(req)
    if (!parentId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const children = clawDb.findChildTasks(Number(parentId))

    const allAgents = clawDb.findAll(
      (req as unknown as AuthRequest).user.tenantId,
      (req as unknown as AuthRequest).user.userId
    )
    const agentMap = new Map<number, { title: string; avatar: string | null }>(
      allAgents.map((w) => [w.id, { title: w.title, avatar: w.avatar ?? null }])
    )

    return success(
      res,
      children.map((t) => formatTask(t, agentMap, locale))
    )
  })
)

/**
 * @Api /api/claw/task/childAdd
 * @Summary Add child task task
 * @BodyParam parentId number 父任务 ID（必须）
 * @BodyParam title string 子任务标题（必须）
 * @BodyParam agentId number? 执行智能体 ID
 * @BodyParam description string? 子任务描述
 */
router.post(
  '/claw/task/childAdd',
  apiHandler(async (req, res) => {
    const { parentId, title, agentId, description } = req.body
    const { t, locale } = useI18n(req)
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    if (!parentId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    if (!title || !String(title).trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskTitleRequired')
      )
    }

    const parent = clawDb.findTaskById(Number(parentId))
    if (!parent)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.taskNotFound'))

    const child = clawDb.insertTask({
      tenantId,
      userId,
      title: String(title).trim(),
      description: description ? String(description).trim() : undefined,
      agentId: agentId ? Number(agentId) : undefined,
      status: 'queue',
      parentId: Number(parentId),
      rootId: parent.root_id > 0 ? parent.root_id : Number(parentId),
      source: 'manual',
      sort: clawDb.getNextChildSort(Number(parentId)),
    })

    const agentMap = new Map<number, { title: string; avatar: string | null }>()
    if (child.agent_id) {
      const w = clawDb.findById(child.agent_id)
      if (w)
        agentMap.set(child.agent_id, {
          title: w.title,
          avatar: w.avatar ?? null,
        })
    }

    return success(res, formatTask(child, agentMap, locale))
  })
)

/**
 * @Api /api/claw/task/childDelete
 * @Summary Remove child task task
 * @BodyParam id number 子任务 ID
 */
router.post(
  '/claw/task/childDelete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const task = clawDb.findTaskById(Number(id))
    if (!task)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.taskNotFound'))
    if (task.status === 'running') {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskRunningCannotDelete')
      )
    }

    const ok = clawDb.deleteTask(Number(id))
    return success(res, { success: ok })
  })
)

/**
 * @Api /api/claw/task/descendants
 * @Summary Get descendants task
 * @BodyParam rootId number 根任务 ID
 * @ReturnDataExample [{"id":2,"parentId":1,"rootId":1,...}]
 */
router.post(
  '/claw/task/descendants',
  apiHandler(async (req, res) => {
    const { rootId } = req.body
    const { t, locale } = useI18n(req)
    if (!rootId) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const descendants = clawDb.findDescendants(Number(rootId))

    const allAgents = clawDb.findAll(
      (req as unknown as AuthRequest).user.tenantId,
      (req as unknown as AuthRequest).user.userId
    )
    const agentMap = new Map<number, { title: string; avatar: string | null }>(
      allAgents.map((w) => [w.id, { title: w.title, avatar: w.avatar ?? null }])
    )

    return success(
      res,
      descendants.map((t) => formatTask(t, agentMap, locale))
    )
  })
)

/**
 * @Api /api/claw/task/addToKeyResult
 * @Summary Add to key result task
 * @BodyParam keyResultId number KeyResult ID
 * @BodyParam title string Task title
 * @BodyParam agentId number? Agent ID
 * @BodyParam description string? Description
 */
router.post(
  '/claw/task/addToKeyResult',
  apiHandler(async (req, res) => {
    const { keyResultId, title, agentId, description } = req.body
    const { t, locale } = useI18n(req)
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    if (!keyResultId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    if (!title || !String(title).trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskTitleRequired')
      )
    }

    const keyResult = clawDb.findKeyResultById(Number(keyResultId))
    if (!keyResult)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        '\u5173\u952e\u7ed3\u679c\u4e0d\u5b58\u5728'
      )

    // 从关联目标获取 projectId，使任务归属于正确的项目
    const objective = keyResult.objective_id
      ? clawDb.findObjectiveById(keyResult.objective_id)
      : null
    const projectId = objective?.project_id ?? undefined

    const task = clawDb.insertTask({
      tenantId,
      userId,
      title: String(title).trim(),
      description: description ? String(description).trim() : undefined,
      agentId: agentId ? Number(agentId) : undefined,
      status: 'draft',
      source: 'objective',
      keyResultId: Number(keyResultId),
      objectiveId: keyResult.objective_id ?? 0,
      projectId,
    })

    const agentMap = new Map<number, { title: string; avatar: string | null }>()
    if (task.agent_id) {
      const w = clawDb.findById(task.agent_id)
      if (w)
        agentMap.set(task.agent_id, {
          title: w.title,
          avatar: w.avatar ?? null,
        })
    }

    return success(res, formatTask(task, agentMap, locale))
  })
)

const GeneratedTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  agentName: z.string().optional(),
  dueAt: z.string(),
  estimatedHours: z.number(),
})

/**
 * @Api /api/claw/task/generate
 * @Summary AI generate task based on context
 * @BodyParam keyResultId? number Key result ID
 * @BodyParam objectiveId? number Objective ID
 * @BodyParam parentId? number Parent task ID (for subtasks)
 * @BodyParam userPrompt? string User hint when no context is available
 * @ReturnDataExample {"task":{"title":"调研竞品SEO策略","description":"...","agentId":1,"dueAt":"2026-05-01","estimatedHours":4}}
 */
router.post(
  '/claw/task/generate',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { keyResultId, objectiveId, parentId, userPrompt } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    const modelConfigList = await resolveModelConfigListByParamName(
      paramDb,
      tenantId,
      userId,
      'ObjectivePlanModel'
    )

    const langInstruction = await buildUserSystemInfoLangPrompt(
      tenantId,
      userId
    )

    // 获取智能体列表
    const agents = clawDb.findAll(tenantId, userId, true)
    const agentListText =
      agents.length > 0
        ? agents.map((a) => `  - ${a.title}`).join('\n')
        : '  (no agents available)'

    // 构建上下文
    const contextLines: string[] = []

    // 项目 + 目标信息
    let resolvedObjectiveId = objectiveId ? Number(objectiveId) : 0
    let objectiveRow = resolvedObjectiveId
      ? clawDb.findObjectiveById(resolvedObjectiveId)
      : null

    if (!objectiveRow && keyResultId) {
      const kr = clawDb.findKeyResultById(Number(keyResultId))
      if (kr?.objective_id) {
        resolvedObjectiveId = kr.objective_id
        objectiveRow = clawDb.findObjectiveById(resolvedObjectiveId)
      }
    }

    if (objectiveRow) {
      contextLines.push(`Objective: ${objectiveRow.title}`)
      if (objectiveRow.description)
        contextLines.push(`Objective Description: ${objectiveRow.description}`)

      // 项目信息
      if (objectiveRow.project_id) {
        contextLines.push('\nProject Context:')
        contextLines.push(getProjectSummary(objectiveRow.project_id))
      }
    }

    // 关键结果信息
    if (keyResultId) {
      const kr = clawDb.findKeyResultById(Number(keyResultId))
      if (kr) {
        contextLines.push(`\nKey Result: ${kr.title}`)
        if (kr.detail) contextLines.push(`Key Result Detail: ${kr.detail}`)
        contextLines.push(`Key Result Status: ${kr.status}`)

        // 关键结果关联的已有任务
        const existingTasks = clawDb.findTasksByKeyResultId(
          tenantId,
          userId,
          Number(keyResultId)
        )
        if (existingTasks.length > 0) {
          contextLines.push('\nExisting tasks for this Key Result:')
          existingTasks.slice(0, 20).forEach((t) => {
            contextLines.push(`  - [id=${t.id}][${t.status}] ${t.title}`)
          })
        }
      }
    }

    // 父任务信息
    if (parentId) {
      const parentTask = clawDb.findTaskById(Number(parentId))
      if (parentTask) {
        contextLines.push(`\nParent Task: ${parentTask.title}`)
        if (parentTask.description)
          contextLines.push(
            `Parent Task Description: ${parentTask.description}`
          )
        const existingChildren = clawDb.findChildTasks(Number(parentId))
        if (existingChildren.length > 0) {
          contextLines.push('\nExisting subtasks (already created):')
          existingChildren.slice(0, 30).forEach((t) => {
            contextLines.push(`  - [id=${t.id}][${t.status}] ${t.title}`)
          })
        }
      }
    }

    const systemPrompt = `You are a professional task planning assistant. Generate one specific, executable task based on the context.
${langInstruction}
Available agents (智能体): Choose the most suitable one for this task.
${agentListText}

Respond with a JSON object:
- title: task title (concise, action-oriented)
- description: task description (specific steps or scope, max 150 words)
- agentName: the most suitable agent name from the list above, or empty string if unsure
- dueAt: due date in YYYY-MM-DD format
- estimatedHours: estimated hours as a number (e.g. 4)`

    // 用户自定义提示（无上下文时使用）
    if (userPrompt && typeof userPrompt === 'string' && userPrompt.trim()) {
      contextLines.push(`\nUser Hint: ${userPrompt.trim()}`)
    }

    const userPromptText =
      contextLines.join('\n') + '\n\nGenerate one appropriate task.'

    const result = await modelCall({
      tenantId,
      userId,
      biz: 'Claw',
      bizId: String(userId),
      modelConfigList,
      systemPrompt,
      userPrompt: userPromptText,
      schema: GeneratedTaskSchema,
      temperature: 0.7,
      maxRetry: 2,
      context: 'task.generate',
    })

    if (result.type !== 'json' || !result.data) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskGenerateFailed')
      )
    }

    // 解析 agentId
    let resolvedAgentId: number | null = null
    if (result.data.agentName) {
      const matched = agents.find(
        (a) =>
          a.title === result.data!.agentName ||
          a.title.toLowerCase() === result.data!.agentName?.toLowerCase()
      )
      if (matched) resolvedAgentId = matched.id
    }

    return success(res, {
      task: {
        title: result.data.title,
        description: result.data.description,
        agentId: resolvedAgentId,
        dueAt: result.data.dueAt,
        estimatedHours: result.data.estimatedHours,
      },
    })
  })
)

const GeneratedTasksSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      agentName: z.string().optional(),
      dueAt: z.string(),
      estimatedHours: z.number(),
      needs: z.array(z.string()).optional(),
    })
  ),
})

/**
 * @Api /api/claw/task/batchGenerate
 * @Summary AI batch generate multiple tasks based on context
 * @BodyParam keyResultId? number Key result ID
 * @BodyParam objectiveId? number Objective ID
 * @BodyParam parentId? number Parent task ID (for subtasks)
 * @BodyParam userPrompt? string User hint when no context is available
 * @ReturnDataExample {"tasks":[{"title":"调研竞品SEO策略","description":"...","agentId":1,"dueAt":"2026-05-01","estimatedHours":4,"needs":[]}]}
 */
router.post(
  '/claw/task/batchGenerate',
  apiHandler(async (req, res) => {
    const { keyResultId, objectiveId, parentId, userPrompt } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    const modelConfigList = await resolveModelConfigListByParamName(
      paramDb,
      tenantId,
      userId,
      'ObjectivePlanModel'
    )

    const langInstruction = await buildUserSystemInfoLangPrompt(
      tenantId,
      userId
    )

    const agents = clawDb.findAll(tenantId, userId, true)
    const agentListText =
      agents.length > 0
        ? agents.map((a) => `  - ${a.title}`).join('\n')
        : '  (no agents available)'

    const contextLines: string[] = []

    let resolvedObjectiveId = objectiveId ? Number(objectiveId) : 0
    let objectiveRow = resolvedObjectiveId
      ? clawDb.findObjectiveById(resolvedObjectiveId)
      : null

    if (!objectiveRow && keyResultId) {
      const kr = clawDb.findKeyResultById(Number(keyResultId))
      if (kr?.objective_id) {
        resolvedObjectiveId = kr.objective_id
        objectiveRow = clawDb.findObjectiveById(resolvedObjectiveId)
      }
    }

    if (objectiveRow) {
      contextLines.push(`Objective: ${objectiveRow.title}`)
      if (objectiveRow.description)
        contextLines.push(`Objective Description: ${objectiveRow.description}`)

      if (objectiveRow.project_id) {
        contextLines.push('\nProject Context:')
        contextLines.push(getProjectSummary(objectiveRow.project_id))
      }
    }

    if (keyResultId) {
      const kr = clawDb.findKeyResultById(Number(keyResultId))
      if (kr) {
        contextLines.push(`\nKey Result: ${kr.title}`)
        if (kr.detail) contextLines.push(`Key Result Detail: ${kr.detail}`)
        contextLines.push(`Key Result Status: ${kr.status}`)

        const existingTasks = clawDb.findTasksByKeyResultId(
          tenantId,
          userId,
          Number(keyResultId)
        )
        if (existingTasks.length > 0) {
          contextLines.push('\nExisting tasks for this Key Result:')
          existingTasks.slice(0, 20).forEach((t) => {
            contextLines.push(`  - [id=${t.id}][${t.status}] ${t.title}`)
          })
        }
      }
    }

    if (parentId) {
      const parentTask = clawDb.findTaskById(Number(parentId))
      if (parentTask) {
        contextLines.push(`\nParent Task: ${parentTask.title}`)
        if (parentTask.description)
          contextLines.push(
            `Parent Task Description: ${parentTask.description}`
          )
        // 已有子任务
        const existingChildren = clawDb.findChildTasks(Number(parentId))
        if (existingChildren.length > 0) {
          contextLines.push('\nExisting subtasks (already created):')
          existingChildren.slice(0, 30).forEach((t) => {
            contextLines.push(`  - [id=${t.id}][${t.status}] ${t.title}`)
          })
        }
      }
    }

    if (userPrompt && typeof userPrompt === 'string' && userPrompt.trim()) {
      contextLines.push(`\nUser Hint: ${userPrompt.trim()}`)
    }

    const systemPrompt = `You are a professional task planning assistant. Generate 3 to 5 specific, executable tasks based on the context.
${langInstruction}
Available agents (智能体): Choose the most suitable one for each task.
${agentListText}

Respond with a JSON object containing a "tasks" array, each item with:
- title: task title (concise, action-oriented)
- description: task description (specific steps or scope, max 150 words)
- agentName: the most suitable agent name from the list above, or empty string if this is a manual task
- dueAt: due date in YYYY-MM-DD format
- estimatedHours: estimated hours as a number
- needs: array of dependency strings (optional). Use "$0", "$1" etc. to reference tasks by their 0-based index in THIS batch. Use the numeric ID string (e.g. "42") to reference an already-existing task from context. Leave empty [] if no dependencies.`

    const userPromptText =
      contextLines.join('\n') +
      '\n\nGenerate 3 to 5 appropriate tasks. Set needs[] to express execution order where relevant.'

    const result = await modelCall({
      tenantId,
      userId,
      biz: 'Claw',
      bizId: String(userId),
      modelConfigList,
      systemPrompt,
      userPrompt: userPromptText,
      schema: GeneratedTasksSchema,
      temperature: 0.7,
      maxRetry: 2,
      context: 'task.batchGenerate',
    })

    if (result.type !== 'json' || !result.data) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.taskBatchGenerateFailed')
      )
    }

    const tasks = result.data.tasks.map((t) => {
      let resolvedAgentId: number | null = null
      if (t.agentName) {
        const matched = agents.find(
          (a) =>
            a.title === t.agentName ||
            a.title.toLowerCase() === t.agentName?.toLowerCase()
        )
        if (matched) resolvedAgentId = matched.id
      }
      return {
        title: t.title,
        description: t.description,
        agentId: resolvedAgentId,
        dueAt: t.dueAt,
        estimatedHours: t.estimatedHours,
        needs: t.needs ?? [],
      }
    })

    return success(res, { tasks })
  })
)

/**
 * @Api /api/claw/task/batchAdd
 * @Summary Batch create subtasks under a parent. Supports "$N" index references in needs.
 * @BodyParam parentId number Parent task ID
 * @BodyParam tasks array List of task definitions
 * @BodyParam tasks[].title string Task title
 * @BodyParam tasks[].description string? Task description
 * @BodyParam tasks[].agentId number? Agent ID
 * @BodyParam tasks[].needs (number|string)[]? Dependency IDs or "$N" references
 * @ReturnDataExample {"records":[{"id":1,"title":"Task 1"}]}
 */
router.post(
  '/claw/task/batchAdd',
  apiHandler(async (req, res) => {
    const { parentId, tasks: taskDefs } = req.body
    const { t, locale } = useI18n(req)
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    if (!parentId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    if (!Array.isArray(taskDefs) || taskDefs.length === 0) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        'tasks \u5fc5\u987b\u4e3a\u975e\u7a7a\u6570\u7ec4'
      )
    }

    const parent = clawDb.findTaskById(Number(parentId))
    if (!parent)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.taskNotFound'))

    const createdIds: number[] = []
    const created: ReturnType<typeof formatTask>[] = []

    const agentMap = new Map<number, { title: string; avatar: string | null }>()
    const allAgents = clawDb.findAll(tenantId, userId)
    for (const a of allAgents)
      agentMap.set(a.id, { title: a.title, avatar: a.avatar ?? null })

    for (let i = 0; i < taskDefs.length; i++) {
      const def = taskDefs[i]
      if (!def.title || !String(def.title).trim()) {
        return error(
          res,
          ResponseCodes.DEFAULT_ERROR,
          t('claw.taskTitleRequired')
        )
      }

      // Resolve "$N" index references in needs
      const rawNeeds: (number | string)[] = Array.isArray(def.needs)
        ? def.needs
        : []
      const resolvedNeeds: string[] = rawNeeds
        .map((n) => {
          if (typeof n === 'string' && n.startsWith('$')) {
            const idx = Number(n.slice(1))
            const id = createdIds[idx]
            return id ? String(id) : null
          }
          return Number(n) > 0 ? String(Number(n)) : null
        })
        .filter((n): n is string => n !== null)

      const child = clawDb.insertTask({
        tenantId,
        userId,
        title: String(def.title).trim(),
        description: def.description
          ? String(def.description).trim()
          : undefined,
        agentId: def.agentId ? Number(def.agentId) : undefined,
        status: 'queue',
        parentId: Number(parentId),
        rootId: parent.root_id > 0 ? parent.root_id : Number(parentId),
        source: 'manual',
        sort: clawDb.getNextChildSort(Number(parentId)),
        needs: resolvedNeeds,
      })

      createdIds.push(child.id)
      created.push(formatTask(child, agentMap, locale))
    }

    // Promote tasks whose needs are already met
    for (const id of createdIds) {
      const task = clawDb.findTaskById(id)!
      if (clawDb.isTaskNeedsMet(task)) {
        clawDb.updateTaskStatus(id, 'ready', null)
        clawEventBus.emit('task:updated', { taskId: id, status: 'ready' })
      }
    }

    return success(res, { records: created })
  })
)

export default router
