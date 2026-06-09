/**
 * Agent Session API — manage conversation sessions.
 *
 * Routes:
 *   POST /agentSession/list       — list sessions for an agent
 *   POST /agentSession/get        — get a single session by id
 *   POST /agentSession/add        — create a new session
 *   POST /agentSession/switch     — switch active session
 *   POST /agentSession/delete     — delete a session
 *   POST /agentSession/getData    — get session data
 *   POST /agentSession/updateData — update session data
 *   POST /agentSession/logUrl     — get tempFile URL for session log
 */

import path from 'path'
import fs from 'node:fs'
import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { apiHandler } from '../../../../backend/src/utils/api.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants.js'
import { error, success } from '../../../../backend/src/utils/response.js'
import { config } from '../../../../backend/src/config/index.js'
import { userTempFileFromFile } from '../../../../backend/src/utils/userTempFile.js'
import { clawDb } from '../../storage/store/index.js'
import {
  createNewSession,
  switchSession,
} from '../../storage/sessionManager.js'
import { useI18n } from '../../locale/index.js'

const router: Router = Router()

/**
 * @Api /api/claw/agentSession/list
 * @Summary List agent session
 * @BodyParam agentId number Agent ID
 * @BodyParam limit number Max results (default 50)
 * @BodyParam offset number Offset (default 0)
 * @ReturnDataExample [{"id":1,"agent_id":1,"title":"Chat Session","status":"active","created_at":"2026-01-01T00:00:00.000Z","updated_at":"2026-01-01T00:00:00.000Z"}]
 */
router.post(
  '/claw/agentSession/list',
  apiHandler(async (req, res) => {
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const { agentId, limit = 50, offset = 0 } = req.body ?? {}
    const agentIdNum = parseInt(String(agentId ?? 0), 10) || 0
    const sessions = clawDb.listChatSessions(
      tenantId,
      userId,
      agentIdNum,
      Math.min(Number(limit), 200),
      Number(offset)
    )
    return success(res, sessions)
  })
)

/**
 * @Api /api/claw/agentSession/get
 * @Summary Get agent session
 * @BodyParam id number Session ID
 * @ReturnDataExample {"id":1,"agent_id":1,"title":"Chat Session","status":"active","created_at":"2026-01-01T00:00:00.000Z","updated_at":"2026-01-01T00:00:00.000Z"}
 */
router.post(
  '/claw/agentSession/get',
  apiHandler(async (req, res) => {
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const { id } = req.body ?? {}
    const sessionId = parseInt(String(id ?? 0), 10)
    if (!sessionId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('paramRequired')
      )
    const row = clawDb.findChatSessionById(sessionId)
    if (!row || row.tenant_id !== tenantId || row.user_id !== userId) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('claw.sessionNotFound')
      )
    }
    return success(res, row)
  })
)

/**
 * @Api /api/claw/agentSession/add
 * @Summary Add agent session
 * @BodyParam agentId number Agent ID
 * @ReturnDataExample {"id":1}
 */
router.post(
  '/claw/agentSession/add',
  apiHandler(async (req, res) => {
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const { agentId } = req.body ?? {}
    const agentIdNum = parseInt(String(agentId ?? 0), 10) || 0
    const sessionId = createNewSession(tenantId, userId, agentIdNum, 0)
    return success(res, { id: sessionId })
  })
)

/**
 * @Api /api/claw/agentSession/switch
 * @Summary Switch agent session
 * @BodyParam agentId number Agent ID
 * @BodyParam sessionId number Target session ID
 * @ReturnDataExample {"id":1}
 */
router.post(
  '/claw/agentSession/switch',
  apiHandler(async (req, res) => {
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const { agentId, sessionId } = req.body ?? {}
    const agentIdNum = parseInt(String(agentId ?? 0), 10) || 0
    const sessionIdNum = parseInt(String(sessionId ?? 0), 10) || 0
    const ok = switchSession(tenantId, userId, agentIdNum, 0, sessionIdNum)
    if (!ok)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('claw.sessionNoAccess')
      )
    return success(res, { id: sessionIdNum })
  })
)

/**
 * @Api /api/claw/agentSession/delete
 * @Summary Remove agent session
 * @BodyParam id number Session ID
 * @ReturnDataExample null
 */
router.post(
  '/claw/agentSession/delete',
  apiHandler(async (req, res) => {
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const { id } = req.body ?? {}
    const sessionId = parseInt(String(id ?? 0), 10)
    if (!sessionId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('paramRequired')
      )
    const row = clawDb.findChatSessionById(sessionId)
    if (!row || row.tenant_id !== tenantId || row.user_id !== userId) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('claw.sessionNotFound')
      )
    }
    const ok = clawDb.deleteChatSession(sessionId)
    if (!ok)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('claw.deleteFailed')
      )
    // 同步删除 claw_agent_message 和 claw_agent_message_raw
    clawDb.deleteAgentMessagesBySession(sessionId)
    clawDb.deleteAgentMessageRawBySession(sessionId)
    return success(res, null)
  })
)

/**
 * @Api /api/claw/agentSession/getData
 * @Summary Get data agent session
 * @BodyParam id number Session ID
 * @ReturnDataExample {"data":{"key":"value"}}
 */
router.post(
  '/claw/agentSession/getData',
  apiHandler(async (req, res) => {
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const { id } = req.body ?? {}
    const sessionId = parseInt(String(id ?? 0), 10)
    if (!sessionId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('paramRequired')
      )
    const row = clawDb.findChatSessionById(sessionId)
    if (!row || row.tenant_id !== tenantId || row.user_id !== userId) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('claw.sessionNotFound')
      )
    }
    const data = clawDb.getSessionData(sessionId)
    return success(res, { data })
  })
)

/**
 * @Api /api/claw/agentSession/updateData
 * @Summary Update data agent session
 * @BodyParam id number Session ID
 * @BodyParam data object JSON data to store
 * @ReturnDataExample null
 */
router.post(
  '/claw/agentSession/updateData',
  apiHandler(async (req, res) => {
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const { id, data } = req.body ?? {}
    const sessionId = parseInt(String(id ?? 0), 10)
    if (!sessionId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('paramRequired')
      )
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('claw.sessionDataMustBeObject')
      )
    }
    const row = clawDb.findChatSessionById(sessionId)
    if (!row || row.tenant_id !== tenantId || row.user_id !== userId) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('claw.sessionNotFound')
      )
    }
    clawDb.updateSessionData(sessionId, data as Record<string, unknown>)
    return success(res, null)
  })
)

/**
 * @Api /api/claw/agentSession/logUrl
 * @Summary Get log URL agent session
 * @BodyParam agentId number Agent ID
 * @BodyParam sessionId number Session ID
 * @ReturnDataExample {"logUrl":"/api/user_temp_file/abc123.log"}
 */
router.post(
  '/claw/agentSession/logUrl',
  apiHandler(async (req, res) => {
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const { agentId, sessionId } = req.body ?? {}
    const agentIdNum = parseInt(String(agentId ?? 0), 10)
    const sessionIdNum = parseInt(String(sessionId ?? 0), 10)
    if (!agentIdNum || !sessionIdNum)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('paramRequired')
      )
    const session = clawDb.findChatSessionById(sessionIdNum)
    if (
      !session ||
      session.tenant_id !== tenantId ||
      session.user_id !== userId
    )
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        useI18n(req).t('claw.sessionNotFound')
      )
    const logFile = path.join(
      config.logPath,
      'agent',
      String(agentIdNum),
      `${sessionIdNum}.log`
    )
    if (!fs.existsSync(logFile)) return success(res, { logUrl: null })
    const pathKey = `alog${agentIdNum}s${sessionIdNum}`
    const logUrl = await userTempFileFromFile(logFile, 7 * 24 * 3600, pathKey)
    return success(res, { logUrl })
  })
)

export default router
