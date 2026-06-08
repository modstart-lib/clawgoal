<template>
  <div class="dashboard-office">
    <OfficeHeader
      :agents="agents"
      :animating="animating"
      @agent-click="onAgentClick"
      @reset-camera="onResetCamera"
      @zoom-in="onZoomIn"
      @zoom-out="onZoomOut"
    />
    <div ref="canvasContainer" class="canvas-container">
      <canvas ref="canvasRef" class="office-canvas" />
      <DashboardOfficeLoading
        :loading="loading"
        :loaded-count="loadedCount"
        :total-count="totalCount"
      />
      <AgentBubble
        v-for="bubble in handupBubbleList"
        :key="bubble.idx"
        :bubble="bubble"
        @open-chat="onBubbleClick"
      />
    </div>
  </div>

  <AgentChatModal
    v-if="chatTarget"
    v-model:visible="chatModalVisible"
    :title="chatTarget.name"
    :agent-id="Number(chatTarget.id)"
    :agent-title="chatTarget.name"
    :agent-avatar="chatTarget.avatar"
  />
</template>

<script setup lang="ts">
import AgentChatModal from '@/claw/views/Agent/AgentChatModal.vue'
import '@babylonjs/loaders/glTF'
import { onBeforeUnmount, onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OfficeHeader from './Office/components/OfficeHeader.vue'
import AgentBubble from './Office/components/AgentBubble.vue'
import DashboardOfficeLoading from './Office/components/OfficeLoading.vue'
import { OFFICE_CONFIG } from './Office/config'
import { testActionSet, testActionUnset } from '@/utils/test'
import {
  createOfficeContext,
  buildOffice,
  destroyOffice,
  triggerHandup,
  resetCamera,
  zoomIn,
  zoomOut,
  handleWheel,
  randomTest,
  type HandupBubble,
  type AgentView,
} from './Office/office'

const canvasRef = ref<HTMLCanvasElement>()
const canvasContainer = ref<HTMLDivElement>()
const loading = ref(true)
const loadedCount = ref(0)
const totalCount = ref(0)
const animating = ref(true)

const chatModalVisible = ref(false)
const chatTarget = ref<AgentView | null>(null)
const handupBubbleList = ref<HandupBubble[]>([])

// 使用 ctx 持有全部 Office 状态
const ctx = createOfficeContext()

// 暴露给 OfficeHeader 的 agents 视图
const agents = computed(() => ctx.agents)

const { t } = useI18n()

function getHandupText(busy: boolean): string {
  const pool = busy ? t('claw.office.busyTexts') : t('claw.office.idleTexts')
  return pool[Math.floor(Math.random() * pool.length)]
}

function onAgentClick(idx: number) {
  triggerHandup(ctx, idx, handupBubbleList.value, getHandupText, (bubbles) => {
    handupBubbleList.value = bubbles
  })
}

function onBubbleClick(idx: number) {
  const agent = ctx.agents[idx]
  if (!agent) return
  chatTarget.value = agent
  chatModalVisible.value = true
}

function onAgentBodyClick(idx: number) {
  const agent = ctx.agents[idx]
  if (!agent) return
  chatTarget.value = agent
  chatModalVisible.value = true
}

function onResetCamera() {
  resetCamera(ctx)
}
function onZoomIn() {
  zoomIn(ctx)
}
function onZoomOut() {
  zoomOut(ctx)
}

function onWheel(e: WheelEvent) {
  handleWheel(ctx, e)
}
function onResize() {
  ctx.engine?.resize()
}

let randomTestTimer: ReturnType<typeof setInterval> | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  if (!canvasRef.value) return
  canvasRef.value.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('resize', onResize)

  // 监听容器尺寸变化（侧边栏收缩/展开时触发），防止画布被拉伸
  if (canvasContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      ctx.engine?.resize()
    })
    resizeObserver.observe(canvasContainer.value)
  }

  await buildOffice(ctx, canvasRef.value, {
    onLoadProgress: (loaded, total) => {
      loadedCount.value = loaded
      totalCount.value = total
    },
    onBubbleUpdate: (bubbles) => {
      handupBubbleList.value = bubbles
    },
    getHandupText,
    onAgentBodyClick,
  })

  loading.value = false

  if (OFFICE_CONFIG.agentRandomTest) {
    randomTestTimer = setInterval(() => randomTest(ctx), 10_000)
  }

  testActionSet('page.ready', () => {})
})

onBeforeUnmount(() => {
  if (randomTestTimer !== null) {
    clearInterval(randomTestTimer)
    randomTestTimer = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', onResize)
  canvasRef.value?.removeEventListener('wheel', onWheel)
  destroyOffice(ctx)
  testActionUnset('page.ready')
})
</script>

<style scoped src="./Office/style.css" />
