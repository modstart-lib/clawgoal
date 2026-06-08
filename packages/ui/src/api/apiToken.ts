import apiClient from './client'

export interface ApiTokenRecord {
  id: number
  userId: number
  token: string
  permissions: string
  expire: string
  title: string | null
  lastUseTime: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiTokenPaginateResult {
  records: ApiTokenRecord[]
  page: number
  pageSize: number
  total: number
}

export const paginateApiTokens = async (
  page = 1,
  pageSize = 20
): Promise<ApiTokenPaginateResult> => {
  const response = await apiClient.post('/setting/apiToken/paginate', {
    page,
    pageSize,
  })
  return response.data.data
}

export const addApiToken = async (data: {
  permissions: string
  expire: string
  title?: string
}): Promise<ApiTokenRecord> => {
  const response = await apiClient.post('/setting/apiToken/add', data)
  return response.data.data.record
}

export const editApiToken = async (data: {
  id: number
  permissions?: string
  expire?: string
  title?: string
}): Promise<ApiTokenRecord> => {
  const response = await apiClient.post('/setting/apiToken/edit', data)
  return response.data.data.record
}

export const deleteApiToken = async (id: number): Promise<void> => {
  await apiClient.post('/setting/apiToken/delete', { id })
}

export const regenerateApiToken = async (
  id: number
): Promise<ApiTokenRecord> => {
  const response = await apiClient.post('/setting/apiToken/regenerate', { id })
  return response.data.data.record
}
