/**
 * Objective API routes (重构版)
 *
 * POST /objective/list                  — 查询所有目标
 * POST /objective/add                   — 新建目标
 * POST /objective/edit                  — 编辑目标   (body: { id, ...fields })
 * POST /objective/delete                — 删除目标   (body: { id })
 * POST /objective/generate              — AI 智能生成目标 (body: { projectId })
 * POST /objective/keyResult/list      — 查询目标关键结果列表（分页，支持状态筛选）
 * POST /objective/keyResult/add       — 新增关键结果
 * POST /objective/keyResult/edit      — 编辑关键结果
 * POST /objective/keyResult/delete    — 删除关键结果
 * POST /objective/focus/current         — 查询最新聚焦
 * POST /objective/focus/history         — 查询历史聚焦列表
 * POST /objective/focus/smartUpdate    — 触发 planner 智能更新聚焦
 * POST /objective/focus/delete          — 删除聚焦
 * POST /objective/setting/get           — 读取设置
 * POST /objective/setting/save          — 保存设置
 */
import { z } from 'zod'
import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import {
  modelCall,
  resolveModelConfigListByParamName,
} from '../../../../backend/src/model/model/index.js'
import { paramDb } from '../../../../backend/src/storage/store/userParam.js'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import { getLocale, useI18n } from '../../locale/index.js'
import { clawDb } from '../../storage/store/index.js'
import { getProjectSummary } from '../../utils/projectSummary.js'
import { buildUserSystemInfoLangPrompt } from '../../utils/prompt.js'
import { buildTasksWithDescendants } from '../../utils/taskFormat.js'
import type {
  KeyResultRow,
  ObjectiveRow,
} from '../../storage/store/objective.js'

const router: Router = Router()

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatObjective(row: ObjectiveRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    icon: row.icon,
    result: row.result ?? '',
    projectId: row.project_id ?? null,
    startAt: row.start_at ?? '',
    endAt: row.end_at ?? '',
    dueAt: row.due_at ?? '',
    createdAt: row.created_at,
  }
}

function formatAction(row: KeyResultRow) {
  return {
    id: row.id,
    objectiveId: row.objective_id,
    title: row.title,
    detail: row.detail,
    sourceProjectBacklogId: row.source_project_backlog_id ?? null,
    status: row.status,
    dueAt: row.due_at ?? '',
    estimatedHours: row.estimated_hours ?? null,
    createdAt: row.created_at,
  }
}

// ─── Objective Routes ─────────────────────────────────────────────────────────

/**
 * @Api /api/claw/objective/list
 * @Summary List objectives
 * @BodyParam status? string Status filter (active/done/all)
 * @BodyParam projectId? number Filter by project ID
 * @ReturnDataExample {"records":[{"id":1,"title":"排名第一","status":"active"}]}
 */
router.post(
  '/claw/objective/list',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { status, projectId } = req.body
    let objectives = clawDb.findAllObjectives(
      tenantId,
      userId,
      projectId ? { projectId: Number(projectId) } : undefined
    )
    if (status && status !== 'all') {
      objectives = objectives.filter((o) => o.status === status)
    }
    return success(res, { records: objectives.map(formatObjective) })
  })
)

/**
 * @Api /api/claw/objective/add
 * @Summary Add objective
 * @BodyParam title string Objective title
 * @BodyParam description? string Objective description
 * @BodyParam status? string Status
 * @BodyParam projectId? number 所属项目 ID
 * @BodyParam startAt? string Start time
 * @BodyParam endAt? string End time
 * @ReturnDataExample {"record":{"id":1,"title":"排名第一"}}
 */
router.post(
  '/claw/objective/add',
  apiHandler(async (req, res) => {
    const {
      title,
      description,
      status,
      icon,
      projectId,
      startAt,
      endAt,
      dueAt,
    } = req.body
    const { t } = useI18n(req)
    if (!title?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.objectiveProjectTitleRequired')
      )
    if (!projectId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.objectiveProjectIdRequired')
      )

    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const row = clawDb.insertObjective({
      tenantId,
      userId,
      title: title.trim(),
      description: description || undefined,
      status: status || 'active',
      icon: icon || 'target',
      projectId: Number(projectId),
      startAt: startAt || undefined,
      endAt: endAt || undefined,
      dueAt: dueAt || undefined,
    })
    return success(res, { record: formatObjective(row) })
  })
)

/**
 * @Api /api/claw/objective/edit
 * @Summary Edit objective
 * @BodyParam id number Objective ID
 * @BodyParam title? string Title
 * @BodyParam status? string Status
 * @ReturnDataExample {"record":{"id":1,"title":"排名第一"}}
 */
router.post(
  '/claw/objective/edit',
  apiHandler(async (req, res) => {
    const {
      id,
      title,
      description,
      status,
      icon,
      result,
      projectId,
      startAt,
      endAt,
      dueAt,
    } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findObjectiveById(Number(id))
    if (!row)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.objectiveProjectNotFound')
      )

    clawDb.updateObjective(Number(id), {
      title: title?.trim(),
      description: description !== undefined ? description : undefined,
      status: status || undefined,
      icon: icon || undefined,
      result: result !== undefined ? result : undefined,
      projectId:
        projectId !== undefined
          ? projectId != null
            ? Number(projectId)
            : null
          : undefined,
      startAt: startAt !== undefined ? startAt || null : undefined,
      endAt: endAt !== undefined ? endAt || null : undefined,
      dueAt: dueAt !== undefined ? dueAt || null : undefined,
    })

    const updated = clawDb.findObjectiveById(Number(id))!
    return success(res, { record: formatObjective(updated) })
  })
)

/**
 * @Api /api/claw/objective/delete
 * @Summary Delete objective
 * @BodyParam id number Objective ID
 * @ReturnDataExample null
 */
router.post(
  '/claw/objective/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    const ok = clawDb.deleteObjective(Number(id))
    if (!ok)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.objectiveProjectNotFound')
      )
    return success(res, null)
  })
)

// ─── Key Result Routes ──────────────────────────────────────────────────────────

/**
 * @Api /api/claw/objective/keyResult/list
 * @Summary List key results
 * @BodyParam objectiveId? number Objective ID
 * @BodyParam status? string Status filter
 * @BodyParam page? number Page number
 * @BodyParam pageSize? number Page size
 * @ReturnDataExample {"records":[{"id":1,"objectiveId":1,"title":"完成 MVP"}],"total":1}
 */
router.post(
  '/claw/objective/keyResult/list',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { objectiveId, status, page, pageSize } = req.body
    const result2 = clawDb.findAllKeyResults(tenantId, userId, {
      objectiveId: objectiveId ? Number(objectiveId) : undefined,
      status: status || undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Math.min(Number(pageSize), 50) : 20,
    })
    return success(res, {
      records: result2.items.map(formatAction),
      total: result2.total,
    })
  })
)

/**
 * @Api /api/claw/objective/keyResult/add
 * @Summary Add key result
 * @BodyParam objectiveId number Objective ID
 * @BodyParam title string Title
 * @BodyParam detail? string Detail
 * @BodyParam status? string Status (default: running)
 * @BodyParam dueAt? string Due date
 * @ReturnDataExample {"record":{"id":1,"title":"完成 MVP"}}
 */
router.post(
  '/claw/objective/keyResult/add',
  apiHandler(async (req, res) => {
    const {
      objectiveId,
      title,
      detail,
      sourceProjectBacklogId,
      status,
      dueAt,
      estimatedHours,
    } = req.body
    const { t } = useI18n(req)
    if (!objectiveId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    if (!title?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.keyResultTitleRequired')
      )

    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const row = clawDb.insertKeyResult({
      tenantId,
      userId,
      objectiveId: Number(objectiveId),
      title: title.trim(),
      detail: detail?.trim() || '',
      sourceProjectBacklogId: sourceProjectBacklogId
        ? Number(sourceProjectBacklogId)
        : undefined,
      status: status || 'running',
      dueAt: dueAt || undefined,
      estimatedHours:
        estimatedHours != null ? Number(estimatedHours) : undefined,
    })
    return success(res, { record: formatAction(row) })
  })
)

/**
 * @Api /api/claw/objective/keyResult/edit
 * @Summary Edit key result
 * @BodyParam id number Key result ID
 * @BodyParam title? string Title
 * @BodyParam status? string Status
 * @ReturnDataExample {"record":{"id":1,"title":"完成 MVP"}}
 */
router.post(
  '/claw/objective/keyResult/edit',
  apiHandler(async (req, res) => {
    const {
      id,
      title,
      detail,
      sourceProjectBacklogId,
      status,
      dueAt,
      estimatedHours,
    } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findKeyResultById(Number(id))
    if (!row)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.keyResultNotFound')
      )

    clawDb.updateKeyResult(Number(id), {
      title: title?.trim(),
      detail: detail !== undefined ? detail?.trim() : undefined,
      sourceProjectBacklogId:
        sourceProjectBacklogId !== undefined
          ? sourceProjectBacklogId
            ? Number(sourceProjectBacklogId)
            : null
          : undefined,
      status: status || undefined,
      dueAt: dueAt !== undefined ? dueAt || null : undefined,
      estimatedHours:
        estimatedHours !== undefined
          ? estimatedHours != null
            ? Number(estimatedHours)
            : null
          : undefined,
    })

    const updated = clawDb.findKeyResultById(Number(id))!
    return success(res, { record: formatAction(updated) })
  })
)

/**
 * @Api /api/claw/objective/keyResult/delete
 * @Summary Delete key result
 * @BodyParam id number Key result ID
 * @ReturnDataExample null
 */
router.post(
  '/claw/objective/keyResult/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    const ok = clawDb.deleteKeyResult(Number(id))
    if (!ok)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.keyResultNotFound')
      )
    return success(res, null)
  })
)

/** 查询某关键结果关联的任务列表 */
/**
 * @Api /api/claw/objective/keyResult/tasks
 * @Summary List tasks linked to key result
 * @BodyParam keyResultId number Key result ID
 * @ReturnDataExample {"records":[{"id":1,"title":"子任务"}]}
 */
router.post(
  '/claw/objective/keyResult/tasks',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { keyResultId } = req.body
    if (!keyResultId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.keyResultIdRequired')
      )
    const tasks = clawDb.findTasksByKeyResultId(
      tenantId,
      userId,
      Number(keyResultId)
    )
    const allAgents = clawDb.findAll(tenantId, userId)
    const agentMap = new Map<number, { title: string; avatar: string | null }>(
      allAgents.map((a) => [a.id, { title: a.title, avatar: a.avatar ?? null }])
    )
    const locale = getLocale(req)
    const records = buildTasksWithDescendants(tasks, agentMap, locale)
    return success(res, { records })
  })
)

const GeneratedKeyResultSchema = z.object({
  title: z.string(),
  detail: z.string(),
  dueAt: z.string(),
  estimatedHours: z.number(),
})

/**
 * @Api /api/claw/objective/keyResult/generate
 * @Summary AI generate key result based on objective context
 * @BodyParam objectiveId number Objective ID
 * @ReturnDataExample {"keyResult":{"title":"完成50篇SEO文章","detail":"...","dueAt":"2026-06-30","estimatedHours":40}}
 */
router.post(
  '/claw/objective/keyResult/generate',
  apiHandler(async (req, res) => {
    const { objectiveId } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    if (!objectiveId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.objectiveIdRequired')
      )

    const objective = clawDb.findObjectiveById(Number(objectiveId))
    if (!objective)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.objectiveProjectNotFound')
      )

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

    // 获取项目上下文
    let projectContext = ''
    if (objective.project_id) {
      projectContext = getProjectSummary(objective.project_id)
    }

    // 获取当前目标已有的关键结果
    const existingKeyResults = clawDb.findAllKeyResults(tenantId, userId, {
      objectiveId: Number(objectiveId),
    })
    const existingKRText =
      existingKeyResults.items.length > 0
        ? existingKeyResults.items
            .map((kr) => `  - [${kr.status}] ${kr.title}`)
            .join('\n')
        : '  (none)'

    const systemPrompt = `You are a professional OKR planning assistant. Based on the provided objective and context, generate one specific and measurable Key Result.
The key result should be concrete, time-bound, and directly contribute to achieving the objective.
${langInstruction}
Respond with a JSON object containing these fields:
- title: key result title (concise, measurable, e.g. "完成50篇SEO文章")
- detail: key result details (background, completion criteria, expected outcome, max 150 words)
- dueAt: due date in YYYY-MM-DD format
- estimatedHours: estimated hours as a number (e.g. 40)`

    const userPrompt = `Objective: ${objective.title}
${objective.description ? `Objective Description: ${objective.description}` : ''}
${projectContext ? `\nProject Context:\n${projectContext}` : ''}

Existing Key Results for this Objective:
${existingKRText}

Please generate one new key result that is not already covered by the existing ones.`

    const result = await modelCall({
      tenantId,
      userId,
      biz: 'Claw',
      bizId: String(userId),
      modelConfigList,
      systemPrompt,
      userPrompt,
      schema: GeneratedKeyResultSchema,
      temperature: 0.7,
      maxRetry: 2,
      context: 'objective.keyResult.generate',
    })

    if (result.type !== 'json' || !result.data) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.keyResultGenerateFailed')
      )
    }

    return success(res, { keyResult: result.data })
  })
)

const GeneratedKeyResultsSchema = z.object({
  keyResults: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      dueAt: z.string(),
      estimatedHours: z.number(),
    })
  ),
})

/**
 * @Api /api/claw/objective/keyResult/batchGenerate
 * @Summary AI batch generate multiple key results based on objective context
 * @BodyParam objectiveId number Objective ID
 * @BodyParam userPrompt? string User input prompt
 * @ReturnDataExample {"keyResults":[{"title":"完成50篇SEO文章","detail":"...","dueAt":"2026-06-30","estimatedHours":40}]}
 */
router.post(
  '/claw/objective/keyResult/batchGenerate',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { objectiveId, userPrompt: userInputPrompt } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    if (!objectiveId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.objectiveIdRequired')
      )

    const objective = clawDb.findObjectiveById(Number(objectiveId))
    if (!objective)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.objectiveProjectNotFound')
      )

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

    let projectContext = ''
    if (objective.project_id) {
      projectContext = getProjectSummary(objective.project_id)
    }

    const existingKeyResults = clawDb.findAllKeyResults(tenantId, userId, {
      objectiveId: Number(objectiveId),
    })
    const existingKRText =
      existingKeyResults.items.length > 0
        ? existingKeyResults.items
            .map((kr) => `  - [${kr.status}] ${kr.title}`)
            .join('\n')
        : '  (none)'

    const systemPrompt = `You are a professional OKR planning assistant. Based on the provided objective and context, generate 3 to 5 specific and measurable Key Results.
Each key result should be concrete, time-bound, and directly contribute to achieving the objective. Avoid duplicating existing key results.
${langInstruction}
Respond with a JSON object containing a "keyResults" array, each item with:
- title: key result title (concise, measurable)
- detail: key result details (background, completion criteria, expected outcome, max 150 words)
- dueAt: due date in YYYY-MM-DD format
- estimatedHours: estimated hours as a number`

    const userPromptText = `Objective: ${objective.title}
${objective.description ? `Objective Description: ${objective.description}` : ''}
${projectContext ? `\nProject Context:\n${projectContext}` : ''}

Existing Key Results for this Objective:
${existingKRText}
${userInputPrompt ? `\nUser requirement: ${userInputPrompt}` : ''}

Please generate 3 to 5 new key results that are not already covered by the existing ones.`

    const result = await modelCall({
      tenantId,
      userId,
      biz: 'Claw',
      bizId: String(userId),
      modelConfigList,
      systemPrompt,
      userPrompt: userPromptText,
      schema: GeneratedKeyResultsSchema,
      temperature: 0.7,
      maxRetry: 2,
      context: 'objective.keyResult.batchGenerate',
    })

    if (result.type !== 'json' || !result.data) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.keyResultBatchGenerateFailed')
      )
    }

    return success(res, { keyResults: result.data.keyResults })
  })
)

/** 触发 planner AI 分解关键结果为任务 */
/**
 * @Api /api/claw/objective/keyResult/decompose
 * @Summary AI decompose key result into tasks
 * @BodyParam keyResultId number Key result ID
 * @ReturnDataExample {"taskId":1,"message":"已触发 AI 分解，请稍候"}
 */
router.post(
  '/claw/objective/keyResult/decompose',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { keyResultId } = req.body
    if (!keyResultId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.keyResultIdRequired')
      )
    const action = clawDb.findKeyResultById(Number(keyResultId))
    if (!action)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.keyResultNotFound')
      )

    const agents = clawDb.findAll(tenantId, userId, true)
    const planner = agents.find((a) => a.role_name === 'planner') ?? agents[0]
    if (!planner)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.noAgentAvailable'))

    // 读取关联项目的需求池
    let backlogInfo = ''
    const objective = action.objective_id
      ? clawDb.findObjectiveById(action.objective_id)
      : null
    if (objective?.project_id) {
      try {
        const backlogs = clawDb.findBacklogsByProjectId(objective.project_id, {
          status: 'active',
        })
        if (backlogs.length > 0) {
          backlogInfo =
            '\n相关需求池条目：\n' +
            backlogs
              .slice(0, 10)
              .map((b: any) => `  - [id:${b.id}] ${b.title}`)
              .join('\n')
        }
      } catch {
        /* ignore */
      }
    }

    const prompt = `You are a task planning assistant. Break down the following Objective Key Result (目标关键结果) into specific, executable tasks, and use the task_batch_add tool to create them. Each task must be clear, measurable, and executable. When creating tasks, make sure to set the key_result_id to ${keyResultId}.

Objective Key Result (目标关键结果): ${action.title}${action.detail ? '\nDetails: ' + action.detail : ''}
Current Status: ${action.status}${backlogInfo}

Analyze and create 2-5 concrete tasks to break down this Key Result (关键结果). Task titles must be specific and actionable with clear completion criteria.`

    const task = clawDb.insertTask({
      tenantId,
      userId,
      agentId: planner.id,
      title: `${t('claw.keyResultDecomposeTitle')}：${action.title.slice(0, 40)}`,
      description: t('claw.keyResultDecomposeDesc'),
      status: 'ready',
      content: { prompt },
      objectiveId: action.objective_id,
      keyResultId: Number(keyResultId),
    })

    // 更新关键结果状态为 running
    clawDb.updateKeyResult(Number(keyResultId), { status: 'running' })

    return success(res, {
      taskId: task.id,
      message: t('claw.objectiveAiTriggered'),
    })
  })
)

// ─── Focus Routes ─────────────────────────────────────────────────────────────

/** 查询最新聚焦（包含关联的 action 详情） */
// ─── Setting Routes ───────────────────────────────────────────────────────────

/**
 * @Api /api/claw/objective/setting/get
 * @Summary Get objective settings
 * @ReturnDataExample {"goal":"最高效工作","style":"balanced"}
 */
router.post(
  '/claw/objective/setting/get',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const goal =
      (await paramDb.getParam(
        tenantId,
        userId,
        'claw:objective:setting:goal'
      )) ?? ''
    const style =
      (await paramDb.getParam(
        tenantId,
        userId,
        'claw:objective:setting:style'
      )) ?? 'balanced'
    return success(res, { goal, style })
  })
)

/**
 * @Api /api/claw/objective/setting/save
 * @Summary Save objective settings
 * @BodyParam goal? string Objective direction
 * @BodyParam style? string Planning style
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/claw/objective/setting/save',
  apiHandler(async (req, res) => {
    const { goal, style } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    if (goal !== undefined)
      await paramDb.setParam(
        tenantId,
        userId,
        'claw:objective:setting:goal',
        String(goal)
      )
    if (style !== undefined)
      await paramDb.setParam(
        tenantId,
        userId,
        'claw:objective:setting:style',
        String(style)
      )
    return success(res, null, t('claw.objectiveSettingSaved'))
  })
)

// ─── Generate Route ───────────────────────────────────────────────────────────

const GeneratedObjectiveSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  status: z.enum(['pending', 'active', 'paused', 'completed', 'failed']),
  dueAt: z.string(),
})

/**
 * @Api /api/claw/objective/generate
 * @Summary AI generate objective based on project context
 * @BodyParam projectId number? Project ID for context
 * @BodyParam userPrompt? string User input prompt
 * @ReturnDataExample {"objective":{"title":"Accelerate User Growth","description":"...","icon":"Target","status":"active","dueAt":"2026-06-30"}}
 */
router.post(
  '/claw/objective/generate',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { projectId, userPrompt: userInputPrompt } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    // 读取 ObjectivePlanModel 配置
    const modelConfigList = await resolveModelConfigListByParamName(
      paramDb,
      tenantId,
      userId,
      'ObjectivePlanModel'
    )

    // 读取目标设置（goal direction & planning style）及用户语言
    const [goalParam, styleParam, langInstruction] = await Promise.all([
      paramDb.getParam(tenantId, userId, 'claw:objective:setting:goal'),
      paramDb.getParam(tenantId, userId, 'claw:objective:setting:style'),
      buildUserSystemInfoLangPrompt(tenantId, userId),
    ])
    const goalDirection = goalParam ?? ''
    const planningStyle = styleParam ?? 'balanced'

    // 使用 getProjectSummary 生成英文项目摘要
    const projectContext = projectId ? getProjectSummary(Number(projectId)) : ''

    const systemPrompt = `You are a professional goal-planning assistant. Based on the provided project information, generate one meaningful and actionable Objective for the user.
The objective should be clear, specific, measurable, and aligned with the current stage of the projects.
${langInstruction}
Respond with a JSON object containing these fields:
- title: objective title (concise, action-oriented)
- description: objective description (max 100 words)
- icon: a lucide icon name (e.g. Target, TrendingUp, Users, Zap, Star, Rocket, Lightbulb)
- status: objective status, usually "active"
- dueAt: due date in YYYY-MM-DD format, typically 3–6 months from now`

    const userPrompt = `Please generate a suitable objective based on the following project information:

${projectContext}
${goalDirection ? `\nOverall goal direction: ${goalDirection}` : ''}
Planning style: ${planningStyle}
${userInputPrompt ? `\nUser requirement: ${userInputPrompt}` : ''}

Generate one objective that best fits the current project development needs.`

    const result = await modelCall({
      tenantId,
      userId,
      biz: 'Claw',
      bizId: String(userId),
      modelConfigList,
      systemPrompt,
      userPrompt,
      schema: GeneratedObjectiveSchema,
      temperature: 0.7,
      maxRetry: 2,
      context: 'objective.generate',
    })

    if (result.type !== 'json' || !result.data) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.objectiveGenerateFailed')
      )
    }

    return success(res, { objective: result.data })
  })
)

export default router
