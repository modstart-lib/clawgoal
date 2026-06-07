<template>
  <div
    class="bg-slate-50 dark:bg-[#09090b] relative transition-colors duration-300"
    :class="[
      viewMode === 'webComponent' ? '' : 'min-h-screen',
      viewMode === 'client' ? 'pt-[40px]' : '',
    ]"
  >
    <!-- Custom title bar for Electron client mode -->
    <MainLayoutHead />

    <!-- Premium Ambient Background Decor -->
    <template v-if="viewMode !== 'webComponent'">
      <div
        class="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-400/20 to-purple-400/20 dark:from-indigo-600/10 dark:to-purple-600/10 blur-[80px] animate-float opacity-70 pointer-events-none z-0"
      ></div>
      <div
        class="fixed bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-blue-400/20 to-cyan-400/20 dark:from-blue-600/10 dark:to-cyan-600/10 blur-[80px] animate-float animation-delay-2000 opacity-70 pointer-events-none z-0"
      ></div>
      <div
        class="fixed top-[20%] right-[10%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-pink-400/10 to-orange-400/10 dark:from-pink-600/5 dark:to-orange-600/5 blur-[80px] animate-float animation-delay-4000 opacity-70 pointer-events-none z-0"
      ></div>
      <div
        class="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMTcxLCAxNzEsIDE3MSwgMC4yKSIvPjwvc3ZnPg==')] [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none opacity-50 dark:opacity-30 z-0"
      ></div>
    </template>

    <!-- Debug Panel (fixed, left edge, vertically centered) -->

    <!-- Mobile Top Bar (仅在非 Web Component 且非桌面时显示) -->
    <div
      v-if="viewMode !== 'webComponent'"
      class="md:hidden flex items-center gap-3 px-4 py-3 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border-b border-white/60 dark:border-white/10 sticky top-0 z-30"
    >
      <div
        class="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <XIcon v-if="mobileMenuOpen" class="w-5 h-5" />
        <MenuIcon v-else class="w-5 h-5" />
      </div>
      <img src="@/assets/logo.svg" alt="Logo" class="w-7 h-7" />
      <div
        class="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5"
      >
        {{ appConfig.title }}
        <div v-if="badgeText" class="edition-badge">{{ badgeText }}</div>
      </div>
    </div>

    <!-- Mobile Backdrop -->
    <Transition name="fade">
      <div
        v-if="mobileMenuOpen"
        class="fixed inset-0 bg-black/40 z-40 md:hidden"
        @click="mobileMenuOpen = false"
      />
    </Transition>

    <!-- Page Body -->
    <div
      class="p-2 md:p-3 gap-2 md:gap-3 flex items-start transition-all duration-300 relative"
      :class="[
        viewMode === 'webComponent'
          ? ''
          : collapsed
            ? 'md:pl-[4.5rem]'
            : 'md:pl-[14.5rem]',
        viewMode === 'client' ? 'md:pt-0 pt-0' : '',
      ]"
    >
      <!-- Sidebar Card -->
      <aside
        class="bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl md:rounded-2xl border border-gray-100 dark:border-gray-800/70 shrink-0 flex flex-col fixed left-0 z-50 transition-all duration-300 font-[system-ui,'Inter','PingFang_SC',sans-serif]"
        :class="[
          viewMode === 'client'
            ? 'top-[40px] h-[calc(100vh-40px)]'
            : 'top-0 h-full',
          mobileMenuOpen
            ? 'translate-x-0'
            : '-translate-x-full md:translate-x-0',
          collapsed ? 'w-14' : 'w-52',
          viewMode === 'webComponent'
            ? 'md:relative md:top-auto md:left-auto md:z-auto md:h-auto'
            : 'md:left-3',
          viewMode === 'client'
            ? 'md:top-40px md:h-[calc(100vh-0.75rem-40px)]'
            : 'md:top-3 md:h-[calc(100vh-0.75rem)]',
        ]"
      >
        <!-- Logo Area (仅在非 Web Component 模式下显示) -->
        <div
          v-if="viewMode !== 'webComponent'"
          class="h-20 flex items-center relative"
          :class="collapsed ? 'justify-center px-0' : 'px-6'"
        >
          <div
            class="flex items-center gap-2 overflow-hidden cursor-pointer"
            @click="router.push(typeHomeMap[activeType] || '/')"
          >
            <div class="shrink-0">
              <img src="@/assets/logo.svg" alt="Logo" class="w-10 h-10" />
            </div>
            <div
              v-if="!collapsed"
              class="text-xl font-bold text-primary tracking-tight truncate"
            >
              {{ appConfig.title }}
            </div>
          </div>
        </div>

        <!-- 菜单项 -->
        <div class="flex flex-1 overflow-hidden min-h-0 px-3">
          <!-- 菜单项 -->
          <nav
            class="py-2 flex-1 overflow-y-auto custom-scrollbar"
            :class="collapsed ? 'px-0' : 'px-2'"
          >
            <div class="space-y-1">
              <div v-for="item in menuItems" :key="item.key">
                <!-- Divider -->
                <div
                  v-if="item.type === 'divider'"
                  class="my-1.5 mx-2 border-t border-gray-200/50 dark:border-gray-700/50"
                />
                <a-tooltip
                  v-else-if="collapsed"
                  :title="item.label"
                  placement="right"
                >
                  <div
                    class="w-full flex items-center justify-center py-2.5 rounded-lg transition-all duration-200 group relative cursor-pointer"
                    :class="[
                      activeKey === item.key
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300',
                    ]"
                    @click="handleMenuClick(item.key)"
                  >
                    <component
                      :is="item.icon"
                      class="w-5 h-5 transition-colors"
                      :class="
                        activeKey === item.key
                          ? 'text-primary'
                          : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                      "
                    />
                  </div>
                </a-tooltip>
                <div
                  v-else-if="!item.type"
                  class="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-200 group relative cursor-pointer"
                  :class="[
                    activeKey === item.key
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300',
                  ]"
                  @click="handleMenuClick(item.key)"
                >
                  <component
                    :is="item.icon"
                    class="w-[18px] h-[18px] shrink-0 transition-colors"
                    :class="
                      activeKey === item.key
                        ? 'text-primary'
                        : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                    "
                  />
                  <span
                    class="text-[13.5px] leading-5 truncate"
                    :class="
                      activeKey === item.key ? 'font-semibold' : 'font-medium'
                    "
                    >{{ item.label }}</span
                  >
                </div>
              </div>
            </div>
          </nav>
        </div>

        <!-- User / Settings -->
        <div
          v-if="viewMode !== 'webComponent'"
          class="px-2 py-3 mt-1 border-t border-gray-100 dark:border-gray-800/60 flex items-center"
          :class="
            collapsed ? 'flex-col gap-1 justify-center' : 'justify-around'
          "
        >
          <!-- 用户登录 -->
          <a-tooltip :title="$t('mainLayout.feedback')" placement="right">
            <div
              class="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 group relative cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              @click="feedbackVisible = true"
            >
              <MessageSquareIcon
                class="w-5 h-5 transition-colors text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
              />
            </div>
          </a-tooltip>
          <a-tooltip :title="$t('mainLayout.setting')" placement="right">
            <div
              class="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 group relative cursor-pointer"
              :class="
                activeKey === 'settings'
                  ? 'bg-primary/10'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              "
              @click="handleSettingsClick"
            >
              <SettingsIcon
                class="w-5 h-5 transition-colors"
                :class="
                  activeKey === 'setting'
                    ? 'text-primary'
                    : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                "
              />
            </div>
          </a-tooltip>
        </div>
        <div
          v-if="badgeText && !collapsed"
          class="edition-badge absolute top-3 right-8"
        >
          {{ badgeText }}
        </div>
      </aside>

      <!-- 收缩/展开细长条：固定在 sidebar 右侧边缘垂直居中 (仅桌面显示) -->
      <a-tooltip
        v-if="viewMode !== 'webComponent'"
        :title="collapsed ? $t('nav.expandMenu') : $t('nav.collapseMenu')"
        placement="right"
      >
        <div
          class="hidden md:flex fixed -translate-x-1/2 z-50 cursor-pointer flex-col items-center justify-center w-[6px] h-14 rounded-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-gray-700/80 shadow-sm overflow-hidden transition-all duration-200 hover:w-[16px] hover:border-primary/50 hover:shadow-md group"
          :class="
            viewMode === 'client'
              ? 'top-[calc(40px+50%)] -translate-y-1/2'
              : 'top-1/2 -translate-y-1/2'
          "
          :style="
            collapsed
              ? 'left: calc(3.5rem + 0.75rem)'
              : 'left: calc(13rem + 0.75rem)'
          "
          @click="toggleCollapsed"
        >
          <ChevronLeftIcon
            v-if="!collapsed"
            class="w-3 h-3 text-gray-400 dark:text-gray-500 group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          />
          <ChevronRightIcon
            v-else
            class="w-3 h-3 text-gray-400 dark:text-gray-500 group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          />
        </div>
      </a-tooltip>

      <!-- Main Content Card -->
      <main
        class="flex-1 relative min-w-0 overflow-x-clip"
        :class="[
          isFullscreenRoute
            ? (viewMode === 'client'
                ? 'h-[calc(100vh-0.95rem-40px)]'
                : 'h-[calc(100vh-0.95rem)]') + ' rounded-lg overflow-hidden'
            : (viewMode === 'client'
                ? 'min-h-[calc(100vh-0.95rem-40px)]'
                : 'min-h-[calc(100vh-0.95rem)]') +
              ' bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/60 dark:border-white/10',
          viewMode === 'webComponent' ? 'overflow-hidden flex flex-col' : '',
        ]"
      >
        <div
          :class="[
            isFullscreenRoute ? 'h-full' : 'p-3 md:p-4',
            viewMode === 'webComponent'
              ? 'flex-1 overflow-auto custom-scrollbar'
              : '',
          ]"
        >
          <div
            :class="
              isFullscreenRoute ? 'h-full w-full' : 'w-full max-w-7xl mx-auto'
            "
          >
            <RouterView v-slot="{ Component, route: currentRoute }">
              <KeepAlive v-if="currentRoute.meta.keepAlive">
                <component :is="Component" :key="String(currentRoute.name)" />
              </KeepAlive>
              <component :is="Component" v-else />
            </RouterView>
          </div>
        </div>
      </main>
    </div>

    <!-- User Login Modal -->
    <FeedbackModal v-model:open="feedbackVisible" />
    <UpgradePanel auto-check />
  </div>
  <!-- WebSocket 连接状态胶囊（仅非连接时显示） -->
  <Transition name="ws-status">
    <div
      v-if="wsStatus !== 'connected'"
      class="fixed top-3 right-3 z-[9999] flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm border backdrop-blur-sm select-none pointer-events-none"
      :class="{
        'bg-red-50/90 border-red-200 text-red-600 dark:bg-red-950/80 dark:border-red-800 dark:text-red-400':
          wsStatus === 'disconnected',
        'bg-yellow-50/90 border-yellow-200 text-yellow-600 dark:bg-yellow-950/80 dark:border-yellow-800 dark:text-yellow-400':
          wsStatus === 'connecting',
      }"
    >
      <span
        class="w-1.5 h-1.5 rounded-full shrink-0"
        :class="{
          'bg-red-500': wsStatus === 'disconnected',
          'bg-yellow-400 animate-pulse': wsStatus === 'connecting',
        }"
      />
      {{ wsStatusLabel }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MenuIcon from '~icons/lucide/menu'
import ChevronLeftIcon from '~icons/lucide/chevron-left'
import ChevronRightIcon from '~icons/lucide/chevron-right'
import SettingsIcon from '~icons/lucide/settings'
import XIcon from '~icons/lucide/x'
import MessageSquareIcon from '~icons/lucide/message-square'
import { AppConfig } from './config'
import FeedbackModal from './components/FeedbackModal.vue'
import UpgradePanel from './components/UpgradePanel.vue'

import { useClaw } from '../../ui-claw/src/config'
import { useAuth } from './composables/auth.ts'
import { systemWs } from './utils/system'
import { eventBus } from './utils/eventBus'
import { useAppEnvComputed } from '@/composables/setting.ts'
import MainLayoutHead from './components/MainLayoutHead.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuth()
const { viewMode: serverViewMode, badgeText } = useAppEnvComputed()

// Merge server viewMode with local client-side Electron detection
const viewMode = computed(() => {
  if (serverViewMode.value === 'webComponent') return 'webComponent'
  if (serverViewMode.value === 'client') return 'client'
  if (typeof window.__api !== 'undefined') return 'client'
  return ''
})
const { t } = useI18n()
const appConfig = AppConfig
const mobileMenuOpen = ref(false)

// 在 setup 中捕获编译时常量，供模板使用（Vite define 仅替换裸标识符）
const hidePro = __HIDE_PRO__

const wsStatus = systemWs.status
const wsStatusLabel = computed(() => {
  if (wsStatus.value === 'connected') return t('mainLayout.wsConnected')
  if (wsStatus.value === 'connecting') return t('mainLayout.wsConnecting')
  return t('mainLayout.wsDisconnected')
})
const collapsed = ref(
  localStorage.getItem(AppConfig.storageKeys.sidebarCollapsed) === 'true'
)

const feedbackVisible = ref(false)

const allModules = [
  useClaw(),
]

const availableTypes = allModules
  .filter((m) => m.homeMode !== null)
  .map((m) => ({ key: m.key, label: m.label }))

const activeType = ref(
  localStorage.getItem(AppConfig.storageKeys.sidebarActiveType) ||
    availableTypes[0]?.key ||
    ''
)

const toggleCollapsed = () => {
  collapsed.value = !collapsed.value
  localStorage.setItem(
    AppConfig.storageKeys.sidebarCollapsed,
    String(collapsed.value)
  )
}

const isFullscreenRoute = computed(() => !!route.meta?.fullscreen)

const modeMenuMap = computed(() => {
  const map: Record<string, any> = {}
  const allItems: any[] = []
  allModules.forEach((m, i) => {
    map[m.key] = m.getMenuItems(t)
    allItems.push(...map[m.key])
    if (i < allModules.length - 1)
      allItems.push({ key: `divider-${i + 1}`, type: 'divider' })
  })
  map['all'] = allItems
  return map
})

const menuItems = computed(() => {
  return modeMenuMap.value[activeType.value] ?? []
})

// 根据当前路由名称计算活跃菜单键
const activeKey = computed((): string => {
  const validItems = menuItems.value.filter((i: any) => !i.type)
  const fallback = validItems[0]?.key ?? 'products'
  if (!route.name) return fallback
  const n = route.name.toString()
  for (const m of allModules) {
    const key = m.getActiveKey(n, route.params as Record<string, string>)
    if (
      key &&
      (key === 'setting' || validItems.some((i: any) => i.key === key))
    )
      return key
  }
  return fallback
})

// 路由切换时关闭移动端菜单
watch(
  () => route.name,
  () => {
    mobileMenuOpen.value = false
  }
)

watch(
  () => route.path,
  (path) => {
    for (const m of allModules) {
      if (path.startsWith(m.pathPrefix)) {
        activeType.value = m.key
        break
      }
    }
  },
  { immediate: true }
)
watch(activeType, (val) => {
  localStorage.setItem(AppConfig.storageKeys.sidebarActiveType, val)
})

const allRouteMap = allModules.reduce(
  (acc, m) => ({ ...acc, ...m.routeMap }),
  {} as Record<string, string>
)

const typeHomeMap: Record<string, string> = allModules.reduce(
  (acc, m) => ({ ...acc, [m.key]: m.homePath }),
  {} as Record<string, string>
)

const handleTypeSwitch = (key: string) => {
  activeType.value = key
  const currentModule = allModules.find((m) => m.key === key)
  if (currentModule && (currentModule as any).onTypeSwitch) {
    ;(currentModule as any).onTypeSwitch()
  }
  const home = typeHomeMap[key]
  if (home) router.push(home)
}

const handleMenuClick = (key: string) => {
  // Allow modules to override menu click handling (e.g. dynamic project routes)
  const currentModule = allModules.find((m) => m.key === activeType.value)
  if (currentModule && (currentModule as any).handleMenuClick) {
    const handled = (currentModule as any).handleMenuClick(
      key,
      (path: string) => router.push(path)
    )
    if (handled) {
      mobileMenuOpen.value = false
      return
    }
  }
  const path = allRouteMap[key]
  if (path) router.push(path)
  mobileMenuOpen.value = false
}

const handleSettingsClick = () => {
  const currentModule = allModules.find((m) => m.key === activeType.value)
  const settingPath = (currentModule as any)?.settingPath
  if (settingPath) {
    router.push(settingPath)
    mobileMenuOpen.value = false
  }
}

onMounted(() => {
  const token = authStore.token
  if (token) systemWs.connect(token)
})
</script>

<style scoped>
.edition-badge {
  font-size: 10px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 0 3px;
  line-height: 16px;
  letter-spacing: 0;
  transform: scale(0.8);
}

@keyframes float {
  0% {
    transform: translate(0px, 0px) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0px, 0px) scale(1);
  }
}

.animate-float {
  animation: float 10s infinite alternate ease-in-out;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

/* Hide scrollbar for type switcher */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Backdrop fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* WS status capsule transition */
.ws-status-enter-active,
.ws-status-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.ws-status-enter-from,
.ws-status-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Custom Scrollbar for Webkit */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #4b5563;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
