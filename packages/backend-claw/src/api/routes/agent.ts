/**
 * Agent API — HTTP routes wrapping AgentManager methods.
 *
 * Routes:
 *   POST /agent/roles/list           — list all available role names
 *   POST /agent/roles/detail         — get a single role config     (body: { roleName })
 *   POST /agent/list                 — list all agents
 *   POST /agent/active-list          — list active agents only
 *   POST /agent/add                  — create a agent              (body: { name, roleName })
 *   POST /agent/detail               — get a agent by id           (body: { id })
 *   POST /agent/set-active           — toggle agent active flag    (body: { id, active })
 *   POST /agent/remove               — remove a agent              (body: { id })
 *   POST /agent/update-basic         — update title/desc/avatar/channelIds/webhookEnable/webhookToken (body: { id, ... })
 *   POST /agent/status               — human-readable agent status
 */
// Note: webhook endpoint moved to hook.ts → GET/POST /hook/claw/agent/say/:token

import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import { agentManager } from '../../agent'
import { resolveAvatar } from '../../assets/avatar.js'
import { resolveRoleLocale, resolveT } from '../../agent/locale/index.js'
import { getLocale, useI18n } from '../../locale/index.js'

const router: Router = Router()

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/agent/role/list
 * @Summary List agent role
 * @ReturnDataExample [{"name":"writer","title":"Writer","description":""}]
 */
router.post(
  '/claw/agent/role/list',
  apiHandler(async (req, res) => {
    const locale = getLocale(req)
    const roles = agentManager.listRoles().map((r) => ({
      ...r,
      title: resolveT(r.title, locale),
    }))
    return success(res, roles)
  })
)

/**
 * @Api /api/claw/agent/role/detail
 * @Summary Get detail agent role
 * @BodyParam roleName string Role name
 * @ReturnDataExample {"name":"writer","title":"Writer","description":"","avatar":""}
 */
router.post(
  '/claw/agent/role/detail',
  apiHandler(async (req, res) => {
    const { roleName } = req.body
    const { t } = useI18n(req)
    if (!roleName) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentRoleNameRequired')
      )
    }
    const role = agentManager.getRole(roleName)
    if (!role) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        `${t('claw.agentRoleNameRequired')}: ${roleName}`
      )
    }
    // 返回前解析 avatar（system:xxx → data URI）并动态解析 T() 多语言占位符
    const locale = getLocale(req)
    return success(res, {
      ...resolveRoleLocale(role, locale),
      avatar: resolveAvatar(role.avatar ?? null),
    })
  })
)

// ─── Agents ─────────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/agent/list
 * @Summary List agent
 * @BodyParam projectId? number Filter by project ID
 * @ReturnDataExample [{"id":1,"name":"agent1","title":"My Agent","active":true}]
 */
router.post(
  '/claw/agent/list',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const locale = getLocale(req)
    const projectId = req.body.projectId
      ? Number(req.body.projectId)
      : undefined
    let agents = agentManager.getAllByUser(userId)
    if (projectId != null) {
      agents = agents.filter((a) => a.projectId === projectId)
    }
    return success(
      res,
      agents.map((a) => ({ ...a, config: resolveRoleLocale(a.config, locale) }))
    )
  })
)

/**
 * @Api /api/claw/agent/activeList
 * @Summary List active agent
 * @ReturnDataExample [{"id":1,"name":"agent1","title":"My Agent","active":true}]
 */
router.post(
  '/claw/agent/activeList',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const locale = getLocale(req)
    const agents = agentManager.getActiveByUser(userId).map((a) => ({
      ...a,
      config: resolveRoleLocale(a.config, locale),
    }))
    return success(res, agents)
  })
)

/**
 * @Api /api/claw/agent/detail
 * @Summary Get detail agent
 * @BodyParam id number Agent ID
 * @ReturnDataExample {"id":1,"name":"agent1","title":"My Agent","roleName":"writer"}
 */
router.post(
  '/claw/agent/detail',
  apiHandler(async (req, res) => {
    const id = Number(req.body.id)
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    const agent = agentManager.get(id)
    if (!agent) {
      return error(res, ResponseCodes.DEFAULT_ERROR, `Agent "${id}" not found`)
    }
    const locale = getLocale(req)
    return success(res, {
      ...agent,
      config: resolveRoleLocale(agent.config, locale),
    })
  })
)

/**
 * @Api /api/claw/agent/add
 * @Summary Add agent
 * @BodyParam name string Unique agent name
 * @BodyParam roleName string Role name to assign
 * @BodyParam enable boolean? Enable on creation
 * @BodyParam avatar string? Avatar URL or system:xxx
 * @BodyParam avatarConfig object? 3D character config (CharacterConfig)
 * @BodyParam overrides object? Config overrides
 * @BodyParam param object? 角色参数初始值（对象）
 * @BodyParam projectId number 所属项目 ID（必填）
 * @ReturnDataExample {"id":1,"name":"agent1","title":"My Agent"}
 */
router.post(
  '/claw/agent/add',
  apiHandler(async (req, res) => {
    const {
      name,
      roleName,
      enable,
      avatar,
      avatarConfig,
      overrides,
      param,
      projectId,
    } = req.body
    const { t } = useI18n(req)
    if (!name || !roleName) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentNameRoleRequired')
      )
    }
    if (!projectId) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentProjectRequired')
      )
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const agent = await agentManager.create({
      tenantId,
      userId,
      name,
      roleName,
      enable,
      avatar,
      avatarConfig,
      overrides,
      projectId: Number(projectId),
      param:
        param && typeof param === 'object' && !Array.isArray(param)
          ? param
          : undefined,
    })
    return success(res, agent, t('claw.agentCreated'))
  })
)

/**
 * @Api /api/claw/agent/setActive
 * @Summary Set active state agent
 * @BodyParam id number Agent ID
 * @BodyParam active boolean Set active state
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/agent/setActive',
  apiHandler(async (req, res) => {
    const id = Number(req.body.id)
    const { active } = req.body
    const { t } = useI18n(req)
    if (!id || active === undefined) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentIdActiveRequired')
      )
    }
    const agent = agentManager.get(id)
    if (!agent) {
      return error(res, ResponseCodes.DEFAULT_ERROR, `Agent "${id}" not found`)
    }
    agentManager.setActive(id, !!active)
    return success(res, null, t('claw.agentStatusUpdated'))
  })
)

/**
 * @Api /api/claw/agent/remove
 * @Summary Remove agent
 * @BodyParam id number Agent ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/agent/remove',
  apiHandler(async (req, res) => {
    const id = Number(req.body.id)
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    let removed: boolean
    try {
      removed = agentManager.remove(id)
    } catch (err) {
      if (err instanceof Error && err.message === 'SUPERVISOR_CANNOT_DELETE') {
        return error(
          res,
          ResponseCodes.DEFAULT_ERROR,
          t('claw.agentSystemCannotDelete')
        )
      }
      const msg = err instanceof Error ? err.message : t('claw.deleteFailed')
      return error(res, ResponseCodes.DEFAULT_ERROR, msg)
    }
    if (!removed) {
      return error(res, ResponseCodes.DEFAULT_ERROR, `Agent "${id}" not found`)
    }
    return success(res, null, t('claw.agentRemoved'))
  })
)

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/agent/updateBasic
 * @Summary Update basic info agent
 * @BodyParam id number Agent ID
 * @BodyParam title string? Display title
 * @BodyParam description string? Description
 * @BodyParam avatar string? Avatar URL
 * @BodyParam avatarConfig object? 3D character config (CharacterConfig)
 * @BodyParam channelIds number[]? Assigned channel IDs
 * @BodyParam webhookEnable boolean? Enable webhook
 * @BodyParam webhookToken string? Webhook token
 * @BodyParam projectId number? 所属项目 ID
 * @ReturnDataExample {"id":1,"title":"Updated Agent"}
 */
router.post(
  '/claw/agent/updateBasic',
  apiHandler(async (req, res) => {
    const {
      title,
      description,
      avatar,
      avatarConfig,
      channelIds,
      webhookEnable,
      webhookToken,
      projectId,
    } = req.body
    const id = Number(req.body.id)
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    try {
      const patch: Parameters<typeof agentManager.updateBasic>[1] = {}
      if (title !== undefined) patch.title = title
      if (description !== undefined) patch.description = description
      if (avatar !== undefined) patch.avatar = avatar
      if (avatarConfig !== undefined) patch.avatarConfig = avatarConfig
      if (channelIds !== undefined) patch.channelIds = channelIds
      if (webhookEnable !== undefined) patch.webhookEnable = webhookEnable
      if (webhookToken !== undefined) patch.webhookToken = webhookToken
      if ('projectId' in req.body)
        patch.projectId = projectId != null ? Number(projectId) : null
      const agent = agentManager.updateBasic(id, patch)
      return success(res, agent, t('claw.agentBasicUpdated'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed'
      return error(res, ResponseCodes.DEFAULT_ERROR, msg)
    }
  })
)

/**
 * @Api /api/claw/agent/updateConfig
 * @Summary Update config agent
 * @BodyParam id number Agent ID
 * @BodyParam overrides object Config overrides object
 * @ReturnDataExample {"id":1,"name":"agent1"}
 */
router.post(
  '/claw/agent/updateConfig',
  apiHandler(async (req, res) => {
    const id = Number(req.body.id)
    const { overrides } = req.body
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    if (!overrides || typeof overrides !== 'object') {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentIdOverridesRequired')
      )
    }
    try {
      const agent = agentManager.updateConfig(id, overrides)
      return success(res, agent, t('claw.agentConfigUpdated'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed'
      return error(res, ResponseCodes.DEFAULT_ERROR, msg)
    }
  })
)

/**
 * @Api /api/claw/agent/updateParam
 * @Summary Update params agent
 * @BodyParam id number Agent ID
 * @BodyParam param object 用户为该 Agent 填写的 param 值（对象）
 * @ReturnDataExample {"id":1,"param":{"workspace":"/home/user/project"}}
 */
router.post(
  '/claw/agent/updateParam',
  apiHandler(async (req, res) => {
    const id = Number(req.body.id)
    const { param } = req.body
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    if (!param || typeof param !== 'object' || Array.isArray(param)) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentParamMustBeObject')
      )
    }
    try {
      const agent = agentManager.updateParam(
        id,
        param as Record<string, unknown>
      )
      return success(res, agent, t('claw.agentParamUpdated'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed'
      return error(res, ResponseCodes.DEFAULT_ERROR, msg)
    }
  })
)

/**
 * @Api /api/claw/agent/status
 * @Summary Status
 * @ReturnDataExample {"status":"1 agent running, 0 stopped"}
 */
router.post(
  '/claw/agent/status',
  apiHandler(async (_req, res) => {
    const status = agentManager.status()
    return success(res, { status })
  })
)

/**
 * Get the role config (default values) for the role assigned to a agent.
 * Useful for populating a "reset from role" form.
 */
/**
 * @Api /api/claw/agent/roleConfig
 * @Summary Get role config agent
 * @BodyParam id number Agent ID
 * @ReturnDataExample {"name":"writer","title":"Writer","description":""}
 */
router.post(
  '/claw/agent/roleConfig',
  apiHandler(async (req, res) => {
    const id = Number(req.body.id)
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    const agent = agentManager.get(id)
    if (!agent) {
      return error(res, ResponseCodes.DEFAULT_ERROR, `Agent "${id}" not found`)
    }
    const role = agentManager.getRole(agent.roleName)
    if (!role) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        `Role "${agent.roleName}" not found`
      )
    }
    const locale = getLocale(req)
    return success(res, {
      ...resolveRoleLocale(role, locale),
      avatar: resolveAvatar(role.avatar ?? null),
    })
  })
)

export default router
