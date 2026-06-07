/**
 * Runtime API routes
 *
 * Routes:
 *   POST /runtime/list           — 列出所有运行环境
 *   POST /runtime/add            — 新增运行环境
 *   POST /runtime/edit           — 更新运行环境
 *   POST /runtime/delete         — 删除运行环境
 *   POST /runtime/runner/setEnable — 启用/禁用运行器
 *   POST /runtime/requestSync    — 请求同步运行器列表
 */

import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants.js'
import { apiHandler } from '../../../../backend/src/utils/api.js'
import { error, success } from '../../../../backend/src/utils/response.js'
import { getClawRuntimeWs } from '../../index.js'
import { useI18n } from '../../locale/index.js'
import { localRuntimeController } from '../../runtime/localController.js'
import { clawDb } from '../../storage/store/index.js'
import type {
  AddRuntimeInput,
  RuntimeRow,
  RunnerInfo,
  UpdateRuntimeInput,
} from '../../storage/store/types.js'

const router: Router = Router()

/** Parse the JSON runners field into an array (or null) for client consumption */
function serializeRuntime(row: RuntimeRow) {
  let runners = null
  if (row.runners) {
    try {
      runners = JSON.parse(row.runners)
    } catch {
      /* ignore */
    }
  }
  return { ...row, runners }
}

/**
 * @Api /api/claw/runtime/list
 * @Summary List runtime
 * @ReturnDataExample [{"id":1,"name":"runtime1","title":"Runtime","token":"xxx","runners":[]}]
 */
router.post(
  '/claw/runtime/list',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const runtimes = clawDb
      .findAllRuntimes(tenantId, userId)
      .map(serializeRuntime)
    // 本机运行环境始终排在第一位
    const localRow = await localRuntimeController.getRuntimeRow(
      tenantId,
      userId
    )
    return success(res, [serializeRuntime(localRow), ...runtimes])
  })
)

/**
 * @Api /api/claw/runtime/add
 * @Summary Add runtime
 * @BodyParam name string Unique runtime name
 * @BodyParam title string Display title
 * @BodyParam token string Authentication token
 * @ReturnDataExample {"id":1,"name":"runtime1","title":"Runtime","token":"xxx"}
 */
router.post(
  '/claw/runtime/add',
  apiHandler(async (req, res) => {
    const { name, title, token } = req.body as AddRuntimeInput
    const { t } = useI18n(req)
    if (!name || !title || !token) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.runtimeFieldsRequired')
      )
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const row = clawDb.insertRuntime({ tenantId, userId, name, title, token })
    return success(res, serializeRuntime(row), t('claw.runtimeCreated'))
  })
)

/**
 * @Api /api/claw/runtime/edit
 * @Summary Edit runtime
 * @BodyParam id number Runtime ID
 * @BodyParam name string? Updated name
 * @BodyParam title string? Updated title
 * @BodyParam token string? Updated token
 * @ReturnDataExample {"id":1,"name":"runtime1","title":"Updated"}
 */
router.post(
  '/claw/runtime/edit',
  apiHandler(async (req, res) => {
    const { id, ...input } = req.body as { id: number } & UpdateRuntimeInput
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    if (id === 0) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.runtimeLocalCannotEdit')
      )
    }
    const existing = clawDb.findRuntimeById(id)
    if (!existing) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.runtimeNotFound'))
    }
    clawDb.updateRuntime(id, input)
    return success(res, serializeRuntime(clawDb.findRuntimeById(id)!))
  })
)

/**
 * @Api /api/claw/runtime/delete
 * @Summary Remove runtime
 * @BodyParam id number Runtime ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/runtime/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body as { id: number }
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    if (id === 0) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.runtimeLocalCannotDelete')
      )
    }
    const ok = clawDb.deleteRuntime(id)
    if (!ok) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.runtimeNotFound'))
    }
    return success(res, null, t('claw.runtimeDeleted'))
  })
)

/**
 * @Api /api/claw/runtime/runner/setEnable
 * @Summary Set enable state runtime runner
 * @BodyParam id number Runtime ID
 * @BodyParam name string Runner name
 * @BodyParam enable boolean Enable or disable the runner
 * @ReturnDataExample {"id":1,"runners":[{"name":"runner1","enable":true}]}
 */
router.post(
  '/claw/runtime/runner/setEnable',
  apiHandler(async (req, res) => {
    const { id, name, enable } = req.body as {
      id: number
      name: string
      enable: boolean
    }
    const { t } = useI18n(req)
    if (id === undefined || id === null || !name || enable === undefined) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.invalidInput'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    // 本机运行环境
    if (id === 0) {
      await localRuntimeController.setRunnerEnable(
        name,
        enable,
        tenantId,
        userId
      )
      const localRow = await localRuntimeController.getRuntimeRow(
        tenantId,
        userId
      )
      return success(res, serializeRuntime(localRow))
    }

    const existing = clawDb.findRuntimeById(id)
    if (!existing) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.runtimeNotFound'))
    }
    let runners: RunnerInfo[] = []
    if (existing.runners) {
      try {
        runners = JSON.parse(existing.runners)
      } catch {
        /* ignore */
      }
    }
    const idx = runners.findIndex((e) => e.name === name)
    if (idx === -1) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.runnerNotFound'))
    }
    runners[idx] = { ...runners[idx], enable }
    clawDb.updateRuntime(id, { runners })
    return success(res, serializeRuntime(clawDb.findRuntimeById(id)!))
  })
)

/**
 * @Api /api/claw/runtime/requestSync
 * @Summary Request sync runtime
 * @BodyParam id number Runtime ID
 * @ReturnDataExample {"sent":true}
 */
router.post(
  '/claw/runtime/requestSync',
  apiHandler(async (req, res) => {
    const { id } = req.body as { id: number }
    const { t } = useI18n(req)
    if (id === undefined || id === null) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId

    // 本机运行环境
    if (id === 0) {
      const sent = await localRuntimeController.requestSync(tenantId, userId)
      return success(res, { sent })
    }

    const existing = clawDb.findRuntimeById(id)
    if (!existing) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.runtimeNotFound'))
    }
    const sent = getClawRuntimeWs().requestSync(id)
    return success(res, { sent })
  })
)

export default router
