import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../../config/index.js'
import { apiTokenDb } from '../../storage/store/apiToken.js'
import {
  error,
  loginRequired,
  permitDenied,
  tokenEmpty,
} from '../../utils/response'
import { isSupervisor } from '../../utils/auth.js'
import { useI18n } from '../../locale/index.js'
import { ResponseCodes } from '../types/constants.js'

// 记录每个 token 的上次更新时间，用于 1 分钟防抖
const lastUseUpdateCache = new Map<number, number>()

function updateLastUseTimeDebounced(tokenId: number): void {
  const now = Date.now()
  const last = lastUseUpdateCache.get(tokenId) ?? 0
  if (now - last < 60_000) return
  lastUseUpdateCache.set(tokenId, now)
  // 异步更新，不阻塞请求
  apiTokenDb
    .updateApiToken(tokenId, { lastUseTime: new Date() })
    .catch(() => {})
}

export interface AuthRequest extends Request {
  user: {
    userId: number
    tenantId: number
  }
}

/**
 * JWT authentication middleware
 * Validates the JWT token in the Authorization header.
 * Also supports API Token authentication (any non-JWT token string).
 * When using API Token, permission is checked against req.path (relative to /api).
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    tokenEmpty(res, 'No authentication token provided')
    return
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  // Try JWT first
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: number
      tenantId: number
    }
    ;(req as AuthRequest).user = {
      userId: Number(decoded.userId),
      tenantId: Number(decoded.tenantId),
    }
    next()
    return
  } catch (jwtError) {
    if (jwtError instanceof jwt.TokenExpiredError) {
      loginRequired(res, 'Authentication token has expired')
      return
    }
    // Not a valid JWT — fall through to API Token check
  }

  // Try API Token lookup
  try {
    const apiToken = await apiTokenDb.findApiTokenByToken(token)
    if (!apiToken) {
      loginRequired(res, 'Invalid authentication token')
      return
    }
    if (apiToken.expire < new Date()) {
      loginRequired(res, 'Authentication token has expired')
      return
    }

    // Permission check: derive required permission from request path
    const permissions = apiToken.permissions
      ? apiToken.permissions
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : []

    if (permissions.length > 0) {
      // '*' grants all permissions
      const hasAll = permissions.includes('*')
      if (!hasAll) {
        const requiredPermission = req.path.replace(/^\//, '')
        if (requiredPermission && !permissions.includes(requiredPermission)) {
          permitDenied(
            res,
            `API Token does not have permission for: ${requiredPermission}`
          )
          return
        }
      }
    }

    ;(req as AuthRequest).user = {
      userId: Number(apiToken.userId),
      tenantId: Number(apiToken.tenantId),
    }
    updateLastUseTimeDebounced(apiToken.id)
    next()
  } catch {
    loginRequired(res, 'Invalid authentication token')
  }
}

/**
 * Middleware that blocks the route when the server is configured in web-component mode.
 * Apply to endpoints that are disabled in embedded (viewMode='webComponent') deployments.
 */
export const webComponentDisabledMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (config.viewMode === 'webComponent') {
    const { t } = useI18n(req)
    error(
      res,
      ResponseCodes.DEFAULT_ERROR,
      t('featureUnavailableInWebComponent')
    )
    return
  }
  next()
}

/**
 * Middleware that restricts the route to the supervisor account only.
 * Condition: auth.type === 'user' AND req.user.userId === supervisorUserId AND req.user.tenantId === supervisorTenantId
 */
export const supervisorMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthRequest
  const userId = authReq.user.userId
  const tenantId = authReq.user.tenantId
  if (isSupervisor(userId, tenantId)) {
    next()
  } else {
    const { t } = useI18n(req)
    permitDenied(res, t('adminPermissionRequired'))
  }
}
