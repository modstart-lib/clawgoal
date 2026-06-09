<template>
  <!-- 统一使用 StyleProvider 包裹，降低 Ant Design 样式优先级 -->
  <StyleProvider
    :container="styleContainer"
    hash-priority="low"
    :transformers="[transformer]"
  >
    <a-config-provider
      :locale="locale"
      :theme="themeConfig"
      :get-popup-container="getPopupContainer"
      component-size="default"
    >
      <div v-if="routerReady" id="app-root" ref="appRootRef">
        <router-view v-slot="{ Component }">
          <KeepAlive :max="10">
            <component :is="Component" />
          </KeepAlive>
        </router-view>
      </div>
      <div v-else class="router-loading">
        <div class="router-loading__spinner">
          <a-spin size="large" />
        </div>
      </div>
    </a-config-provider>
  </StyleProvider>
</template>

<script setup>
import {
  StyleProvider,
  theme as antTheme,
  legacyLogicalPropertiesTransformer,
} from 'ant-design-vue'
import {
  computed,
  getCurrentInstance,
  inject,
  onMounted,
  onUnmounted,
  ref,
  KeepAlive,
} from 'vue'
import { useTheme } from './composables/theme.js'
import { useLocale } from './composables/locale.js'
import { getAntdZIndexBase } from './utils/zindex'
import { openDevTools, isWailsEnv } from './utils/wails'
import router from './router'

const transformer = legacyLogicalPropertiesTransformer

const localeStore = useLocale()
const locale = computed(() => localeStore.antdLocale)
const appRootRef = ref(null)
const zIndexBase = ref(1000)

const styleContainer = inject('styleContainer', null)

const instance = getCurrentInstance()

const { primaryColor, effectivePrimaryColor, isDark, initTheme } = useTheme()

// Show a loading state until the initial navigation (auth guards + lazy components)
// completes. This prevents a flash of protected content and avoids blocking mount.
const routerReady = ref(false)
router.isReady().then(() => {
  routerReady.value = true
})

onMounted(() => {
  initTheme()

  setTimeout(() => {
    zIndexBase.value = getAntdZIndexBase(100)
  }, 100)

  // Ctrl/Cmd+Shift+H 三次快速按下才打开/切换 DevTools（Wails + Electron）
  const isElectron = typeof window.__api !== 'undefined'
  const devToolsPressTimes = []
  const onKeyDown = (e) => {
    if (e.shiftKey && e.key === 'H' && (e.metaKey || e.ctrlKey)) {
      const now = Date.now()
      devToolsPressTimes.push(now)
      while (
        devToolsPressTimes.length > 0 &&
        devToolsPressTimes[0] < now - 1000
      ) {
        devToolsPressTimes.shift()
      }
      if (devToolsPressTimes.length >= 3) {
        devToolsPressTimes.length = 0
        if (isElectron) {
          window.__api?.call('toggleDevTools')
        } else if (isWailsEnv()) {
          openDevTools()
        }
      }
    }
  }
  window.addEventListener('keydown', onKeyDown)
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
})

const themeConfig = computed(() => ({
  hashed: false, // Disable hash class names to avoid global style pollution
  algorithm: isDark.value ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  token: {
    colorPrimary: effectivePrimaryColor.value, // Use theme-managed color (dark/light adaptive)
    zIndexBase: zIndexBase.value, // Dynamically set z-index base value
    zIndexPopupBase: zIndexBase.value, // z-index base for popup layers
  },
  components: {
    Button: {
      colorPrimary: effectivePrimaryColor.value, // Use theme-managed color
    },
  },
}))
const getPopupContainer = () => {
  // Shadow DOM / web component 场景：向上查找 DocumentFragment（shadow root），
  // 让 popup 挂到 shadow root 内，避免样式泄漏到外层。
  if (instance?.vnode?.el) {
    const el = instance.vnode.el
    let node = el
    while (node) {
      if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        return appRootRef.value || node
      }
      node = node.parentNode || node.host
    }
  }
  // 普通浏览器环境：统一挂到 document.body，
  // 避免 popup/modal portal 的 DOM 清理与 RouterView 的 anchor 操作并发，
  // 引发 insertBefore "anchor is not a child of parent" 错误。
  return document.body
}

// Main App Component
</script>

<style>
/* Global styles are in style.css */

.router-loading {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-loading-bg, #f8fafc);
  z-index: 9999;
  transition: opacity 0.3s;
}

html.dark .router-loading {
  background: var(--app-loading-bg, #09090b);
}

.router-loading__spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
</style>
