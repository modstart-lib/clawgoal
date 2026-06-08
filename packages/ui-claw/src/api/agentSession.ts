import apiClient from './client'

export interface ChatSession {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number
  title: string
  message_count: number
  data: Record<string, unknown>
}

export const listChatSessions = async (
  agentId: number,
  options?: { limit?: number; offset?: number }
): Promise<ChatSession[]> => {
  const response = await apiClient.post('/claw/agentSession/list', {
    agentId,
    ...options,
  })
  return response.data.data || []
}

export const getChatSession = async (id: number): Promise<ChatSession> => {
  const response = await apiClient.post('/claw/agentSession/get', { id })
  return response.data.data
}

export const addChatSession = async (
  agentId: number
): Promise<{ id: number }> => {
  const response = await apiClient.post('/claw/agentSession/add', { agentId })
  return response.data.data
}

export const switchChatSession = async (
  agentId: number,
  sessionId: number
): Promise<{ id: number }> => {
  const response = await apiClient.post('/claw/agentSession/switch', {
    agentId,
    sessionId,
  })
  return response.data.data
}

export const deleteChatSession = async (id: number): Promise<void> => {
  await apiClient.post('/claw/agentSession/delete', { id })
}

export const getChatSessionData = async (
  id: number
): Promise<Record<string, unknown>> => {
  const response = await apiClient.post('/claw/agentSession/getData', { id })
  return response.data.data?.data ?? {}
}

export const updateChatSessionData = async (
  id: number,
  data: Record<string, unknown>
): Promise<void> => {
  await apiClient.post('/claw/agentSession/updateData', { id, data })
}

export const getChatSessionLogUrl = async (
  agentId: number,
  sessionId: number
): Promise<{ logUrl: string | null; isDebug: boolean }> => {
  const response = await apiClient.post('/claw/agentSession/logUrl', {
    agentId,
    sessionId,
  })
  return {
    logUrl: response.data.data?.logUrl ?? null,
    isDebug: response.data.data?.isDebug ?? false,
  }
}
