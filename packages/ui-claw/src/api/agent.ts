import type { AddAgentOptions, Agent, RoleParamDef } from '@/types'
import apiClient from './client'

let _cachedAgents: Agent[] | null = null
let _fetchingAgents: Promise<Agent[]> | null = null

export const getAgents = async (projectId?: number): Promise<Agent[]> => {
  if (projectId != null) {
    const response = await apiClient.post('/claw/agent/list', { projectId })
    return response.data.data || []
  }
  if (_cachedAgents) return _cachedAgents
  if (_fetchingAgents) return _fetchingAgents
  _fetchingAgents = apiClient.post('/claw/agent/list').then((response) => {
    _cachedAgents = response.data.data || []
    _fetchingAgents = null
    return _cachedAgents!
  })
  return _fetchingAgents
}

export const refreshAgents = async (): Promise<Agent[]> => {
  _cachedAgents = null
  _fetchingAgents = null
  return getAgents()
}

export const getAgent = async (id: string): Promise<Agent> => {
  const response = await apiClient.post('/claw/agent/detail', { id })
  return response.data.data
}

export const addAgent = async (
  data: AddAgentOptions & { param?: Record<string, unknown> }
): Promise<Agent> => {
  const response = await apiClient.post('/claw/agent/add', {
    ...data,
    telegramToken: data.telegramToken || '',
  })
  return response.data.data
}

export const removeAgent = async (id: string): Promise<void> => {
  await apiClient.post('/claw/agent/remove', { id })
}

export const setAgentActive = async (
  id: string,
  active: boolean
): Promise<void> => {
  await apiClient.post('/claw/agent/setActive', { id, active })
}

export const getRoles = async (): Promise<
  { name: string; title: string; avatar: string | null }[]
> => {
  const response = await apiClient.post('/claw/agent/role/list')
  return response.data.data || []
}

export const getRoleDetail = async (
  roleName: string
): Promise<{ name: string; title: string; param?: RoleParamDef[] }> => {
  const response = await apiClient.post('/claw/agent/role/detail', {
    roleName,
  })
  return response.data.data
}

export interface ToolActionFieldOverride {
  type: 'text' | 'radio' | 'textarea'
  name: string
  title: string
  defaultValue?: string
  required?: boolean
  options?: string[]
  minRows?: number
  maxRows?: number
}

export interface ToolActionOverride {
  type: 'form'
  icon?: string
  title: string
  config: {
    fields: ToolActionFieldOverride[]
    template: string
  }
}

export interface AgentConfigOverrides {
  name?: string
  version?: string
  description?: string
  models?: Record<
    string,
    {
      name: string
      temperature?: number
      maxTokens?: number
      systemPrompt?: string
    }
  >
  capabilities?: {
    tools?: string[]
    [key: string]: unknown
  }
  chats?: {
    toolActions?: ToolActionOverride[]
  }
}

export const updateAgentConfig = async (
  id: string,
  overrides: AgentConfigOverrides
): Promise<void> => {
  await apiClient.post('/claw/agent/updateConfig', { id, overrides })
}

export const updateAgentBasic = async (
  id: string,
  data: {
    title?: string
    description?: string
    avatar?: string | null
    avatarConfig?: Record<string, unknown> | null
    channelIds?: number[]
    webhookEnable?: boolean
    webhookToken?: string | null
    projectId?: number | null
  }
): Promise<void> => {
  await apiClient.post('/claw/agent/updateBasic', { id, ...data })
}

export interface AgentRoleConfig {
  name: string
  title: string
  version: string
  description: string
  /** 角色预设个性（Soul），无 paramDb 记录时自动作为初始化内容 */
  soul?: string
  models: Record<
    string,
    {
      name: string
      temperature?: number
      maxTokens?: number
      systemPrompt?: string
    }
  >
  capabilities: {
    tools: string[]
    skills: string[]
    mcps: string[]
    [key: string]: unknown
  }

  [key: string]: unknown
}

/** Fetch the original role config (default values) for the role assigned to a agent */
export const getAgentRoleConfig = async (
  id: string
): Promise<AgentRoleConfig> => {
  const response = await apiClient.post('/claw/agent/roleConfig', { id })
  return response.data.data
}

export const updateAgentParam = async (
  id: string,
  param: Record<string, unknown>
): Promise<Agent> => {
  const response = await apiClient.post('/claw/agent/updateParam', {
    id,
    param,
  })
  return response.data.data
}

/** List all available tool names (includes '*' for all-tools wildcard) */
export const getAvailableTools = async (): Promise<string[]> => {
  const response = await apiClient.post('/claw/tools/list')
  return response.data.data || []
}
