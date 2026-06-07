import apiClient from './client'

/**
 * Model 相关API接口
 */

/**
 * 聊天消息类型
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * 聊天请求参数
 */
export interface ChatRequest {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  max_tokens?: number
}

/**
 * 聊天响应数据
 */
export interface ChatResponse {
  message: ChatMessage
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface ModelItem {
  nameRef: string
  provider: string
  model: string
}

export interface BuiltinModelItem {
  nameRef: string
  provider: string
  model: string
  name: string
  rate: number
}

// ─── 统一提供商列表 ────────────────────────────────────────────────────────────

export interface BuiltinModelSetting {
  id: string
  visible: boolean
  isDefault: boolean
  temperature?: number | null
  maxTokens?: number | null
  contextWindow?: number | null
}

/** 统一的提供商模型条目（自定义提供商用 name 字段，内置提供商额外有 builtinId/builtinRate） */
export interface UnifiedProviderModel {
  name: string
  builtinId?: string
  builtinRate?: number
  visible?: boolean
  isDefault?: boolean
  imageInputs?: string[]
  temperature?: number | null
  maxTokens?: number | null
  contextWindow?: number | null
}

/** 统一的提供商条目（自定义 + 内置） */
export interface UnifiedProvider {
  name: string
  provider: string
  format?: string
  apiBase: string
  apiKey: string
  isDefault: boolean
  proxyName?: string
  models: UnifiedProviderModel[]
  /** 是否为内置提供商 */
  _builtIn?: boolean
  /** 内置提供商：剩余 Token 配额 */
  builtinQuota?: number
  /** 内置提供商：是否已登录 */
  builtinLoggedIn?: boolean
}

export const getProviderList = async (): Promise<UnifiedProvider[]> => {
  const response = await apiClient.post('/model/providerList')
  return response.data.data.providers ?? []
}

export const setProviderDefault = async (
  providerName: string
): Promise<void> => {
  await apiClient.post('/model/providerDefault/set', { providerName })
}

export const saveBuiltinProviderModels = async (
  models: BuiltinModelSetting[]
): Promise<void> => {
  await apiClient.post('/model/builtinProvider/save', { models })
}

export const listModels = async (): Promise<{
  models: ModelItem[]
  builtinModels: BuiltinModelItem[]
}> => {
  const response = await apiClient.post('/model/list')
  return {
    models: response.data.data.models ?? [],
    builtinModels: response.data.data.builtinModels ?? [],
  }
}

/**
 * 发送聊天消息
 */
export const chatWithModel = async (
  request: ChatRequest
): Promise<ChatResponse> => {
  const response = await apiClient.post('/model/chat', request)
  return response.data.data
}
