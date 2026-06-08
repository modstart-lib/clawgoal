import apiClient from './client'
import { copyText } from '../utils/utils'
import { message } from 'ant-design-vue'
import { i18n } from '../locale'

export interface CreateUserTempFileResult {
  url: string
}

export const createUserTempFileFromContent = async (params: {
  content: string
  ext?: string
  expire?: number
}): Promise<CreateUserTempFileResult> => {
  const res = await apiClient.post('/user_temp_file/createFromContent', params)
  return res.data.data
}

/**
 * 将内容生成临时文件链接并复制到剪贴板，返回完整 URL。
 * 失败时自动弹出错误提示。
 */
export async function shareUserTempLink(params: {
  content: string
  ext?: string
  expire?: number
}): Promise<string | null> {
  try {
    const result = await createUserTempFileFromContent(params)
    const fullUrl = `${window.location.origin}${result.url}`
    await copyText(fullUrl, i18n.global.t('common.copied'))
    return fullUrl
  } catch {
    message.error(i18n.global.t('common.operationFailed'))
    return null
  }
}
