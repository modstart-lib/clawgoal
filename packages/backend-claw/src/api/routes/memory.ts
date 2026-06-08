/**
 * Memory API routes
 *
 * POST /memory/global/get       — 获取当前用户的全局记忆 Prompt（跨 Agent 共享）
 * POST /memory/global/set       — 设置全局记忆 (body: { content })
 * POST /memory/user/get         — 获取当前用户的「关于我」描述
 * POST /memory/user/set         — 设置当前用户的「关于我」描述 (body: { content })
 * POST /memory/agent/get        — 获取指定 Agent 的私有记忆 (body: { agentId })
 * POST /memory/agent/set        — 设置指定 Agent 的私有记忆 (body: { agentId, content })
 * POST /memory/agent/soul/get   — 获取指定 Agent 的 Soul 定义 (body: { agentId })
 * POST /memory/agent/soul/set   — 设置指定 Agent 的 Soul 定义 (body: { agentId, content })
 */

import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { apiHandler } from '../../../../backend/src/utils/api'
import { success } from '../../../../backend/src/utils/response'
import {
  getMemory,
  getUser,
  setMemory,
  setUser,
  getSoul,
  setSoul,
} from '../../memory/index.js'

const router: Router = Router()

/**
 * @Api /api/claw/memory/global/get
 * @Summary Get memory global
 * @ReturnDataExample {"content":"Global memory markdown"}
 */
router.post(
  '/claw/memory/global/get',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const content = await getMemory(tenantId, userId)
    return success(res, { content })
  })
)

/**
 * @Api /api/claw/memory/global/set
 * @Summary Set memory global
 * @BodyParam content string Global memory content
 */
router.post(
  '/claw/memory/global/set',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { content = '' } = req.body
    await setMemory(tenantId, userId, content)
    return success(res)
  })
)

/**
 * @Api /api/claw/memory/user/get
 * @Summary Get memory user
 * @ReturnDataExample {"content":"About me text"}
 */
router.post(
  '/claw/memory/user/get',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const content = await getUser(tenantId, userId)
    return success(res, { content })
  })
)

/**
 * @Api /api/claw/memory/user/set
 * @Summary Set memory user
 * @BodyParam content string User memory content
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/memory/user/set',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { content = '' } = req.body
    await setUser(tenantId, userId, content)
    return success(res)
  })
)

/**
 * @Api /api/claw/memory/agent/get
 * @Summary Get memory agent
 * @BodyParam agentId string Agent ID
 * @ReturnDataExample {"content":"Agent memory markdown"}
 */
router.post(
  '/claw/memory/agent/get',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { agentId } = req.body
    const content = await getMemory(tenantId, userId, String(agentId))
    return success(res, { content })
  })
)

/**
 * @Api /api/claw/memory/agent/set
 * @Summary Set memory agent
 * @BodyParam agentId string Agent ID
 * @BodyParam content string Agent memory content
 */
router.post(
  '/claw/memory/agent/set',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { agentId, content = '' } = req.body
    await setMemory(tenantId, userId, content, String(agentId))
    return success(res)
  })
)

/**
 * @Api /api/claw/memory/agent/soul/get
 * @Summary Get memory agent soul
 * @BodyParam agentId string Agent ID
 * @ReturnDataExample {"content":"Agent soul markdown"}
 */
router.post(
  '/claw/memory/agent/soul/get',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { agentId } = req.body
    const content = await getSoul(tenantId, userId, String(agentId))
    return success(res, { content })
  })
)

/**
 * @Api /api/claw/memory/agent/soul/set
 * @Summary Set memory agent soul
 * @BodyParam agentId string Agent ID
 * @BodyParam content string Agent soul content
 */
router.post(
  '/claw/memory/agent/soul/set',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const { agentId, content = '' } = req.body
    await setSoul(tenantId, userId, content, String(agentId))
    return success(res)
  })
)

export default router
