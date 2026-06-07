import { Router } from 'express'
import { config } from '../../config/index.js'
import { apiHandler } from '../../utils/api.js'
import { success } from '../../utils/response.js'
import { isSupervisor } from '../../utils/auth'
import { AuthRequest } from '../middlewares/auth'

const router = Router()

/**
 * @Api /api/account/current
 * @Summary Get current
 * @ReturnDataExample {"authType":"fixed","username":"admin","isSupervisor":true,"isCreator":false}
 */
router.post(
  '/account/current',
  apiHandler(async (req, res) => {
    const authReq = req as AuthRequest
    const userId = authReq.user.userId
    const tenantId = authReq.user.tenantId
    const isSup = isSupervisor(userId, tenantId)

    // client 模式强制为 fixed 模式
    const effectiveAuthType =
      config.viewMode === 'client' ? 'fixed' : config.auth.type

    // isCreator 仅在 database 模式下从 user 表读取
    let isCreatorVal = false
    if (effectiveAuthType === 'database') {
      const { userDb } = await import('../../storage/sqlite/store/user.js')
      const user = await userDb.findById(userId)
      isCreatorVal = user?.isCreator ?? false
    }

    return success(res, {
      authType: effectiveAuthType,
      username: config.auth.username,
      isSupervisor: isSup,
      isCreator: isCreatorVal,
    })
  })
)

export default router
