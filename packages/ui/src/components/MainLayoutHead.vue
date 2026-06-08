<template>
  <!-- Only render in Electron/Client mode, detected by window.__api -->
  <div
    v-if="hasAPI"
    ref="headRef"
    class="main-layout-head"
    :class="{ mac: isMac }"
  >
    <!-- Drag region (applies to whole bar on macOS, left portion on others) -->
    <div class="drag-region">
      <div class="head-title">
        {{ appConfig.title
        }}<span v-if="badgeText" class="edition-badge">{{ badgeText }}</span>
      </div>
    </div>

    <!-- Window controls (non-macOS: frame:false custom buttons) -->
    <div v-if="!isMac" class="window-controls no-drag">
      <button
        class="ctrl-btn ctrl-minimize"
        title="Minimize"
        @click="minimizeWin"
      >
        <MinusIcon class="w-3 h-3" />
      </button>
      <button
        class="ctrl-btn ctrl-maximize"
        :title="isMaximized ? 'Restore' : 'Maximize'"
        @click="toggleMaxWin"
      >
        <MaximizeIcon v-if="!isMaximized" class="w-3 h-3" />
        <Minimize2Icon v-else class="w-3 h-3" />
      </button>
      <button class="ctrl-btn ctrl-close" title="Close" @click="closeWin">
        <XIcon class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MinusIcon from '~icons/lucide/minus'
import MaximizeIcon from '~icons/lucide/maximize-2'
import Minimize2Icon from '~icons/lucide/minimize-2'
import XIcon from '~icons/lucide/x'
import { AppConfig } from '../config'
import { useAppEnvComputed } from '../composables/setting'

const { badgeText } = useAppEnvComputed()
const appConfig = AppConfig

// ── Detect Electron via window.__api ────────────────────────────────────
const hasAPI = ref(false)
const isMac = ref(false)

// ── Maximize state (non-macOS) ──────────────────────────────────────────
const isMaximized = ref(false)

function callApi(name: string, ...args: any[]) {
  return window.__api?.call(name, ...args)
}

function minimizeWin() {
  callApi('minimize')
}
function toggleMaxWin() {
  callApi('maximize')
}
function closeWin() {
  callApi('close')
}

onMounted(async () => {
  const api = window.__api
  if (!api) return
  hasAPI.value = true
  isMac.value = navigator.platform?.toLowerCase().includes('mac') ?? false

  // Query initial maximize state (non-macOS with frame:false)
  if (!isMac.value) {
    isMaximized.value = (await callApi('isMaximized')) ?? false
  }

  // Listen for maximize/unmaximize changes
  api.eval('maximize-change', (maximized: boolean) => {
    isMaximized.value = maximized
  })
})
</script>

<style scoped>
.main-layout-head {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 9999;
  /* Drag region is on .drag-region only, NOT here, so window controls stay clickable */
  user-select: none;
}

/* On macOS, the bar is transparent (native traffic lights are inset) */
.main-layout-head.mac {
  background: transparent;
  pointer-events: none;
}
.main-layout-head.mac .drag-region {
  pointer-events: auto;
}
.main-layout-head.mac .window-controls {
  pointer-events: auto;
}

.drag-region {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: drag;
}

/* On macOS, leave room for native traffic lights (~70px) */
.main-layout-head.mac .drag-region {
  padding-left: 76px;
}
.main-layout-head:not(.mac) .drag-region {
  padding-left: 12px;
}

.head-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.6);
  letter-spacing: -0.3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.edition-badge {
  font-size: 10px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 0 5px;
  line-height: 16px;
  letter-spacing: 0;
}

/* ── Window controls (non-macOS) ── */
.window-controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.ctrl-btn {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.55);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
  outline: none;
}
.ctrl-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}
.ctrl-btn:active {
  background: rgba(0, 0, 0, 0.1);
}
.ctrl-close:hover {
  background: #e81123;
  color: #fff;
}
</style>
