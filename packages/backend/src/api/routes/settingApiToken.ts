import crypto from 'crypto'
import { Router } from 'express'
import { apiTokenDb } from '../../storage/store/apiToken.js'
import { apiHandler } from '../../utils/api.js'
import { useI18n } from '../../locale/index.js'
import { error, success } from '../../utils/response.js'
import {
  authMiddleware,
  AuthRequest,
  webComponentDisabledMiddleware,
  supervisorMiddleware,
} from '../middlewares/auth.js'
import { ResponseCodes } from '../types/constants.js'

const router = Router()

/**
 * @Api /api/setting/apiToken/paginate
 * @Summary Paginate setting api token
 * @BodyParam page number Page number, default 1
 * @BodyParam pageSize number Page size, default 20
 * @ReturnDataExample {"records":[{"id":1,"title":"My Token","token":"abc123","expire":"2027-01-01T00:00:00.000Z"}],"page":1,"pageSize":20,"total":1}
 */
router.post(
  '/setting/apiToken/paginate',
  webComponentDisabledMiddleware,
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const authReq = req as AuthRequest
    const userId = authReq.user.userId
    const tenantId = authReq.user.tenantId
    const { page = 1, pageSize = 20 } = req.body as {
      page?: number
      pageSize?: number
    }

    const result = await apiTokenDb.paginateApiTokens(
      tenantId,
      userId,
      page,
      pageSize
    )
    return success(res, {
      records: result.data,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    })
  })
)

/**
 * @Api /api/setting/apiToken/add
 * @Summary Add setting api token
 * @BodyParam expire string Expiry date (ISO 8601)
 * @BodyParam permissions string Optional permission scopes
 * @BodyParam title string Optional token label
 * @ReturnDataExample {"record":{"id":1,"title":"My Token","token":"abc123","expire":"2027-01-01T00:00:00.000Z"}}
 */
router.post(
  '/setting/apiToken/add',
  webComponentDisabledMiddleware,
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const authReq = req as AuthRequest
    const userId = authReq.user.userId
    const tenantId = authReq.user.tenantId
    const {
      permissions = '',
      expire,
      title,
    } = req.body as {
      permissions?: string
      expire: string
      title?: string
    }

    if (!expire) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('apiTokenExpireRequired')
      )
    }

    const expireDate = new Date(expire)
    if (isNaN(expireDate.getTime())) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('apiTokenExpireInvalid'))
    }

    const token = crypto.randomBytes(32).toString('hex')

    const record = await apiTokenDb.createApiToken({
      tenantId,
      userId,
      token,
      permissions,
      expire: expireDate,
      title: title ?? null,
    })

    return success(res, { record })
  })
)

/**
 * @Api /api/setting/apiToken/edit
 * @Summary Edit setting api token
 * @BodyParam id number Token ID
 * @BodyParam permissions string Optional new permissions
 * @BodyParam expire string Optional new expiry date (ISO 8601)
 * @BodyParam title string Optional new label
 * @ReturnDataExample {"record":{"id":1,"title":"My Token","expire":"2027-01-01T00:00:00.000Z"}}
 */
router.post(
  '/setting/apiToken/edit',
  webComponentDisabledMiddleware,
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { id, permissions, expire, title } = req.body as {
      id: number
      permissions?: string
      expire?: string
      title?: string
    }

    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }

    const existing = await apiTokenDb.findApiTokenById(id)
    if (!existing) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('apiTokenNotFound'))
    }

    const updateData: {
      permissions?: string
      expire?: Date
      title?: string | null
    } = {}
    if (permissions !== undefined) updateData.permissions = permissions
    if (title !== undefined) updateData.title = title
    if (expire !== undefined) {
      const expireDate = new Date(expire)
      if (isNaN(expireDate.getTime())) {
        return error(
          res,
          ResponseCodes.DEFAULT_ERROR,
          t('apiTokenExpireInvalid')
        )
      }
      updateData.expire = expireDate
    }

    const record = await apiTokenDb.updateApiToken(id, updateData)
    return success(res, { record })
  })
)

/**
 * @Api /api/setting/apiToken/delete
 * @Summary Remove setting api token
 * @BodyParam id number Token ID
 * @ReturnDataExample {"deleted":true}
 */
router.post(
  '/setting/apiToken/delete',
  webComponentDisabledMiddleware,
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { id } = req.body as { id: number }

    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }

    const existing = await apiTokenDb.findApiTokenById(id)
    if (!existing) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('apiTokenNotFound'))
    }

    await apiTokenDb.deleteApiToken(id)
    return success(res, { deleted: true })
  })
)

/**
 * @Api /api/setting/apiToken/get
 * @Summary Get setting api token
 * @BodyParam id number Token ID
 * @ReturnDataExample {"record":{"id":1,"title":"My Token","token":"abc123","expire":"2027-01-01T00:00:00.000Z"}}
 */
router.post(
  '/setting/apiToken/get',
  webComponentDisabledMiddleware,
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { id } = req.body as { id: number }

    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }

    const record = await apiTokenDb.findApiTokenById(id)
    if (!record) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('apiTokenNotFound'))
    }

    return success(res, { record })
  })
)

/**
 * @Api /api/setting/apiToken/regenerate
 * @Summary Regenerate setting api token
 * @BodyParam id number Token ID
 * @ReturnDataExample {"record":{"id":1,"token":"newToken123"}}
 */
router.post(
  '/setting/apiToken/regenerate',
  webComponentDisabledMiddleware,
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { id } = req.body as { id: number }

    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }

    const existing = await apiTokenDb.findApiTokenById(id)
    if (!existing) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('apiTokenNotFound'))
    }

    const newToken = crypto.randomBytes(32).toString('hex')
    const record = await apiTokenDb.updateApiToken(id, { token: newToken })
    return success(res, { record })
  })
)

export default router
