/**
 * AgentAudit API routes
 *
 * Routes:
 *   POST /claw/agentAudit/get      — 获取审核详情
 *   POST /claw/agentAudit/approve  — 批准代码变更
 *   POST /claw/agentAudit/reject   — 拒绝代码变更（附带评审意见）
 *   POST /claw/agentAudit/cancel   — 取消审核并终止整个工作流
 */
import { Router, type IRouter } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import { safeJsonParse } from '../../../../backend/src/utils/json.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import { clawDb } from '../../storage/store/index.js'
import { clawMessage } from '../../types/index.js'
import type { AgentAuditDiffContent } from '../../storage/store/agentAudit.js'
import { useI18n } from '../../locale/index.js'

const router: IRouter = Router()

/**
 * @Api /claw/agentAudit/get
 * @Summary Get audit record
 * @BodyParam auditId number Audit ID
 * @ReturnDataExample {"audit":{"id":1,"status":"pending","content":{"diffs":{},"summary":"..."}}}
 */
router.post(
  '/claw/agentAudit/get',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { auditId } = req.body
    const userId = (req as unknown as AuthRequest).user.userId

    if (!auditId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.auditIdRequired'))

    const audit = clawDb.findAgentAuditByIdAndUser(Number(auditId), userId)
    if (!audit)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.auditNotFound'))

    const content: AgentAuditDiffContent = safeJsonParse(
      audit.content,
      {} as AgentAuditDiffContent,
      'agentAudit.content'
    )

    return success(res, {
      audit: {
        id: audit.id,
        status: audit.status,
        type: audit.type,
        createdAt: audit.created_at,
        agentId: audit.agent_id,
        taskId: audit.task_id,
        sessionId: audit.session_id,
        content,
      },
    })
  })
)

/**
 * @Api /claw/agentAudit/approve
 * @Summary Approve code changes and resume workflow
 * @BodyParam auditId number Audit ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/agentAudit/approve',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { auditId } = req.body
    const userId = (req as unknown as AuthRequest).user.userId

    if (!auditId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.auditIdRequired'))

    const audit = clawDb.findAgentAuditByIdAndUser(Number(auditId), userId)
    if (!audit)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.auditNotFound'))
    if (audit.status !== 'pending')
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.auditAlreadyHandled')
      )

    clawDb.updateAgentAudit(Number(auditId), { status: 'approved' })

    // Resume the paused graph workflow via web message
    const { t: _t, locale: approveLocale } = useI18n(req)
    const isZhApprove = approveLocale !== 'en-US'
    clawEventBus.emit('message:incoming', {
      agentId: audit.agent_id,
      chatId: 0,
      content: clawMessage.text(
        isZhApprove
          ? '用户已批准代码变更，请执行合并和提交到主分支'
          : 'User has approved the code changes, please proceed with merge and commit to the main branch'
      ),
      userId,
      messageId: Date.now(),
      timestamp: new Date(),
      source: 'web',
      sessionId: audit.session_id,
      channelId: 0,
      taskId: audit.task_id || undefined,
    })

    return success(res, { success: true })
  })
)

/**
 * @Api /claw/agentAudit/reject
 * @Summary Reject code changes with review comments
 * @BodyParam auditId number Audit ID
 * @BodyParam comments Array<{file:string,text:string}> Inline file comments
 * @BodyParam rejectMessage string Overall rejection message
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/agentAudit/reject',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { auditId, comments = [], rejectMessage = '' } = req.body
    const userId = (req as unknown as AuthRequest).user.userId

    if (!auditId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.auditIdRequired'))

    const audit = clawDb.findAgentAuditByIdAndUser(Number(auditId), userId)
    if (!audit)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.auditNotFound'))
    if (audit.status !== 'pending')
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.auditAlreadyHandled')
      )

    const existingContent: AgentAuditDiffContent = safeJsonParse(
      audit.content,
      {} as AgentAuditDiffContent,
      'agentAudit.content'
    )
    const updatedContent: AgentAuditDiffContent = {
      ...existingContent,
      review: {
        comments: Array.isArray(comments) ? comments : [],
        rejectMessage: String(rejectMessage),
      },
    }

    clawDb.updateAgentAudit(Number(auditId), {
      status: 'rejected',
      content: updatedContent,
    })

    // Build rejection message with comments
    const { locale: rejectLocale } = useI18n(req)
    const isZhReject = rejectLocale !== 'en-US'
    const commentLines: string[] = []
    if (rejectMessage)
      commentLines.push(
        isZhReject
          ? `总体意见：${rejectMessage}`
          : `Overall comment: ${rejectMessage}`
      )
    if (Array.isArray(comments) && comments.length > 0) {
      commentLines.push(isZhReject ? '文件评审意见：' : 'File review comments:')
      for (const c of comments) {
        commentLines.push(`- ${c.file}：${c.text}`)
      }
    }
    const feedbackText =
      commentLines.length > 0
        ? isZhReject
          ? `用户拒绝了代码变更，请根据以下评审意见修改代码：\n${commentLines.join('\n')}`
          : `User rejected the code changes, please revise based on the following review comments:\n${commentLines.join('\n')}`
        : isZhReject
          ? '用户拒绝了代码变更，请重新审视代码实现并修改。'
          : 'User rejected the code changes, please reconsider the implementation and revise.'

    // Resume the paused graph workflow via web message
    clawEventBus.emit('message:incoming', {
      agentId: audit.agent_id,
      chatId: 0,
      content: clawMessage.text(feedbackText),
      userId,
      messageId: Date.now(),
      timestamp: new Date(),
      source: 'web',
      sessionId: audit.session_id,
      channelId: 0,
      taskId: audit.task_id || undefined,
    })

    return success(res, { success: true })
  })
)

/**
 * @Api /claw/agentAudit/cancel
 * @Summary Cancel audit and terminate workflow
 * @BodyParam auditId number Audit ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/agentAudit/cancel',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { auditId } = req.body
    const userId = (req as unknown as AuthRequest).user.userId

    if (!auditId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.auditIdRequired'))

    const audit = clawDb.findAgentAuditByIdAndUser(Number(auditId), userId)
    if (!audit)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.auditNotFound'))
    if (audit.status !== 'pending')
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.auditAlreadyHandled')
      )

    clawDb.updateAgentAudit(Number(auditId), { status: 'cancelled' })

    if (audit.task_id) {
      clawDb.updateTaskStatus(
        audit.task_id,
        'error',
        'Workflow cancelled by user'
      )
      void clawEventBus.emit('task:updated', {
        taskId: audit.task_id,
        status: 'error',
      })
    }

    return success(res, { success: true })
  })
)

export default router
