import apiClient from './client'

export const getSettingBasic = async (): Promise<{
  viewMode?: string
}> => {
  const response = await apiClient.post('/setting/basic')
  return response.data.data
}

export const updatePassword = async (
  oldPassword: string,
  newPassword: string
): Promise<void> => {
  await apiClient.post('/setting/password/update', {
    oldPassword,
    newPassword,
  })
}

export const updateUsername = async (newUsername: string): Promise<void> => {
  await apiClient.post('/setting/username/update', { newUsername })
}

export const getSettingValue = async (
  name: string,
  defaultValue = ''
): Promise<string> => {
  const res = await apiClient.post('/setting/get', { name })
  return res.data.data?.value ?? defaultValue
}

export const setSettingValue = async (
  name: string,
  value: string
): Promise<void> => {
  await apiClient.post('/setting/set', { name, value })
}

export const getSettingValueJson = async <T = unknown>(
  name: string,
  defaultValue?: T
): Promise<T> => {
  const res = await apiClient.post('/setting/get_json', { name, defaultValue })
  return res.data.data?.value as T
}

export const setSettingValueJson = async (
  name: string,
  value: unknown
): Promise<void> => {
  await apiClient.post('/setting/set_json', { name, value })
}

export const getSystemSetting = async (): Promise<{ url: string }> => {
  const res = await apiClient.post('/setting/system/get')
  return res.data.data
}

export const saveSystemSetting = async (data: {
  url: string
}): Promise<void> => {
  await apiClient.post('/setting/system/save', data)
}

export interface AliyunOssConfig {
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  region: string
  endpoint?: string
}

export interface TencentCosConfig {
  secretId: string
  secretKey: string
  bucket: string
  region: string
}

export interface QiniuConfig {
  accessKey: string
  secretKey: string
  bucket: string
  region: string
}

export interface AwsS3Config {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  region: string
  endpoint?: string
}

export interface AzureBlobConfig {
  accountName: string
  accountKey: string
  containerName: string
  endpoint?: string
}

export interface UploadSetting {
  type: string
  url: string
  limitExt: string
  limitSize: number
  local?: { path?: string }
  aliyunOss?: AliyunOssConfig
  tencentCos?: TencentCosConfig
  qiniu?: QiniuConfig
  awsS3?: AwsS3Config
  azureBlob?: AzureBlobConfig
}

export async function getUploadSetting(): Promise<UploadSetting> {
  const res = await apiClient.post('/setting/upload/get')
  return res.data.data
}

export async function saveUploadSetting(
  payload: Partial<UploadSetting>
): Promise<void> {
  await apiClient.post('/setting/upload/save', payload)
}

export async function testUploadSetting(
  payload: Partial<UploadSetting>
): Promise<{ url: string; driver: string }> {
  const res = await apiClient.post('/setting/upload/test', payload)
  return res.data.data
}
