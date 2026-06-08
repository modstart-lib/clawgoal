/** MCP 连接类型 */
export type McpType = 'stdio' | 'sse' | 'http'

/** stdio 类型的连接配置 */
export interface StdioMcpConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

/** sse / http 类型的连接配置 */
export interface HttpMcpConfig {
  url: string
  headers?: Record<string, string>
}

export type McpConfig = StdioMcpConfig | HttpMcpConfig

export interface McpRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  /** 唯一标识，用于 capabilities.mcps 数组引用，如 "filesystem" */
  name: string
  /** 显示名称，如 "文件系统 MCP" */
  title: string
  /** stdio | sse | http */
  type: string
  enable: number
  /** JSON 字符串，结构取决于 type */
  config: string | null
  /** disconnected | connecting | connected | disconnecting | error */
  status: string
  description: string | null
  /** JSON 数组：[{name, description, inputSchema}]，连接成功后写入 */
  tools: string | null
}

export interface AddMcpInput {
  tenantId: number
  userId: number
  name: string
  title: string
  type: McpType
  enable?: boolean
  config?: McpConfig
  description?: string
}

export interface UpdateMcpInput {
  name?: string
  title?: string
  type?: McpType
  enable?: boolean
  config?: McpConfig
  status?:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'disconnecting'
    | 'error'
  description?: string
  /** JSON 数组字符串，null 表示清空 */
  tools?: string | null
}
