import apiClient from './client'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  mtime?: number
  children?: FileNode[]
}

export const getFilesTree = async (): Promise<FileNode[]> => {
  const res = await apiClient.post('/setting/file/tree')
  return res.data.data || []
}

export const readFile = async (path: string): Promise<string> => {
  const res = await apiClient.post('/setting/file/read', { path })
  return res.data.data?.content ?? ''
}

export const writeFile = async (
  path: string,
  content: string
): Promise<void> => {
  await apiClient.post('/setting/file/write', { path, content })
}

export const deleteFile = async (path: string): Promise<void> => {
  await apiClient.post('/setting/file/delete', { path })
}

export const renameFile = async (
  oldPath: string,
  newPath: string
): Promise<void> => {
  await apiClient.post('/setting/file/rename', { oldPath, newPath })
}
