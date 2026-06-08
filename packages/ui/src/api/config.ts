import apiClient from './client'

/** A single model entry inside a provider's models list */
export interface ModelProviderModel {
  name: string
  /** Supported image input formats. ['url','base64'] = both (default). ['base64'] = auto-convert remote URLs. */
  imageInputs?: string[]
  /** Default temperature for this model (0=precise, 1=creative) */
  temperature?: number
  /** Max tokens to generate per call */
  maxTokens?: number
  /** Context window size. 0 = use built-in default. */
  contextWindow?: number
}

export interface ModelProviderConfig {
  name: string
  provider: string
  format?: string
  apiBase: string
  apiKey: string
  /** Whether this provider is the default provider */
  isDefault?: boolean
  /** Optional proxy name to route requests through */
  proxyName?: string
  models: ModelProviderModel[]
  /** Frontend-only flag: built-in system provider (not editable) */
  _builtIn?: boolean
}

export interface EmbeddingModelConfig {
  type: 'default' | 'openai'
  model?: string
  apiKey?: string
  apiBase?: string
  /** Optional proxy name to route requests through */
  proxyName?: string
}

// ─── Model Provider ───────────────────────────────────────────────────────────

/**
 * Normalise a list of providers so that at most one has isDefault=true.
 * If multiple are marked as default, the last one in the array wins.
 */
export function ensureSingleDefault(
  providers: ModelProviderConfig[]
): ModelProviderConfig[] {
  let lastDefaultIdx = -1
  providers.forEach((p, i) => {
    if (p.isDefault) lastDefaultIdx = i
  })
  return providers.map((p, i) => ({
    ...p,
    isDefault: lastDefaultIdx === -1 ? p.isDefault : i === lastDefaultIdx,
  }))
}

export const getModelProvider = async (): Promise<ModelProviderConfig[]> => {
  const response = await apiClient.post('/config/modelProvider/get')
  return response.data.data.modelProviders
}

export const saveModelProvider = async (
  modelProviders: ModelProviderConfig[]
): Promise<void> => {
  await apiClient.post('/config/modelProvider/save', {
    modelProviders: ensureSingleDefault(modelProviders),
  })
}

export const testModelProvider = async (
  provider: ModelProviderConfig
): Promise<{ ok: boolean; error?: string }> => {
  const response = await apiClient.post('/config/modelProvider/test', provider)
  return response.data.data
}

// ─── Embedding Model ──────────────────────────────────────────────────────────────────

export const getEmbeddingModel = async (): Promise<EmbeddingModelConfig> => {
  const response = await apiClient.post('/config/embeddingModel/get')
  return response.data.data.embeddingModel
}

export const saveEmbeddingModel = async (
  embeddingModel: EmbeddingModelConfig
): Promise<void> => {
  await apiClient.post('/config/embeddingModel/save', { embeddingModel })
}

export const testEmbeddingModel = async (
  provider: EmbeddingModelConfig
): Promise<{ ok: boolean; error?: string }> => {
  const response = await apiClient.post('/config/embeddingModel/test', provider)
  return response.data.data
}

// ─── Model ────────────────────────────────────────────────────────────────────

export const getModelConfig = async (): Promise<Record<string, any>> => {
  const response = await apiClient.post('/config/model/get')
  return response.data.data.model
}

export const saveModelConfig = async (
  model: Record<string, any>
): Promise<void> => {
  await apiClient.post('/config/model/save', { model })
}

// ─── Runtime Environment ──────────────────────────────────────────────────────

export interface RuntimeConfig {
  path: string
  version: string
}

export const getRuntimeConfigs = async (): Promise<
  Record<string, RuntimeConfig>
> => {
  const response = await apiClient.post('/config/runtime/get')
  return response.data.data.runtime ?? {}
}

export const saveRuntimeConfigs = async (
  runtime: Record<string, RuntimeConfig>
): Promise<void> => {
  await apiClient.post('/config/runtime/save', { runtime })
}

export const detectRuntimeVersion = async (path: string): Promise<string> => {
  const response = await apiClient.post('/config/runtime/detectVersion', {
    path,
  })
  return response.data.data.version ?? ''
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

export interface ProxyConfig {
  /** Unique name for this proxy entry */
  name: string
  type: 'http' | 'socks5'
  host: string
  port: string
  username?: string
  password?: string
}

export const getProxyConfigs = async (): Promise<ProxyConfig[]> => {
  const response = await apiClient.post('/setting/proxy/get')
  return response.data.data.proxies ?? []
}

export const saveProxyConfigs = async (
  proxies: ProxyConfig[]
): Promise<void> => {
  await apiClient.post('/setting/proxy/save', { proxies })
}

export const testProxy = async (
  proxyName: string,
  url: string
): Promise<{ statusCode?: number; ok: boolean; error?: string }> => {
  const response = await apiClient.post('/setting/proxy/test', {
    proxyName,
    url,
  })
  return response.data.data
}
