/**
 * Claw config API routes
 *
 * POST /claw/config/paramForm  — return tools param config schema
 */
import { Router } from 'express'
import { apiHandler } from '../../../../backend/src/utils/api.js'
import { success } from '../../../../backend/src/utils/response.js'
import { ToolsParamConfig } from '../../tools/web.js'

const router: Router = Router()

/**
 * @Api /api/claw/config/paramForm
 * @Summary Get param form config
 * @ReturnDataExample [{"group":"搜索","params":[{"name":"Tools.Web.BraveApiKey","title":"Brave Search API Key","type":"text","defaultValue":""}]}]
 */
router.post(
  '/claw/config/paramForm',
  apiHandler(async (_req, res) => {
    return success(res, ToolsParamConfig)
  })
)

export default router
