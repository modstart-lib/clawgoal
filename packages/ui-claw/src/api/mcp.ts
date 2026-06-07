import apiClient from './client'

export type McpType = 'stdio' | 'sse' | 'http'

export interface McpRow {
  id: number
  created_at: string
  updated_at: string
  name: string
  title: string
  type: string
  enable: number
  config: McpConfig | null
  status: string
  description: string | null
  /** JSON 数组：[{name, description, inputSchema}]，连接成功后写入 */
  tools: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }> | null
}

export interface StdioMcpConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface HttpMcpConfig {
  url: string
  headers?: Record<string, string>
}

export type McpConfig = StdioMcpConfig | HttpMcpConfig

export interface AddMcpInput {
  name: string
  title: string
  type: McpType
  enable?: boolean
  config?: McpConfig
  description?: string
}

export interface UpdateMcpInput {
  id: number
  name?: string
  title?: string
  type?: McpType
  enable?: boolean
  config?: McpConfig
  description?: string
}

export const getMcpList = async (): Promise<McpRow[]> => {
  const res = await apiClient.post('/claw/mcp/list')
  return res.data.data || []
}

export const getMcpDetail = async (id: number): Promise<McpRow> => {
  const res = await apiClient.post('/claw/mcp/detail', { id })
  return res.data.data
}

export const addMcp = async (data: AddMcpInput): Promise<McpRow> => {
  const res = await apiClient.post('/claw/mcp/add', data)
  return res.data.data
}

export const updateMcp = async (data: UpdateMcpInput): Promise<McpRow> => {
  const res = await apiClient.post('/claw/mcp/edit', data)
  return res.data.data
}

export const setMcpEnable = async (
  id: number,
  enable: boolean
): Promise<{ mcp: McpRow; toolNames: string[] }> => {
  const res = await apiClient.post('/claw/mcp/setEnable', { id, enable })
  return res.data.data
}

export const deleteMcp = async (id: number): Promise<void> => {
  await apiClient.post('/claw/mcp/remove', { id })
}
