/**
 * MCP (Model Context Protocol) Server API routes
 *
 * Routes:
 *   POST /mcp/list     — 列出所有 MCP 服务器
 *   POST /mcp/add      — 新增 MCP 服务器
 *   POST /mcp/detail   — 获取单个 MCP 服务器
 *   POST /mcp/edit     — 更新 MCP 服务器配置
 *   POST /mcp/remove   — 删除 MCP 服务器
 *   POST /mcp/set-enable — 切换启用状态
 */

import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants.js'
import { apiHandler } from '../../../../backend/src/utils/api.js'
import { error, success } from '../../../../backend/src/utils/response.js'
import { useI18n } from '../../locale/index.js'
import { mcpManager } from '../../mcp/manager.js'
import { clawDb } from '../../storage/store/index.js'
import type {
  AddMcpInput,
  McpType,
  UpdateMcpInput,
} from '../../storage/store/types.js'

const router: Router = Router()

function mapMcpRow(r: any): any {
  let config: any = null
  if (r.config) {
    try {
      config = JSON.parse(r.config)
    } catch {}
  }
  let tools: any = null
  if (r.tools) {
    try {
      tools = JSON.parse(r.tools)
    } catch {}
  }
  return { ...r, config, tools }
}

/**
 * @Api /api/claw/mcp/list
 * @Summary List mcp
 * @ReturnDataExample [{"id":1,"name":"mcp1","title":"MCP Server","type":"stdio","enable":1}]
 */
router.post(
  '/claw/mcp/list',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const mcps = clawDb.findAllMcps(tenantId, userId)
    return success(res, mcps.map(mapMcpRow))
  })
)

/**
 * @Api /api/claw/mcp/detail
 * @Summary Get detail mcp
 * @BodyParam id number MCP server ID
 * @ReturnDataExample {"id":1,"name":"mcp1","title":"MCP Server","type":"stdio"}
 */
router.post(
  '/claw/mcp/detail',
  apiHandler(async (req, res) => {
    const { id } = req.body as { id: number }
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    const row = clawDb.findMcpById(id)
    if (!row) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mcpNotFound'))
    }
    return success(res, mapMcpRow(row))
  })
)

/**
 * @Api /api/claw/mcp/add
 * @Summary Add mcp
 * @BodyParam name string Unique MCP server name
 * @BodyParam title string Display title
 * @BodyParam type string Server type: stdio|sse|http
 * @BodyParam enable boolean? Enable on creation
 * @BodyParam config object? Server configuration
 * @BodyParam description string? Description
 * @ReturnDataExample {"id":1,"name":"mcp1","type":"stdio","enable":1}
 */
router.post(
  '/claw/mcp/add',
  apiHandler(async (req, res) => {
    const { name, title, type, enable, config, description } =
      req.body as AddMcpInput
    const { t } = useI18n(req)
    if (!name || !title || !type) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.mcpFieldsRequired')
      )
    }
    const validTypes: McpType[] = ['stdio', 'sse', 'http']
    if (!validTypes.includes(type)) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mcpTypeInvalid'))
    }
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const existing = clawDb.findMcpByName(tenantId, userId, name)
    if (existing) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mcpNameExists'))
    }
    const row = clawDb.insertMcp({
      tenantId,
      userId,
      name,
      title,
      type,
      enable,
      config,
      description,
    })
    return success(res, mapMcpRow(row), t('claw.mcpCreated'))
  })
)

/**
 * @Api /api/claw/mcp/edit
 * @Summary Edit mcp
 * @BodyParam id number MCP server ID
 * @BodyParam name string? Updated name
 * @BodyParam title string? Updated title
 * @BodyParam type string? Updated type
 * @BodyParam config object? Updated config
 * @ReturnDataExample {"id":1,"name":"mcp1","title":"Updated"}
 */
router.post(
  '/claw/mcp/edit',
  apiHandler(async (req, res) => {
    const { id, ...input } = req.body as { id: number } & UpdateMcpInput
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    const row = clawDb.findMcpById(id)
    if (!row) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mcpNotFound'))
    }
    if (input.type) {
      const validTypes: McpType[] = ['stdio', 'sse', 'http']
      if (!validTypes.includes(input.type)) {
        return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mcpTypeInvalid'))
      }
    }
    if (input.name && input.name !== row.name) {
      const userId = (req as unknown as AuthRequest).user.userId
      const tenantId = (req as unknown as AuthRequest).user.tenantId
      const existing = clawDb.findMcpByName(tenantId, userId, input.name)
      if (existing) {
        return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mcpNameExists'))
      }
    }
    clawDb.updateMcp(id, input)
    return success(res, mapMcpRow(clawDb.findMcpById(id)), t('claw.mcpUpdated'))
  })
)

/**
 * @Api /api/claw/mcp/setEnable
 * @Summary Set enable state mcp
 * @BodyParam id number MCP server ID
 * @BodyParam enable boolean Enable or disable
 * @ReturnDataExample {"mcp":{"id":1,"status":"connecting"}}
 */
router.post(
  '/claw/mcp/setEnable',
  apiHandler(async (req, res) => {
    const { id, enable } = req.body as { id: number; enable: boolean }
    const { t } = useI18n(req)
    if (id === undefined || enable === undefined) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.mcpIdEnableRequired')
      )
    }
    const row = clawDb.findMcpById(id)
    if (!row) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mcpNotFound'))
    }

    if (enable) {
      // 仅标记为 connecting；enable 等连接成功后由 manager 写入 DB
      clawDb.updateMcp(id, { status: 'connecting' })
      void mcpManager.connect(row)
      return success(res, { mcp: mapMcpRow(clawDb.findMcpById(id)) })
    } else {
      // 立即关闭：先更新 enable=false，再异步断开（manager.disconnect 会更新 status）
      clawDb.updateMcp(id, { enable: false })
      void mcpManager.disconnect(row.name)
      return success(res, { mcp: mapMcpRow(clawDb.findMcpById(id)) })
    }
  })
)

/**
 * @Api /api/claw/mcp/remove
 * @Summary Remove mcp
 * @BodyParam id number MCP server ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/mcp/remove',
  apiHandler(async (req, res) => {
    const { id } = req.body as { id: number }
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }
    const ok = clawDb.deleteMcp(id)
    if (!ok) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.mcpNotFound'))
    }
    return success(res, null, t('claw.mcpDeleted'))
  })
)

export default router
