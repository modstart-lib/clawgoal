import apiClient from './client'

export interface UploadImageResponse {
  url: string
  filename: string
  originalName: string
  size: number
  mimetype: string
}

/**
 * 上传单张图片
 */
export async function uploadImage(file: File): Promise<UploadImageResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post('/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data.data
}

/**
 * 批量上传图片
 */
export async function uploadImages(
  files: File[]
): Promise<UploadImageResponse[]> {
  const formData = new FormData()
  files.forEach((file) => {
    formData.append('files', file)
  })

  const response = await apiClient.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  const data = response.data.data
  return Array.isArray(data) ? data : [data]
}

/**
 * 上传单个文件（适用于 a-upload customRequest）
 */
export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadImageResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e: { loaded: number; total?: number }) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })

  return response.data.data
}
