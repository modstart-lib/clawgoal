/**
 * Cron task API routes
 *
 * POST /cron/list    — list all cron tasks
 * POST /cron/add     — create a cron task
 * POST /cron/update  — update a cron task
 * POST /cron/delete  — delete a cron task        (body: { id })
 * POST /cron/toggle  — toggle enable/disable     (body: { id, enable })
 * POST /cron/run     — trigger task immediately  (body: { id })
 * POST /cron/logs    — get execution logs        (body: { id, limit? })
 */
import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import type { CronConfig } from '../../cron/index.js'
import { cronManager, type CronTask } from '../../cron/index.js'
import { useI18n } from '../../locale/index.js'
import type { CronLogRow } from '../../storage/store/index.js'
import { clawDb } from '../../storage/store/index.js'

const router: Router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse action/script from stored prompt JSON */
function parsePrompt(prompt: string): { action: string; script: string } {
  try {
    const parsed = JSON.parse(prompt)
    if (parsed && typeof parsed.action === 'string') {
      return { action: parsed.action, script: parsed.script || '' }
    }
  } catch {
    // not JSON — treat as custom script
  }
  return { action: 'custom', script: prompt }
}

function formatTask(task: CronTask) {
  const { action, script } = parsePrompt(task.prompt)
  return {
    id: task.id,
    name: task.title,
    cron: task.cron,
    action,
    script,
    config: task.config,
    description: task.description || '',
    status: task.enable ? 'enabled' : 'disabled',
    agentId: task.agentId ? String(task.agentId) : undefined,
    lastRun: task.lastRunAt || undefined,
    nextRun: task.nextRunAt || undefined,
    lastResult: task.lastResult || undefined,
    successNotify: task.successNotify,
    isRunning: cronManager.isRunning(task.id),
    createdAt: task.createdAt,
  }
}

function formatLog(log: CronLogRow) {
  return {
    id: log.id,
    time: log.start_at,
    success: log.status === 'success',
    message:
      log.status_remark || (log.status === 'success' ? 'Success' : 'Failed'),
    result: log.result || undefined,
    logs: log.logs || undefined,
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/cron/list
 * @Summary List cron
 * @ReturnDataExample [{"id":1,"name":"Daily Report","cron":"0 9 * * *","status":"enabled"}]
 */
router.post(
  '/claw/cron/list',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const tasks = cronManager.listTasks(tenantId, userId).map(formatTask)
    return success(res, tasks)
  })
)

/**
 * @Api /api/claw/cron/add
 * @Summary Add cron
 * @BodyParam name string Task name
 * @BodyParam cron string Cron expression
 * @BodyParam agentId number Assigned agent ID (required)
 * @BodyParam action string? Action type (default: custom)
 * @BodyParam script string? Script content
 * @BodyParam description string? Description
 * @BodyParam enable boolean? Enable on creation
 * @BodyParam config object? Cron config
 * @BodyParam successNotify boolean? Notify on success
 * @ReturnDataExample {"id":1,"name":"Daily Report","cron":"0 9 * * *","status":"enabled"}
 */
router.post(
  '/claw/cron/add',
  apiHandler(async (req, res) => {
    const {
      name,
      cron,
      action = 'custom',
      script = '',
      description,
      agentId,
      enable,
      config,
      successNotify,
    } = req.body
    const { t } = useI18n(req)
    if (!name || !cron || !agentId) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.cronNameCronRequired')
      )
    }
    const prompt = JSON.stringify({ action, script })
    // 解析 config 字段
    let cronConfig: CronConfig | undefined
    if (config && typeof config === 'object' && config.type) {
      cronConfig = config as CronConfig
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const task = await cronManager.addTask(tenantId, userId, {
      title: name,
      cron,
      prompt,
      config: cronConfig ?? null,
      description: description || null,
      agentId: Number(agentId),
      enable: enable !== false,
      runOnce: false,
      successNotify: successNotify === true,
    })
    return success(res, formatTask(task), t('claw.cronCreated'))
  })
)

/**
 * @Api /api/claw/cron/update
 * @Summary Update cron
 * @BodyParam id number Cron task ID
 * @BodyParam name string? Updated name
 * @BodyParam cron string? Updated cron expression
 * @BodyParam action string? Updated action type
 * @BodyParam script string? Updated script
 * @BodyParam enable boolean? Enable or disable
 * @ReturnDataExample {"id":1,"name":"Updated Task","status":"enabled"}
 */
router.post(
  '/claw/cron/update',
  apiHandler(async (req, res) => {
    const {
      id,
      name,
      cron,
      action,
      script,
      description,
      agentId,
      enable,
      config,
      successNotify,
    } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const existing = cronManager.getTask(Number(id))
    if (!existing)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.cronNotFound'))

    const updates: Parameters<typeof cronManager.updateTask>[1] = {}
    if (name !== undefined) updates.title = name
    if (cron !== undefined) updates.cron = cron
    if (action !== undefined || script !== undefined) {
      const current = parsePrompt(existing.prompt)
      updates.prompt = JSON.stringify({
        action: action !== undefined ? action : current.action,
        script: script !== undefined ? script : current.script,
      })
    }
    if (description !== undefined) updates.description = description
    if (agentId !== undefined) updates.agentId = Number(agentId)
    if (enable !== undefined) updates.enable = enable
    if (config !== undefined) {
      updates.config =
        config && typeof config === 'object' && config.type
          ? (config as CronConfig)
          : null
    }
    if (successNotify !== undefined)
      updates.successNotify = successNotify === true

    const task = await cronManager.updateTask(Number(id), updates)
    if (!task)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.cronNotFound'))
    return success(res, formatTask(task), t('claw.cronUpdated'))
  })
)

/**
 * @Api /api/claw/cron/delete
 * @Summary Remove cron
 * @BodyParam id number Cron task ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/cron/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    const ok = await cronManager.deleteTask(Number(id))
    if (!ok)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.cronNotFound'))
    return success(res, null, t('claw.cronDeleted'))
  })
)

/**
 * @Api /api/claw/cron/toggle
 * @Summary Toggle cron
 * @BodyParam id number Cron task ID
 * @BodyParam enable boolean Enable or disable
 * @ReturnDataExample {"id":1,"name":"Task","status":"enabled"}
 */
router.post(
  '/claw/cron/toggle',
  apiHandler(async (req, res) => {
    const { id, enable } = req.body
    const { t } = useI18n(req)
    if (id === undefined || enable === undefined) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.cronIdEnableRequired')
      )
    }
    const task = await cronManager.updateTask(Number(id), { enable: !!enable })
    if (!task)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.cronNotFound'))
    return success(
      res,
      formatTask(task),
      enable ? t('claw.cronEnabled') : t('claw.cronDisabled')
    )
  })
)

/**
 * @Api /api/claw/cron/run
 * @Summary Run cron
 * @BodyParam id number Cron task ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/cron/run',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    const ok = await cronManager.runTaskNow(Number(id))
    if (!ok)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.cronNotFound'))
    return success(res, null, t('claw.cronRunNowTriggered'))
  })
)

/**
 * @Api /api/claw/cron/logs
 * @Summary Get logs cron
 * @BodyParam id number Cron task ID
 * @BodyParam limit number? Max log entries (default: 20)
 * @BodyParam startTime string? Filter logs after this time (inclusive)
 * @BodyParam endTime string? Filter logs before this time (inclusive)
 * @ReturnDataExample [{"id":1,"time":"2024-01-01","success":true,"message":"Success"}]
 */
router.post(
  '/claw/cron/logs',
  apiHandler(async (req, res) => {
    const { id, limit = 200, startTime, endTime } = req.body
    const { t: _t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, 'ID is required')
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const logs = clawDb
      .listCronLogs(
        tenantId,
        userId,
        Number(id),
        Number(limit),
        0,
        startTime || undefined,
        endTime || undefined
      )
      .map(formatLog)
    return success(res, logs)
  })
)

/**
 * @Api /api/claw/cron/stat
 * @Summary Get statistics cron
 * @ReturnDataExample {"totalRunCount": 100}
 */
router.post(
  '/claw/cron/stat',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const totalRunCount = clawDb.countCronLogs(tenantId, userId)
    return success(res, { totalRunCount })
  })
)

/**
 * @Api /api/claw/cron/history
 * @Summary Get history cron
 * @BodyParam agentId number? Filter by agent ID
 * @BodyParam limit number? Max records (default: 100)
 * @ReturnDataExample [{"id":1,"taskName":"Daily","time":"","success":true}]
 */
router.post(
  '/claw/cron/history',
  apiHandler(async (req, res) => {
    const { agentId, limit = 100 } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const allLogs = clawDb.listCronLogs(
      tenantId,
      userId,
      undefined,
      Number(limit)
    )
    const result = allLogs
      .filter(
        (log) =>
          agentId === undefined ||
          agentId === null ||
          String(log.agent_id) === String(agentId)
      )
      .map((log) => ({
        id: log.id,
        taskName: log.title,
        time: log.start_at,
        success: log.status === 'success',
        message:
          log.status_remark ||
          (log.status === 'success' ? 'Success' : 'Failed'),
        agentId: log.agent_id != null ? String(log.agent_id) : undefined,
        result: log.result || undefined,
        logs: log.logs || undefined,
      }))
    return success(res, result)
  })
)

/**
 * @Api /api/claw/cron/history/paginate
 * @Summary Paginated cron history with optional date filter
 * @BodyParam page number Page number (default 1)
 * @BodyParam pageSize number Page size (default 20)
 * @BodyParam agentId string? Filter by agent ID
 * @BodyParam startDate string? Start date filter (YYYY-MM-DD)
 * @BodyParam endDate string? End date filter (YYYY-MM-DD)
 * @ReturnDataExample {"records":[{"id":1,"taskName":"Daily","time":"","success":true}],"total":42}
 */
router.post(
  '/claw/cron/history/paginate',
  apiHandler(async (req, res) => {
    const { page = 1, pageSize = 20, agentId, startDate, endDate } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const offset = (Number(page) - 1) * Number(pageSize)
    const startTime = startDate ? `${startDate} 00:00:00` : undefined
    const endTime = endDate ? `${endDate} 23:59:59` : undefined
    const agentIdNum =
      agentId !== undefined && agentId !== null ? Number(agentId) : undefined
    const allLogs = clawDb.listCronLogs(
      tenantId,
      userId,
      undefined,
      Number(pageSize),
      offset,
      startTime,
      endTime,
      agentIdNum
    )
    const total = clawDb.countCronLogsFiltered(
      tenantId,
      userId,
      undefined,
      startTime,
      endTime,
      agentIdNum
    )
    const records = allLogs.map((log) => ({
      id: log.id,
      taskName: log.title,
      time: log.start_at,
      success: log.status === 'success',
      message:
        log.status_remark || (log.status === 'success' ? 'Success' : 'Failed'),
      agentId: log.agent_id != null ? String(log.agent_id) : undefined,
      result: log.result || undefined,
      logs: log.logs || undefined,
    }))
    return success(res, { records, total })
  })
)

/**
 * @Api /api/claw/cron/history/delete
 * @Summary Remove cron history
 * @BodyParam id number History record ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/cron/history/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    const ok = clawDb.deleteCronLog(Number(id))
    if (!ok)
      return error(res, ResponseCodes.DEFAULT_ERROR, 'History record not found')
    return success(res, null, 'Deleted')
  })
)

/**
 * @Api /api/claw/cron/log/live
 * @Summary Get live log cron log
 * @BodyParam id number Cron task ID
 * @ReturnDataExample {"isRunning":true,"content":"[INFO] ...","type":"shell"}
 */
import { readFileSync } from 'node:fs'
router.post(
  '/claw/cron/log/live',
  apiHandler(async (req, res) => {
    const { id } = req.body
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, 'ID is required')
    const cronId = Number(id)
    const isRunning = cronManager.isRunning(cronId)
    if (!isRunning) {
      return success(res, { isRunning: false, content: null, type: null })
    }
    const logFile = cronManager.getRunningLogFile(cronId)
    const { t } = useI18n(req)
    if (logFile) {
      try {
        const content = readFileSync(logFile, 'utf8')
        return success(res, { isRunning: true, content, type: 'shell' })
      } catch {
        return success(res, {
          isRunning: true,
          content: t('claw.cronLogReading'),
          type: 'shell',
        })
      }
    }
    return success(res, {
      isRunning: true,
      content: t('claw.cronAgentExecuting'),
      type: 'agent',
    })
  })
)

export default router
