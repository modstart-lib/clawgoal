/**
 * Agent Workflow API — query workflow execution records.
 *
 * Routes:
 *   POST /claw/agentWorkflow/get  — get a workflow with its nodes by workflowId
 */

import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { apiHandler } from '../../../../backend/src/utils/api'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { error, success } from '../../../../backend/src/utils/response'
import { clawDb } from '../../storage/store/index.js'
import { useI18n } from '../../locale/index.js'

const router: Router = Router()

/**
 * @Api /api/claw/agentWorkflow/get
 * @Summary Get workflow execution detail with all nodes
 * @BodyParam workflowId number Workflow ID
 * @ReturnDataExample {"workflow":{"id":1,"status":"success","state":"{\"pipeline\":\"write\"}","start_at":"...","end_at":"..."},"nodes":[{"id":1,"status":"success","state":"{\"nodeId\":\"router\",\"nodeType\":\"router\",\"nodeTitle\":\"路由\"}","logs":"[]"}]}
 */
router.post(
  '/claw/agentWorkflow/get',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const userId = (req as unknown as AuthRequest).user.userId
    const { workflowId } = req.body ?? {}
    const wfId = parseInt(String(workflowId ?? 0), 10)
    if (!wfId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentWorkflowParamRequired')
      )

    const workflow = clawDb.findAgentWorkflowById(wfId)
    if (
      !workflow ||
      workflow.tenant_id !== tenantId ||
      workflow.user_id !== userId
    ) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentWorkflowNotFound')
      )
    }

    const nodes = clawDb.listAgentWorkflowNodes(wfId)
    return success(res, { workflow, nodes })
  })
)

export default router
