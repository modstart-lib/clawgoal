/**
 * Test-only Chat API — synchronous HTTP endpoints for agent testing.
 * Only active when AUTO_TEST_MODE=1. Bypasses WebSocket to enable
 * direct HTTP testing of agent role conversation and workflow paths.
 *
 * Routes:
 *   POST /claw/mock/chat        — send a message to an agent (mock LLM)
 *   POST /claw/mock/testAgent   — send a message to an agent by roleName (real LLM)
 */

import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { apiHandler } from '../../../../backend/src/utils/api'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { error, success } from '../../../../backend/src/utils/response'
import { agentManager } from '../../agent/index.js'
import { clawMessage } from '../../types/index.js'
import { runAgentMessage } from '../../kernel/agent.js'
import { createLogger } from '../../kernel/logger.js'
import { createNewSession } from '../../storage/sessionManager.js'
import type { AgentContext } from '../../../../backend/src/model/types.js'
import { clawDb } from '../../storage/store/index.js'
import { useI18n } from '../../locale/index.js'

const router: Router = Router()
const logger = createLogger('mock-chat')

/** 将 HTTP(S) 图片 URL 下载并转为 base64，供不支持 URL 的模型使用 */
async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mimeType: string }> {
  const resp = await fetch(url)
  if (!resp.ok)
    throw new Error(`fetch image failed: HTTP ${resp.status} ${url}`)
  const mimeType = (resp.headers.get('content-type') ?? 'image/jpeg')
    .split(';')[0]
    .trim()
  const buffer = await resp.arrayBuffer()
  const data = Buffer.from(buffer).toString('base64')
  return { data, mimeType }
}

/**
 * @Api /api/claw/mock/chat
 * @Summary Test-only: send message to agent synchronously (AUTO_TEST_MODE=1 required)
 * @BodyParam agentId number Agent ID
 * @BodyParam text string User message text
 * @BodyParam sessionId? number Existing session ID (auto-created if omitted)
 * @BodyParam pipelineKey? string Run named pipeline directly, bypassing intent router
 * @ReturnDataExample {"reply":"[mock response]","sessionId":1}
 */
router.post(
  '/claw/mock/chat',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    if (process.env.AUTO_TEST_MODE !== '1') {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.mockTestOnlyAvailable')
      )
    }

    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const {
      agentId,
      text,
      sessionId: rawSessionId,
      pipelineKey,
    } = req.body ?? {}

    const agentIdNum = parseInt(String(agentId ?? 0), 10)
    if (!agentIdNum)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.mockAgentIdRequired')
      )
    if (!text || !String(text).trim())
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mockTextRequired'))

    const agent = agentManager.get(agentIdNum)
    if (!agent)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.mockAgentNotFound') + `: ${agentIdNum}`
      )

    const sessionId = rawSessionId
      ? parseInt(String(rawSessionId), 10)
      : createNewSession(tenantId, userId, agentIdNum, 0)

    const agentContext: AgentContext = {
      tenantId,
      userId,
      agentId: agentIdNum,
      sessionId,
      logger,
    }

    const content = clawMessage.text(String(text).trim())

    const reply = await runAgentMessage(agent, agentContext, content, {
      chatId: 0,
      sessionId,
      pipelineKey: pipelineKey ? String(pipelineKey) : undefined,
    })

    return success(res, { reply, sessionId })
  })
)

/**
 * @Api /api/claw/mock/testAgent
 * @Summary Test-only: run a real LLM conversation by roleName (AUTO_TEST_MODE=1 required)
 * @BodyParam roleName string Agent role name (writer/programer/researcher/sparkCatcher/supervisor)
 * @BodyParam text string User message text
 * @BodyParam imageUrl? string Image URL to send alongside the text (triggers image message type)
 * @BodyParam pipelineKey? string Run named pipeline directly, bypassing intent router
 * @BodyParam sessionId? number Existing session ID (auto-created if omitted)
 * @ReturnDataExample {"reply":"...","sessionId":1,"steps":{"workflow":null,"nodes":[],"rawMessages":[]}}
 */
router.post(
  '/claw/mock/testAgent',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    if (process.env.AUTO_TEST_MODE !== '1') {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.mockTestOnlyAvailable')
      )
    }

    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const {
      roleName,
      text,
      imageUrl,
      pipelineKey,
      sessionId: rawSessionId,
    } = req.body ?? {}

    if (!roleName || !String(roleName).trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.mockRoleNameRequired')
      )
    if (!text || !String(text).trim())
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mockTextRequired'))

    const agent = agentManager
      .listAll()
      .find((a) => a.roleName === String(roleName).trim())
    if (!agent)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.mockAgentByRoleNotFound') + `: ${roleName}`
      )

    const agentId = Number(agent.id)
    const sessionId = rawSessionId
      ? parseInt(String(rawSessionId), 10)
      : createNewSession(tenantId, userId, agentId, 0)

    const agentContext: AgentContext = {
      tenantId,
      userId,
      agentId,
      sessionId,
      logger,
    }
    let content
    if (imageUrl) {
      const imgUrl = String(imageUrl).trim()
      try {
        const { data, mimeType } = await fetchImageAsBase64(imgUrl)
        content = clawMessage.image({
          data,
          mimeType,
          caption: String(text).trim(),
        })
      } catch {
        content = clawMessage.image({
          url: imgUrl,
          caption: String(text).trim(),
        })
      }
    } else {
      content = clawMessage.text(String(text).trim())
    }
    const startedAt = Date.now()
    logger.info(
      `${'▶'.repeat(60)} [TEST] roleName=${roleName}  sessionId=${sessionId}  text="${String(text).trim().slice(0, 60)}"${imageUrl ? `  imageUrl=${String(imageUrl).trim().slice(0, 80)}` : ''}`
    )

    const reply = await runAgentMessage(agent, agentContext, content, {
      chatId: 0,
      sessionId,
      pipelineKey: pipelineKey ? String(pipelineKey) : undefined,
    })

    const durationMs = Date.now() - startedAt

    // ─── Collect execution steps from DB for test visibility ──────────────
    const steps = collectSteps(tenantId, userId, agentId, sessionId, durationMs)

    return success(res, { reply, sessionId, steps })
  })
)

/** Count visible (human + AI-text) messages in a raw message array. */
function countVisibleRaw(msgs: any[]): number {
  return msgs.filter((m) => {
    if (m.type === 'human') return true
    if (m.type === 'ai') {
      const hasCalls = Array.isArray(m.tool_calls) && m.tool_calls.length > 0
      const text = typeof m.content === 'string' ? m.content.trim() : ''
      // 仅计入纯文本 AI 消息（与 renderNodeMessages 客户端显示逻辑保持一致）
      return !hasCalls && !!text
    }
    return false
  }).length
}

/** Collect workflow execution steps from DB after a run. */
function collectSteps(
  tenantId: number,
  userId: number,
  agentId: number,
  sessionId: number,
  durationMs: number
): Record<string, unknown> {
  const steps: Record<string, unknown> = {
    workflow: null,
    nodes: [],
    rawMessages: [],
  }
  try {
    const workflows = clawDb.listAgentWorkflows(
      tenantId,
      userId,
      agentId,
      sessionId,
      1
    )
    const wf = workflows[0]
    if (wf) {
      const wfState = (() => {
        try {
          return JSON.parse(wf.state)
        } catch {
          return {}
        }
      })()
      const wfDuration =
        wf.end_at && wf.start_at
          ? new Date(wf.end_at).getTime() - new Date(wf.start_at).getTime()
          : durationMs
      steps.workflow = {
        id: wf.id,
        pipeline: wfState.pipeline ?? '',
        status: wf.status,
        durationMs: wfDuration,
      }
      const nodeRows = clawDb.listAgentWorkflowNodes(wf.id)
      steps.nodes = nodeRows.map((n) => {
        const ns = (() => {
          try {
            return JSON.parse(n.state)
          } catch {
            return {}
          }
        })()
        const nd =
          n.end_at && n.start_at
            ? new Date(n.end_at).getTime() - new Date(n.start_at).getTime()
            : null
        return {
          nodeId: ns.nodeId ?? '',
          nodeType: ns.nodeType ?? '',
          nodeTitle: ns.nodeTitle ?? '',
          status: n.status,
          durationMs: nd,
          model: ns.model ?? '',
          tools: Array.isArray(ns.tools) ? ns.tools : [],
        }
      })
    }
    const rawRows = clawDb.listAgentMessageRawBySession(sessionId, 200)
    steps.rawMessages = rawRows.map((r) => {
      try {
        return JSON.parse(r.message)
      } catch {
        return { raw: r.message }
      }
    })
    try {
      const audits = clawDb.listAgentAudits(tenantId, userId)
      const recentAudit = audits.find((a) => a.session_id === sessionId)
      if (recentAudit)
        steps.recentAudit = { id: recentAudit.id, status: recentAudit.status }
    } catch {
      /* ignore */
    }
  } catch (e) {
    logger.warn(`collectSteps: ${String(e)}`)
  }
  return steps
}

export default router
