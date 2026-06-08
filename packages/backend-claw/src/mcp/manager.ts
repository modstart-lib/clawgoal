/**
 * MCP (Model Context Protocol) 客户端管理器
 *
 * 负责连接/断开 MCP 服务器，维护工具列表，以及按需调用工具。
 * 被 tool registry 调用，为 agent 运行时提供 MCP 工具能力。
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Tool as McpSdkTool } from '@modelcontextprotocol/sdk/types.js'
import { config } from '../../../backend/src/config/index.js'
import { safeJsonParse } from '../../../backend/src/utils/json.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import { clawDb } from '../storage/store/index.js'
import type {
  HttpMcpConfig,
  McpRow,
  StdioMcpConfig,
} from '../storage/store/mcp.js'

const logger = createLogger('mcp-manager')

export interface McpToolDef {
  /** 工具唯一名称：{mcpName}/{toolName} */
  name: string
  description: string
  parameters: Record<string, unknown>
  /** 原始 MCP server name */
  mcpName: string
  /** 原始工具名 */
  toolName: string
}

/** 单个 MCP 服务器连接状态 */
interface McpConnection {
  row: McpRow
  client: Client
  tools: McpSdkTool[]
  status: 'connected' | 'error'
}

export interface McpConnectResult {
  success: boolean
  toolNames: string[]
  error?: string
}

class McpManager {
  private connections = new Map<string, McpConnection>()

  /** 初始化：连接所有启用的 MCP 服务器 */
  async init(): Promise<void> {
    const rows = clawDb.findAllMcps(
      config.supervisorTenantId,
      config.supervisorUserId,
      true
    )
    for (const row of rows) {
      await this.connect(row)
    }
    logger.info(
      `MCP manager initialized: ${this.connections.size} server(s) connected`
    )
  }

  /** 连接单个 MCP 服务器，返回连接结果 */
  async connect(row: McpRow): Promise<McpConnectResult> {
    // 关闭旧连接
    await this.disconnect(row.name)

    const client = new Client(
      { name: 'clawgoal-claw', version: '1.0.0' },
      { capabilities: {} }
    )

    try {
      const transport = this._buildTransport(row)
      await client.connect(transport)

      const { tools } = await client.listTools()

      this.connections.set(row.name, {
        row,
        client,
        tools,
        status: 'connected',
      })

      // 持久化：更新 enable、status、tools 字段
      const toolsJson = JSON.stringify(
        tools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          inputSchema: t.inputSchema,
        }))
      )
      clawDb.updateMcp(row.id, {
        enable: true,
        status: 'connected',
        tools: toolsJson,
      })

      // 广播连接成功事件
      void clawEventBus.emit('mcp:connected', {
        mcpId: row.id,
        mcpName: row.name,
      })

      logger.info(
        `MCP server "${row.name}" connected, ${tools.length} tool(s) available`
      )
      return { success: true, toolNames: tools.map((t) => t.name) }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      logger.error({ err }, `Failed to connect MCP server "${row.name}"`)
      clawDb.updateMcp(row.id, { status: 'error' })

      // 广播连接失败事件（让前端感知到 error 状态）
      void clawEventBus.emit('mcp:disconnected', {
        mcpId: row.id,
        mcpName: row.name,
      })

      return { success: false, toolNames: [], error: errMsg }
    }
  }

  /** 断开单个 MCP 服务器 */
  async disconnect(mcpName: string): Promise<void> {
    const conn = this.connections.get(mcpName)
    if (!conn) return
    try {
      await conn.client.close()
    } catch {
      // ignore close errors
    }
    this.connections.delete(mcpName)
    clawDb.updateMcp(conn.row.id, { status: 'disconnected' })
    void clawEventBus.emit('mcp:disconnected', { mcpId: conn.row.id, mcpName })
  }

  /** 获取所有已连接的 MCP 服务器名称列表 */
  getAllConnectedMcpNames(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, conn]) => conn.status === 'connected')
      .map(([name]) => name)
  }

  /** 获取所有已连接 MCP 服务器的工具列表 */
  getAllTools(): McpToolDef[] {
    const result: McpToolDef[] = []
    for (const [mcpName, conn] of this.connections) {
      if (conn.status !== 'connected') continue
      for (const tool of conn.tools) {
        result.push({
          name: `mcp_${mcpName}_${tool.name}`,
          description: `[MCP:${mcpName}] ${tool.description ?? tool.name}`,
          parameters: (tool.inputSchema as Record<string, unknown>) ?? {
            type: 'object',
            properties: {},
          },
          mcpName,
          toolName: tool.name,
        })
      }
    }
    return result
  }

  /**
   * 获取指定 MCP 服务器名称列表对应的工具
   * @param allowedMcps agents capabilities.mcps 配置（明确的服务器名称列表）
   */
  getToolsForAgent(allowedMcps: string[]): McpToolDef[] {
    if (allowedMcps.length === 0) return []
    const all = this.getAllTools()
    return all.filter((t) => allowedMcps.includes(t.mcpName))
  }

  /** 调用 MCP 工具 */
  async callTool(
    mcpName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const conn = this.connections.get(mcpName)
    if (!conn || conn.status !== 'connected') {
      throw new Error(`MCP server "${mcpName}" is not connected`)
    }

    const result = await conn.client.callTool({
      name: toolName,
      arguments: args,
    })

    // 将 MCP 结果转为字符串
    if (Array.isArray(result.content)) {
      return result.content
        .map((item: any) => {
          if (item.type === 'text') return item.text as string
          if (item.type === 'image') return `[image: ${item.mimeType}]`
          return JSON.stringify(item)
        })
        .join('\n')
    }
    return JSON.stringify(result.content)
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _buildTransport(row: McpRow) {
    const cfg: Record<string, unknown> = row.config
      ? safeJsonParse(row.config, {}, 'mcpManager.config')
      : {}

    if (row.type === 'stdio') {
      const c = cfg as unknown as StdioMcpConfig

      let finalCmd = c.command
      let finalArgs = c.args ?? []

      // On Unix, use bash -l so that tools like npx or python in user local paths can be found
      if (process.platform !== 'win32') {
        finalCmd = 'bash'
        const bashScript = `exec ${c.command} "$@"`
        finalArgs = ['-l', '-c', bashScript, '--', ...(c.args ?? [])]
      }

      return new StdioClientTransport({
        command: finalCmd,
        args: finalArgs,
        env: c.env
          ? ({ ...process.env, ...c.env } as Record<string, string>)
          : undefined,
      })
    }

    const c = cfg as unknown as HttpMcpConfig
    const url = new URL(c.url)
    const headers = c.headers ?? {}

    if (row.type === 'sse') {
      return new SSEClientTransport(url, { requestInit: { headers } })
    }

    // http
    return new StreamableHTTPClientTransport(url, { requestInit: { headers } })
  }
}

export const mcpManager = new McpManager()
