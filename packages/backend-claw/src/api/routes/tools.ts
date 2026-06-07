/**
 * Tools API — returns available tool names from the tool registry.
 *
 * Routes:
 *   POST /tools/list   — list all registered tool names (includes '*' for "all tools")
 */

import { Router } from 'express'
import { apiHandler } from '../../../../backend/src/utils/api'
import { success } from '../../../../backend/src/utils/response'
import { toolRegistry } from '../../tools'

const router: Router = Router()

/**
 * @Api /api/claw/tools/list
 * @Summary List
 * @ReturnDataExample ["*","web_batch_search","web_batch_fetch","file_read","file_write"]
 */
router.post(
  '/claw/tools/list',
  apiHandler(async (_req, res) => {
    const names = ['*', ...toolRegistry.listTools()]
    return success(res, names)
  })
)

export default router
