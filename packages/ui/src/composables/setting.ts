import axios from 'axios'
import { computed, inject, onMounted, ref, toRef } from 'vue'
import { getAccountCurrent } from '../api/account'
import { defineStore } from 'pinia'
import { getApiBase } from '@/api/client.ts'
import { i18n } from '../locale'

/**
 * 统一应用环境 store
 *
 * 所有环境数据通过一次 /setting/basic 请求获取：
 * - viewMode：'' 独立 Web 应用 | 'webComponent' 嵌入式 Web Component 模式 | 'client' 客户端模式
 * - configuredUrl / siteUrl：公开访问地址（url 字段）
 *
 * 组件内使用：const { viewMode, siteUrl } = useAppEnvComputed()
 */
export const useAppEnv = defineStore('appEnv', () => {
  const serverViewMode = ref('' as '' | 'webComponent' | 'client')
  const configuredUrl = ref('')
  const fetched = ref(false)

  /**
   * Use a bare axios instance (no auth interceptor) so this can be called
   * during app initialization in main.ts BEFORE the user has a token.
   * The apiClient's response interceptor would trigger window.location.href
   * reload on code=1000 (no token), causing an infinite refresh loop.
   */
  const basicAxios = axios.create({ baseURL: getApiBase(), timeout: 10000 })

  async function fetchBasic() {
    if (fetched.value) return
    fetched.value = true
    try {
      const res = await basicAxios.post('/setting/basic')
      serverViewMode.value = res.data?.data?.viewMode || ''
      configuredUrl.value = res.data?.data?.url ?? ''
    } catch {
      /* ignore */
    }
  }

  /** 用户配置的访问地址，未配置时回退到浏览器 origin */
  const siteUrl = computed(
    () =>
      configuredUrl.value ||
      (typeof window !== 'undefined' ? window.location.origin : '')
  )

  return {
    serverViewMode,
    configuredUrl,
    siteUrl,
    fetchBasic,
  }
})

/**
 * 在组件中使用，注入 styleContainer 后 viewMode 才能准确判断。
 * 暴露 viewMode、siteUrl 两个 ComputedRef，替代旧的三个独立 composable。
 */
export function useAppEnvComputed() {
  const styleContainer = inject('styleContainer', null)
  const store = useAppEnv()
  const viewMode = computed((): '' | 'webComponent' | 'client' => {
    if (!!styleContainer || store.serverViewMode === 'webComponent')
      return 'webComponent'
    if (store.serverViewMode === 'client') return 'client'
    return ''
  })
  const siteUrl = computed(() => store.siteUrl)
  const badgeText = ref(i18n.global.t('mainLayout.communityEdition'))


  return {
    viewMode,
    siteUrl,
    badgeText,
    fetchBasic: store.fetchBasic,
  }
}

// ─── 向后兼容 shim ────────────────────────────────────────────────────────────

/** @deprecated 请直接使用 useAppEnvComputed().viewMode */
export function useIsWebComponent() {
  const { viewMode } = useAppEnvComputed()
  return { isWebComponent: computed(() => viewMode.value === 'webComponent') }
}

/** @deprecated 请使用 useAppEnvComputed() */
export const useSettingBasic = defineStore('settingBasic', () => {
  const store = useAppEnv()
  const serverViewMode = computed(() => store.serverViewMode)
  return {
    serverViewMode,
    fetchFromServer: store.fetchBasic,
  }
})

/** @deprecated 请使用 useAppEnvComputed().siteUrl */
export const useSiteUrl = defineStore('siteUrl', () => {
  const store = useAppEnv()
  const configuredUrl = toRef(store, 'configuredUrl')
  return {
    configuredUrl,
    siteUrl: store.siteUrl,
    fetchFromServer: store.fetchBasic,
  }
})

// ─── 其他工具函数 ──────────────────────────────────────────────────────────────

export function useIsSupervisor() {
  const { viewMode } = useAppEnvComputed()
  const isSupervisor = ref(false)

  onMounted(async () => {
    if (viewMode.value === 'webComponent') return
    try {
      const data = await getAccountCurrent()
      isSupervisor.value = data.isSupervisor === true
    } catch {
      // ignore
    }
  })

  return { isSupervisor }
}

export function useIsCreator() {
  const { viewMode } = useAppEnvComputed()
  const isCreator = ref(false)

  onMounted(async () => {
    if (viewMode.value === 'webComponent') return
    try {
      const data = await getAccountCurrent()
      isCreator.value = data.isCreator === true
    } catch {
      // ignore
    }
  })

  return { isCreator }
}

export function useIsDatabaseMode() {
  const { viewMode } = useAppEnvComputed()
  const isDatabaseMode = ref(false)

  onMounted(async () => {
    if (viewMode.value === 'webComponent') return
    try {
      const data = await getAccountCurrent()
      isDatabaseMode.value = data.authType === 'database'
    } catch {
      // ignore
    }
  })

  return { isDatabaseMode }
}
