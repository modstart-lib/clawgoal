import apiClient from './client'

export const getAccountCurrent = async (): Promise<{
  authType: string
  username: string
  isSupervisor: boolean
  isCreator: boolean
}> => {
  const response = await apiClient.post('/account/current')
  return response.data.data
}
