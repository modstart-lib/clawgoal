import apiClient from './client'

export const getGlobalMemory = async (): Promise<string> => {
  const response = await apiClient.post('/claw/memory/global/get')
  return response.data.data?.content ?? ''
}

export const setGlobalMemory = async (content: string): Promise<void> => {
  await apiClient.post('/claw/memory/global/set', { content })
}
export const getAgentMemory = async (
  agentId: number | string
): Promise<string> => {
  const response = await apiClient.post('/claw/memory/agent/get', {
    agentId: String(agentId),
  })
  return response.data.data?.content ?? ''
}

export const setAgentMemory = async (
  agentId: number | string,
  content: string
): Promise<void> => {
  await apiClient.post('/claw/memory/agent/set', {
    agentId: String(agentId),
    content,
  })
}

export const getAgentSoul = async (
  agentId: number | string
): Promise<string> => {
  const response = await apiClient.post('/claw/memory/agent/soul/get', {
    agentId: String(agentId),
  })
  return response.data.data?.content ?? ''
}

export const setAgentSoul = async (
  agentId: number | string,
  content: string
): Promise<void> => {
  await apiClient.post('/claw/memory/agent/soul/set', {
    agentId: String(agentId),
    content,
  })
}
export const getUserMemory = async (): Promise<string> => {
  const response = await apiClient.post('/claw/memory/user/get')
  return response.data.data?.content ?? ''
}

export const setUserMemory = async (content: string): Promise<void> => {
  await apiClient.post('/claw/memory/user/set', { content })
}
