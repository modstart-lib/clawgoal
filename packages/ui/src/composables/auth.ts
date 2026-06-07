import axios from 'axios'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { resolveApiPath } from '../api/base.ts'
import { AppConfig } from '../config.ts'
import { i18n } from '../locale'

const TOKEN_KEY = AppConfig.storageKeys.token
const USER_ID_KEY = AppConfig.storageKeys.userId
const REFRESH_INTERVAL = 60 * 60 * 1000 // 1 hour
const AUTO_LOGIN_TIMEOUT = 10_000 // 10s timeout for auto-login

let refreshTimer: NodeJS.Timeout | null = null

export const useAuth = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const userId = ref<number | null>(
    localStorage.getItem(USER_ID_KEY)
      ? Number(localStorage.getItem(USER_ID_KEY))
      : null
  )

  const isInitialized = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  /**
   * Login
   */
  const login = async (
    username: string,
    password: string,
    captchaToken?: string
  ) => {
    try {
      const response = await axios.post(resolveApiPath('/login'), {
        username,
        password,
        captchaToken,
      })

      const { code, msg, data: responseData } = response.data

      if (code === 0) {
        const { token: newToken, userId: newUserId } = responseData

        token.value = newToken
        userId.value = newUserId
        localStorage.setItem(TOKEN_KEY, newToken)
        localStorage.setItem(USER_ID_KEY, String(newUserId))
        isInitialized.value = true

        startAutoRefresh()

        return { success: true }
      } else {
        return {
          success: false,
          message: msg || i18n.global.t('auth.loginFailed'),
        }
      }
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.msg ||
          error.message ||
          i18n.global.t('auth.loginError'),
      }
    }
  }

  /**
   * Logout
   */
  const logout = () => {
    token.value = null
    userId.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_ID_KEY)
    stopAutoRefresh()
  }

  /**
   * Refresh Token
   */
  const refreshToken = async () => {
    if (!token.value) {
      return { success: false, message: i18n.global.t('auth.notLoggedIn') }
    }

    try {
      const response = await axios.post(
        resolveApiPath('/login/refresh'),
        {},
        {
          headers: {
            Authorization: `Bearer ${token.value}`,
          },
        }
      )

      const { code, msg, data: responseData } = response.data

      if (code === 0) {
        const { token: newToken, userId: newUserId } = responseData

        token.value = newToken
        userId.value = newUserId
        localStorage.setItem(TOKEN_KEY, newToken)
        localStorage.setItem(USER_ID_KEY, String(newUserId))

        return { success: true }
      } else {
        if (
          code === 1001 ||
          code === 1000 ||
          /invalid authentication token/i.test(String(msg || ''))
        ) {
          logout()
        } else {
          console.error('[Auth] Token 刷新失败:', msg)
        }
        return {
          success: false,
          message: msg || i18n.global.t('auth.tokenRefreshFailed'),
        }
      }
    } catch (error: any) {
      console.error('[Auth] Token 刷新异常:', error)
      if (
        error.response?.data?.code === 1001 ||
        error.response?.data?.code === 1000
      ) {
        logout()
      }
      return {
        success: false,
        message:
          error.response?.data?.msg ||
          error.message ||
          i18n.global.t('auth.tokenRefreshFailed'),
      }
    }
  }

  /**
   * Try to obtain a token via auto-login (only available when IS_CLIENT=1).
   */
  const tryAutoLogin = async (): Promise<boolean> => {
    try {
      console.log(`[DIAG:auth] tryAutoLogin calling /login/auto...`)
      const response = await axios.post(
        resolveApiPath('/login/auto'),
        {},
        { timeout: AUTO_LOGIN_TIMEOUT }
      )
      const { code, data: responseData, msg } = response.data
      console.log(
        `[DIAG:auth] tryAutoLogin response: code=${code} hasToken=${!!responseData?.token} msg=${msg}`
      )
      if (code === 0 && responseData?.token) {
        const { token: newToken, userId: newUserId } = responseData
        token.value = newToken
        userId.value = newUserId
        localStorage.setItem(TOKEN_KEY, newToken)
        localStorage.setItem(USER_ID_KEY, String(newUserId))
        isInitialized.value = true
        startAutoRefresh()
        console.log(
          `[DIAG:auth] tryAutoLogin SUCCESS, token=${newToken.substring(0, 20)}...`
        )
        return true
      }
      console.warn(
        `[Auth] tryAutoLogin unexpected response: code=${code} msg=${msg}`
      )
    } catch (err) {
      console.warn('[Auth] tryAutoLogin failed:', err)
    }
    return false
  }

  /**
   * Auto login: attempt to refresh authentication using stored token on startup.
   * If already initialized or has token, skip to avoid duplicate calls.
   * @param viewMode - If provided, auto-login is only attempted when viewMode === 'client'.
   */
  const autoLogin = async (viewMode?: string): Promise<boolean> => {
    console.log(
      `[DIAG:auth] autoLogin called viewMode=${viewMode} hasToken=${!!token.value} isInit=${isInitialized.value}`
    )
    if (isInitialized.value || token.value) {
      console.log(
        `[DIAG:auth] autoLogin skip (init=${isInitialized.value} token=${!!token.value})`
      )
      return isAuthenticated.value
    }

    if (!token.value) {
      // /login/auto only works in client mode; skip for web/webComponent.
      if (viewMode !== undefined && viewMode !== 'client') {
        console.log(
          `[DIAG:auth] autoLogin skip (viewMode=${viewMode} not client)`
        )
        isInitialized.value = true
        return false
      }
      console.log(`[DIAG:auth] autoLogin -> tryAutoLogin`)
      const autoResult = await tryAutoLogin()
      if (!autoResult) isInitialized.value = true
      return autoResult
    }

    console.log(`[DIAG:auth] autoLogin has token, calling refreshToken`)
    const result = await refreshToken()
    isInitialized.value = true

    if (result.success) {
      startAutoRefresh()
      return true
    }

    // Token refresh failed — try auto-login as fallback
    console.log(
      `[DIAG:auth] autoLogin refresh failed, fallback to tryAutoLogin`
    )
    const autoResult = await tryAutoLogin()
    return autoResult
  }

  /**
   * Start auto-refresh timer (refresh every hour)
   */
  const startAutoRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }

    if (!token.value) {
      return
    }

    refreshTimer = setInterval(() => {
      if (token.value) {
        refreshToken()
      } else {
        stopAutoRefresh()
      }
    }, REFRESH_INTERVAL)
  }

  /**
   * Stop auto-refresh timer
   */
  const stopAutoRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
      console.log('[Auth] 停止自动刷新定时器')
    }
  }

  /**
   * Get Authorization header
   */
  const getAuthHeader = () => {
    if (token.value) {
      return `Bearer ${token.value}`
    }
    return null
  }

  return {
    token,
    userId,
    isAuthenticated,
    isInitialized,
    login,
    logout,
    refreshToken,
    tryAutoLogin,
    autoLogin,
    startAutoRefresh,
    stopAutoRefresh,
    getAuthHeader,
  }
})
