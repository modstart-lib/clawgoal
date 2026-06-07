import apiClient from './client'

export interface UserRecord {
  id: number
  tenantId: number
  username: string
  apiToken: string | null
  apiData: object | null
  isCreator: boolean
  createdAt: string
  updatedAt: string
}

export interface UserListResult {
  records: UserRecord[]
  total: number
}

export const getUserList = async (
  page = 1,
  pageSize = 20
): Promise<UserListResult> => {
  const response = await apiClient.post('/user/list', { page, pageSize })
  return response.data.data as UserListResult
}

export const addUser = async (data: {
  username: string
  password: string
  tenantId: number
  isCreator?: boolean
}): Promise<UserRecord> => {
  const response = await apiClient.post('/user/add', data)
  return response.data.data.record
}

export const editUser = async (data: {
  id: number
  username?: string
  password?: string
  tenantId?: number
  isCreator?: boolean
}): Promise<UserRecord> => {
  const response = await apiClient.post('/user/edit', data)
  return response.data.data.record
}

export const deleteUser = async (id: number): Promise<void> => {
  await apiClient.post('/user/delete', { id })
}
