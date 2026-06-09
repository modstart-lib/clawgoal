/**
 * Authentication-related API routes
 */
import { Request, Response, Router } from 'express'
import { config } from '../../config'
import { eventBus } from '../../event/eventBus'
import { useI18n } from '../../locale'
import { apiHandler } from '../../utils/api'
import { createToken, refreshToken } from '../../utils/auth'
import { error, success } from '../../utils/response'
import { userDb } from '../../storage/sqlite/store/user'
import { AuthRequest, authMiddleware } from '../middlewares/auth'
import { ResponseCodes } from '../types/constants'
import { consumeVerifiedCaptcha } from './captcha'

const router = Router()

// 登录失败延迟：第5次起依次锁定 30s / 1min / 2min / 4min / 8min
const LOGIN_DELAY_STEPS = [30, 60, 120, 240, 480]
interface LoginAttempt {
  failCount: number
  lockedUntil: number
}
const loginAttempts = new Map<string, LoginAttempt>()

function getLoginDelaySeconds(failCount: number): number {
  if (failCount < 5) return 0
  const idx = Math.min(failCount - 5, LOGIN_DELAY_STEPS.length - 1)
  return LOGIN_DELAY_STEPS[idx]
}

function formatWaitTime(locale: string, seconds: number): string {
  if (seconds < 60)
    return locale === 'zh-CN' ? `${seconds}秒` : `${seconds} seconds`
  const mins = Math.ceil(seconds / 60)
  return locale === 'zh-CN' ? `${mins}分钟` : `${mins} minutes`
}

/**
 * @Api /api/login
 * @Summary Login
 * @BodyParam username string
 * @BodyParam password string
 * @BodyParam captchaToken string
 * @ReturnDataExample {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","userId":1,"tenantId":1}
 */
router.post(
  '/login',
  apiHandler(async (req: Request, res: Response) => {
    const { t, locale } = useI18n(req)
    if (config.auth.type !== 'fixed' && config.auth.type !== 'database') {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('authLoginDisabled'))
    }

    const { username, password, captchaToken } = req.body

    // 检查登录锁定状态
    const attempt = loginAttempts.get(String(username)) ?? {
      failCount: 0,
      lockedUntil: 0,
    }
    if (attempt.lockedUntil > Date.now()) {
      const waitSeconds = Math.ceil((attempt.lockedUntil - Date.now()) / 1000)
      const waitStr = formatWaitTime(locale, waitSeconds)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('authTooManyAttempts').replace('%s', waitStr)
      )
    }

    const captchaOk =
      ((process.env.AUTO_TEST_MODE === '1' ||
        process.env.NODE_ENV === 'development') &&
        captchaToken === '__test_bypass__') ||
      (captchaToken && consumeVerifiedCaptcha(String(captchaToken)))
    if (!captchaOk) {
      return error(res, ResponseCodes.CAPTCHA_ERROR, t('captchaVerifyRequired'))
    }

    if (
      username === config.auth.username &&
      password === config.auth.password
    ) {
      loginAttempts.delete(String(username))
      const token = createToken(config.auth.userId, config.auth.tenantId)
      eventBus.emit('login:success', {
        userId: Number(config.auth.userId),
        username,
        token,
      })
      return success(
        res,
        {
          token,
          userId: Number(config.auth.userId),
          tenantId: Number(config.auth.tenantId),
        },
        t('authLoginSuccess')
      )
    }

    // 回退到 user 表认证
    const userRecord = await userDb.findByUsername(String(username))
    if (userRecord && userDb.verifyUserPassword(userRecord, String(password))) {
      loginAttempts.delete(String(username))
      const token = createToken(userRecord.id, userRecord.tenantId)
      eventBus.emit('login:success', {
        userId: userRecord.id,
        username: userRecord.username,
        token,
      })
      return success(
        res,
        {
          token,
          userId: userRecord.id,
          tenantId: userRecord.tenantId,
        },
        t('authLoginSuccess')
      )
    }

    const newFailCount = attempt.failCount + 1
    const delaySeconds = getLoginDelaySeconds(newFailCount)
    loginAttempts.set(String(username), {
      failCount: newFailCount,
      lockedUntil: delaySeconds > 0 ? Date.now() + delaySeconds * 1000 : 0,
    })
    eventBus.emit('login:failure', { username, reason: 'invalid_credentials' })
    return error(res, ResponseCodes.DEFAULT_ERROR, t('authInvalidCredentials'))
  })
)

/**
 * @Api /api/login/auto
 * @Summary Auto login without credentials (only available when IS_CLIENT=1)
 * @ReturnDataExample {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","userId":1,"tenantId":1}
 */
router.post(
  '/login/auto',
  apiHandler(async (req: Request, res: Response) => {
    const { t } = useI18n(req)
    if (config.viewMode !== 'client') {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('authLoginDisabled'))
    }
    const token = createToken(config.auth.userId, config.auth.tenantId)
    return success(
      res,
      {
        token,
        userId: Number(config.auth.userId),
        tenantId: Number(config.auth.tenantId),
      },
      t('authLoginSuccess')
    )
  })
)

/**
 * @Api /api/login/refresh
 * @Summary Refresh token login
 * @ReturnDataExample {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","userId":1,"tenantId":1}
 */
router.post(
  '/login/refresh',
  authMiddleware,
  apiHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const { t } = useI18n(req)

    const newToken = refreshToken(authReq.user.userId, authReq.user.tenantId)

    return success(
      res,
      {
        token: newToken,
        userId: Number(authReq.user.userId),
        tenantId: Number(authReq.user.tenantId),
      },
      t('authTokenRefreshed')
    )
  })
)

export default router
