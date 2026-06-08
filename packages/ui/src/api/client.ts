import axios from 'axios'
import { getLocale, i18n } from '../locale'
import { useAuth } from '../composables/auth.ts'
import {
  getApiBase as getSharedApiBase,
  setApiBase as setSharedApiBase,
} from './base'

const ResponseCodes = {
  SUCCESS: 0,
  API_TOKEN_EMPTY: 1000,
  LOGIN_REQUIRED: 1001,
  CAPTCHA_ERROR: 1002,
  PERMIT_DENIED: 1003,
  DEFAULT_ERROR: -1,
}

const apiClient = axios.create({
  baseURL: getSharedApiBase(),
  timeout: 600000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function setApiBase(apiBase: string): void {
  setSharedApiBase(apiBase)
  apiClient.defaults.baseURL = getSharedApiBase()
}

export function getApiBase(): string {
  return getSharedApiBase()
}

apiClient.interceptors.request.use(
  (config) => {
    const authStore = useAuth()
    const token = authStore.getAuthHeader()

    if (token && config.headers) {
      config.headers.Authorization = token
    }

    if (config.headers) {
      config.headers['Accept-Language'] = getLocale()
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  (response) => {
    // blob/arraybuffer 响应不做 JSON 解析，直接透传
    if (
      response.config.responseType === 'blob' ||
      response.config.responseType === 'arraybuffer'
    ) {
      return response
    }

    const { code, msg } = response.data

    if (code === ResponseCodes.SUCCESS) {
      return response
    }

    if (
      code === ResponseCodes.LOGIN_REQUIRED ||
      code === ResponseCodes.API_TOKEN_EMPTY
    ) {
      const authStore = useAuth()
      const reqUrl = response.config?.url || 'unknown'
      console.warn(
        `[DIAG:interceptor] code=${code} msg=${msg} url=${reqUrl} — calling logout + window.location.href=/login`
      )
      authStore.logout()
      // Use window.location.pathname to avoid hash mismatch with createWebHistory
      window.location.href = '/login'
      return Promise.reject(new Error(msg || i18n.global.t('auth.needLogin')))
    }

    // 开发模式下打印业务错误，供测试感知（console.warn 会被 Playwright 捕获）
    if (import.meta.env.DEV) {
      console.warn(`[API Error] ${msg || 'unknown error'} (code=${code})`)
    }
    return Promise.reject(new Error(msg || i18n.global.t('auth.requestFailed')))
  },
  (error) => {
    if (
      error.response?.data?.code === ResponseCodes.LOGIN_REQUIRED ||
      error.response?.data?.code === ResponseCodes.API_TOKEN_EMPTY
    ) {
      // Handle login redirect
    }
    return Promise.reject(error)
  }
)

export default apiClient
