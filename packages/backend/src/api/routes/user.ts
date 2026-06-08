import { Request, Response, Router } from 'express'
import type { AuthRequest } from '../middlewares/auth.js'
import { authMiddleware } from '../middlewares/auth.js'
import { isSupervisor } from '../../utils/auth.js'
import { ResponseCodes } from '../types/constants.js'
import { apiHandler } from '../../utils/api.js'
import { error, success } from '../../utils/response.js'
import { useI18n } from '../../locale/index.js'
import { userDb } from '../../storage/sqlite/store/user.js'
import { config } from '../../config/index.js'

const router = Router()

function requireDatabaseMode(
  res: Response,
  t: (key: string) => string
): boolean {
  if (config.auth.type !== 'database') {
    error(
      res,
      ResponseCodes.PERMIT_DENIED,
      t('featureRequiresDatabaseAuthMode')
    )
    return false
  }
  return true
}

// ── CRUD (supervisor only) —————————————————————————

/**
 * @Api /api/user/list
 * @Summary Paginate user list (supervisor only)
 * @BodyParam page? number Page number (default 1)
 * @BodyParam pageSize? number Page size (default 20)
 * @ReturnDataExample {"records":[{"id":1,"tenantId":1,"username":"admin","apiData":null,"isCreator":true,"createdAt":"2026-01-01 00:00:00"}],"total":1}
 */
router.post(
  '/user/list',
  authMiddleware,
  apiHandler(async (req, res) => {
    const { userId, tenantId } = (req as unknown as AuthRequest).user
    const { t } = useI18n(req)

    if (!requireDatabaseMode(res, t)) return
    if (!isSupervisor(userId, tenantId)) {
      return error(res, ResponseCodes.PERMIT_DENIED, t('authPermitDenied'))
    }

    const page = Number(req.body.page) || 1
    const pageSize = Number(req.body.pageSize) || 20

    const all = await userDb.findAll()
    const total = all.length
    const start = (page - 1) * pageSize
    const records = all.slice(start, start + pageSize).map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      username: r.username,
      apiData: r.apiData,
      isCreator: r.isCreator,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    return success(res, { records, total })
  })
)

/**
 * @Api /api/user/add
 * @Summary Create a user
 * @BodyParam username string
 * @BodyParam password string
 * @BodyParam isCreator? boolean
 * @BodyParam tenantId? number (default 1)
 * @ReturnDataExample {"record":{"id":2,"tenantId":1,"username":"user2","isCreator":false}}
 */
router.post(
  '/user/add',
  authMiddleware,
  apiHandler(async (req, res) => {
    const { userId, tenantId: authTenantId } = (req as unknown as AuthRequest)
      .user
    const { t } = useI18n(req)

    if (!requireDatabaseMode(res, t)) return
    if (!isSupervisor(userId, authTenantId)) {
      return error(res, ResponseCodes.PERMIT_DENIED, t('authPermitDenied'))
    }

    const { username, password, isCreator, tenantId } = req.body
    if (!username?.trim() || !password) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('usernameAndPasswordRequired')
      )
    }

    const existing = await userDb.findByUsername(username.trim())
    if (existing) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('usernameAlreadyExists'))
    }

    const record = await userDb.insert({
      tenantId: Number(tenantId),
      username: username.trim(),
      password,
      isCreator: Boolean(isCreator),
    })

    return success(res, {
      record: {
        id: record.id,
        tenantId: record.tenantId,
        username: record.username,
        isCreator: record.isCreator,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    })
  })
)

/**
 * @Api /api/user/edit
 * @Summary Update a user
 * @BodyParam id number
 * @BodyParam username? string
 * @BodyParam password? string
 * @BodyParam isCreator? boolean
 * @BodyParam tenantId? number
 * @ReturnDataExample {"record":{"id":2,"tenantId":1,"username":"user2","isCreator":false}}
 */
router.post(
  '/user/edit',
  authMiddleware,
  apiHandler(async (req, res) => {
    const { userId, tenantId: authTenantId } = (req as unknown as AuthRequest)
      .user
    const { t } = useI18n(req)

    if (!requireDatabaseMode(res, t)) return
    if (!isSupervisor(userId, authTenantId)) {
      return error(res, ResponseCodes.PERMIT_DENIED, t('authPermitDenied'))
    }

    const { id, username, password, isCreator, tenantId } = req.body
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }

    if (username !== undefined && !username.trim()) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('usernameCannotBeEmpty'))
    }

    const updateData: Record<string, unknown> = {}
    if (username !== undefined) updateData.username = username.trim()
    if (password !== undefined) updateData.password = password
    if (isCreator !== undefined) updateData.isCreator = Boolean(isCreator)
    if (tenantId !== undefined) updateData.tenantId = Number(tenantId)

    if (Object.keys(updateData).length === 0) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('noFieldsToUpdate'))
    }

    const record = await userDb.update(Number(id), updateData as any)
    if (!record) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('userNotFound'))
    }

    return success(res, {
      record: {
        id: record.id,
        tenantId: record.tenantId,
        username: record.username,
        isCreator: record.isCreator,
        apiData: record.apiData,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    })
  })
)

/**
 * @Api /api/user/delete
 * @Summary Delete a user (creator user cannot be deleted)
 * @BodyParam id number
 * @ReturnDataExample {"deleted":true}
 */
router.post(
  '/user/delete',
  authMiddleware,
  apiHandler(async (req, res) => {
    const { userId, tenantId: authTenantId } = (req as unknown as AuthRequest)
      .user
    const { t } = useI18n(req)

    if (!requireDatabaseMode(res, t)) return
    if (!isSupervisor(userId, authTenantId)) {
      return error(res, ResponseCodes.PERMIT_DENIED, t('authPermitDenied'))
    }

    const { id } = req.body
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }

    const record = await userDb.findById(Number(id))
    if (!record) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('userNotFound'))
    }

    if (record.isCreator) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('cannotDeleteCreatorUser')
      )
    }

    await userDb.delete(Number(id))
    return success(res, { deleted: true })
  })
)

export default router
