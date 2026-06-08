import { Router } from 'express'
import {
  clearUserLangCache,
  PARAM_KEY_LANG,
  useI18n,
} from '../../locale/index.js'
import { paramDb } from '../../storage/store/userParam.js'
import { apiHandler } from '../../utils/api.js'
import { jsonParse, jsonStringify } from '../../utils/json.js'
import { getParam, setParam, deleteParam } from '../../utils/userParam.js'
import { error, success } from '../../utils/response.js'
import type { AuthRequest } from '../middlewares/auth.js'
import { supervisorMiddleware } from '../middlewares/auth.js'
import { ResponseCodes } from '../types/constants.js'

const ENV_PREFIX = 'Env.'

const router = Router()

/**
 * @Api /api/userParam/get
 * @Summary Get user param
 * @BodyParam name string Parameter key name
 * @BodyParam defaultValue string Optional default value
 * @ReturnDataExample {"name":"someKey","value":"someValue"}
 */
router.post(
  '/userParam/get',
  apiHandler(async (req, res) => {
    const { name, defaultValue } = req.body as {
      name?: string
      defaultValue?: string
    }
    const { t } = useI18n(req)
    if (!name) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const value = await getParam(tenantId, userId, name, defaultValue ?? '')
    return success(res, { name, value })
  })
)

/**
 * @Api /api/userParam/set
 * @Summary Set user param
 * @BodyParam name string Parameter key name
 * @BodyParam value string Parameter value
 * @ReturnDataExample {"name":"someKey","value":"someValue"}
 */
router.post(
  '/userParam/set',
  apiHandler(async (req, res) => {
    const { name, value, scope, remark } = req.body as {
      name?: string
      value?: string
      scope?: string
      remark?: string
    }
    const { t } = useI18n(req)
    if (!name) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    if (value === undefined || value === null) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('optionValueRequired'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    await setParam(tenantId, userId, name, value, scope, remark)
    if (name === PARAM_KEY_LANG) clearUserLangCache(tenantId, userId)
    return success(res, { name, value })
  })
)

/**
 * @Api /api/userParam/getJson
 * @Summary Get JSON user param
 * @BodyParam name string Parameter key name
 * @BodyParam defaultValue any Optional default value (object/array)
 * @ReturnDataExample {"name":"someKey","value":["/usr/local/bin"]}
 */
router.post(
  '/userParam/getJson',
  apiHandler(async (req, res) => {
    const { name, defaultValue } = req.body as {
      name?: string
      defaultValue?: unknown
    }
    const { t } = useI18n(req)
    if (!name) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const raw = await getParam(tenantId, userId, name, '')
    let value: unknown = defaultValue ?? null
    if (raw) {
      try {
        value = jsonParse(raw)
      } catch {
        value = defaultValue ?? null
      }
    }
    return success(res, { name, value })
  })
)

/**
 * @Api /api/userParam/setJson
 * @Summary Set JSON user param
 * @BodyParam name string Parameter key name
 * @BodyParam value any JSON-serializable value (object/array)
 * @ReturnDataExample {"name":"someKey","value":["/usr/local/bin"]}
 */
router.post(
  '/userParam/setJson',
  apiHandler(async (req, res) => {
    const { name, value, scope, remark } = req.body as {
      name?: string
      value?: unknown
      scope?: string
      remark?: string
    }
    const { t } = useI18n(req)
    if (!name) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    if (value === undefined || value === null) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('optionValueRequired'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    await setParam(tenantId, userId, name, jsonStringify(value), scope, remark)
    return success(res, { name, value })
  })
)

/**
 * @Api /api/userParam/batchGet
 * @Summary Batch get user param
 * @BodyParam items Array<{name: string, defaultValue?: string}> List of parameters to get
 * @ReturnDataExample {"values":{"key1":"val1","key2":"val2"}}
 */
router.post(
  '/userParam/batchGet',
  apiHandler(async (req, res) => {
    const { items } = req.body as {
      items?: Array<{ name: string; defaultValue?: string }>
    }
    const { t } = useI18n(req)
    if (!Array.isArray(items) || items.length === 0) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const values: Record<string, string> = {}
    for (const item of items) {
      if (item.name) {
        values[item.name] = await getParam(
          tenantId,
          userId,
          item.name,
          item.defaultValue ?? ''
        )
      }
    }
    return success(res, { values })
  })
)

/**
 * @Api /api/userParam/batchSet
 * @Summary Batch set user param
 * @BodyParam items Array<{name: string, value: string}> List of parameters to set
 * @ReturnDataExample {}
 */
router.post(
  '/userParam/batchSet',
  apiHandler(async (req, res) => {
    const { items } = req.body as {
      items?: Array<{
        name: string
        value: string
        scope?: string
        remark?: string
      }>
    }
    const { t } = useI18n(req)
    if (!Array.isArray(items) || items.length === 0) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    for (const item of items) {
      if (item.name && item.value !== undefined && item.value !== null) {
        await setParam(
          tenantId,
          userId,
          item.name,
          item.value,
          item.scope,
          item.remark
        )
        if (item.name === PARAM_KEY_LANG) clearUserLangCache(tenantId, userId)
      }
    }
    return success(res, {})
  })
)

// ─── Env 变量管理（以 Env. 为前缀存储在 user_param 表中）─────────────────────

/**
 * @Api /api/userParam/env/list
 * @Summary List all env variables (stored as Env.* in user_param)
 * @ReturnDataExample {"envs":[{"name":"API_KEY","value":"sk-..."}]}
 */
router.post(
  '/userParam/env/list',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const rows = await paramDb.listByPrefix(tenantId, userId, ENV_PREFIX)
    return success(res, {
      envs: rows.map((r) => ({
        name: r.name.startsWith(ENV_PREFIX)
          ? r.name.slice(ENV_PREFIX.length)
          : r.name,
        value: r.value,
      })),
    })
  })
)

/**
 * @Api /api/userParam/env/set
 * @Summary Add or update an env variable
 * @BodyParam name string Env variable name (without Env. prefix)
 * @BodyParam value string Env variable value
 * @ReturnDataExample {"name":"API_KEY","value":"sk-..."}
 */
router.post(
  '/userParam/env/set',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { name, value } = req.body as { name?: string; value?: string }
    const { t } = useI18n(req)
    if (!name || !name.trim()) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('envNameRequired'))
    }
    if (value === undefined || value === null) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('envValueRequired'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    await setParam(
      tenantId,
      userId,
      `${ENV_PREFIX}${name.trim()}`,
      String(value),
      'env'
    )
    return success(res, { name: name.trim(), value: String(value) })
  })
)

/**
 * @Api /api/userParam/env/delete
 * @Summary Delete an env variable
 * @BodyParam name string Env variable name (without Env. prefix)
 * @ReturnDataExample null
 */
router.post(
  '/userParam/env/delete',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { name } = req.body as { name?: string }
    const { t } = useI18n(req)
    if (!name || !name.trim()) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('envNameRequired'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const paramName = `${ENV_PREFIX}${name.trim()}`
    const existing = await paramDb.getParam(tenantId, userId, paramName)
    if (existing === null) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('envNotFound'))
    }
    await deleteParam(tenantId, userId, paramName)
    return success(res, null, t('envDeleted'))
  })
)

export default router
