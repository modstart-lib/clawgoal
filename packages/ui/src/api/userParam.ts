import apiClient from './client'

export const userParamGet = async (
  name: string,
  defaultValue = ''
): Promise<string> => {
  const response = await apiClient.post('/userParam/get', {
    name,
    defaultValue,
  })
  return response.data.data.value ?? defaultValue
}

export const userParamSet = async (
  name: string,
  value: string,
  options?: { scope?: string; remark?: string }
): Promise<void> => {
  await apiClient.post('/userParam/set', { name, value, ...options })
}

export const userParamGetJson = async <T = unknown>(
  name: string,
  defaultValue?: T
): Promise<T> => {
  const response = await apiClient.post('/userParam/getJson', {
    name,
    defaultValue,
  })
  return response.data.data.value as T
}

export const userParamSetJson = async (
  name: string,
  value: unknown,
  options?: { scope?: string; remark?: string }
): Promise<void> => {
  await apiClient.post('/userParam/setJson', { name, value, ...options })
}

export const userParamBatchGet = async (
  params: Record<string, string>
): Promise<Record<string, string>> => {
  const items = Object.entries(params).map(([name, defaultValue]) => ({
    name,
    defaultValue,
  }))
  const response = await apiClient.post('/userParam/batchGet', { items })
  return response.data.data.values as Record<string, string>
}

export const userParamBatchSet = async (
  params: Record<string, string>,
  options?: { scope?: string; remark?: string }
): Promise<void> => {
  const items = Object.entries(params).map(([name, value]) => ({
    name,
    value,
    ...options,
  }))
  await apiClient.post('/userParam/batchSet', { items })
}

export type ParamConfigItem =
  | { name: string; title: string; type: 'text'; defaultValue: string }
  | { name: string; title: string; type: 'switch'; defaultValue: boolean }
  | {
      name: string
      title: string
      type: 'select'
      options: { value: string; title: string }[]
      defaultValue: string
    }
  | {
      name: string
      title: string
      type: 'checkbox'
      options: { value: string; title: string }[]
      defaultValue: string
    }

export interface ParamConfigGroup {
  group: string
  params: ParamConfigItem[]
}

export const userParamConfigForm = async (): Promise<ParamConfigGroup[]> => {
  const res = await apiClient.post('/claw/config/paramForm', {})
  return res.data.data as ParamConfigGroup[]
}

// ─── Env 变量管理 ─────────────────────────────────────────────────────────────

export interface EnvItem {
  name: string
  value: string
}

export const userParamEnvList = async (): Promise<EnvItem[]> => {
  const response = await apiClient.post('/userParam/env/list')
  return response.data.data.envs ?? []
}

export const userParamEnvSet = async (
  name: string,
  value: string
): Promise<void> => {
  await apiClient.post('/userParam/env/set', { name, value })
}

export const userParamEnvDelete = async (name: string): Promise<void> => {
  await apiClient.post('/userParam/env/delete', { name })
}
