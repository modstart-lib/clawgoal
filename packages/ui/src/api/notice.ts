import apiClient from './client'

export interface NoticeItem {
  id: number
  userId: number
  title: string
  enable: boolean
  rateLimitEnable: boolean
  rateInterval: number
  type: string
  config: Record<string, any>
  proxyName?: string | null
  createdAt: string
  updatedAt: string
}

export interface NoticeLogItem {
  id: number
  userId: number
  noticeId: number
  title: string
  content: string
  status: 'success' | 'fail'
  createdAt: string
  updatedAt: string
}

export const noticeList = async (): Promise<NoticeItem[]> => {
  const res = await apiClient.post('/setting/notice/list')
  return res.data.data.records ?? []
}

export const noticeAdd = async (
  data: Omit<NoticeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<NoticeItem> => {
  const res = await apiClient.post('/setting/notice/add', data)
  return res.data.data.record
}

export const noticeEdit = async (
  data: Partial<Omit<NoticeItem, 'userId' | 'createdAt' | 'updatedAt'>> & {
    id: number
  }
): Promise<NoticeItem> => {
  const res = await apiClient.post('/setting/notice/edit', data)
  return res.data.data.record
}

export const noticeDelete = async (id: number): Promise<void> => {
  await apiClient.post('/setting/notice/delete', { id })
}

export const noticeTest = async (id: number): Promise<void> => {
  await apiClient.post('/setting/notice/test', { id })
}

export const noticeLogPaginate = async (params: {
  noticeId?: number | null
  startTime?: string
  endTime?: string
  page?: number
  pageSize?: number
}): Promise<{
  records: NoticeLogItem[]
  page: number
  pageSize: number
  total: number
}> => {
  const res = await apiClient.post('/setting/notice/log/paginate', params)
  return res.data.data
}
