<template>
  <div class="office-header">
    <div class="office-title h-10">
      <div
        class="inline-flex items-center gap-1.5 px-2.5 py-1 flex-shrink-0 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100/60 shadow-sm"
      >
        <Users class="w-3.5 h-3.5" />
        <span class="text-xs font-medium whitespace-nowrap">
          {{ t('claw.office.agentCount', { count: agentCount }) }}
        </span>
      </div>
      <div class="agent-list-wrapper">
        <div
          class="agent-fade agent-fade-left"
          :class="{ visible: canScrollLeft }"
        />
        <div
          class="agent-fade agent-fade-right"
          :class="{ visible: canScrollRight }"
        />
        <div
          ref="listRef"
          class="agent-inline-list"
          :class="{ 'is-dragging': isDragging }"
          @mousedown="onMouseDown"
          @scroll="onScroll"
        >
          <div
            v-for="agent in sortedAgents"
            :key="agent.id"
            class="agent-inline-item"
            @click="emit('agent-click', props.agents.indexOf(agent))"
          >
            <div
              class="agent-avatar"
              :style="agent.avatar ? {} : { background: agent.color }"
            >
              <img
                v-if="agent.avatar"
                :src="agent.avatar"
                class="w-full h-full object-cover"
                alt=""
              />
              <span v-else>{{ agent.name.charAt(0) }}</span>
            </div>
            <div class="agent-inline-info">
              <span class="agent-inline-name">{{ agent.name }}</span>
              <span class="agent-status-row">
                <span
                  class="agent-status-dot"
                  :class="agent.busy ? 'dot-busy' : 'dot-idle'"
                />
                <span
                  class="agent-status-text"
                  :class="agent.busy ? 'text-busy' : 'text-idle'"
                  >{{
                    agent.busy
                      ? t('claw.office.agentBusy')
                      : t('claw.office.agentIdle')
                  }}</span
                >
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="office-controls flex-shrink-0">
      <a-button-group>
        <a-tooltip :title="t('claw.office.resetCamera')">
          <a-button
            class="inline-flex items-center"
            @click="emit('reset-camera')"
          >
            <RotateCcw class="w-4 h-4" aria-hidden="true" />
          </a-button>
        </a-tooltip>
        <a-tooltip :title="t('claw.office.zoomIn')">
          <a-button class="inline-flex items-center" @click="emit('zoom-in')">
            <ZoomIn class="w-4 h-4" aria-hidden="true" />
          </a-button>
        </a-tooltip>
        <a-tooltip :title="t('claw.office.zoomOut')">
          <a-button class="inline-flex items-center" @click="emit('zoom-out')">
            <ZoomOut class="w-4 h-4" aria-hidden="true" />
          </a-button>
        </a-tooltip>
      </a-button-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import RotateCcw from '~icons/lucide/rotate-ccw'
import ZoomIn from '~icons/lucide/zoom-in'
import ZoomOut from '~icons/lucide/zoom-out'
import Users from '~icons/lucide/users'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface AgentView {
  id: string
  name: string
  color: string
  busy: boolean
  avatar: string | null
}

const props = defineProps<{
  agents: AgentView[]
}>()

const emit = defineEmits<{
  'agent-click': [index: number]
  'reset-camera': []
  'zoom-in': []
  'zoom-out': []
}>()

const agentCount = computed(() => props.agents.length)

const { t } = useI18n()

const sortedAgents = computed(() =>
  [...props.agents].sort((a, b) => (b.busy ? 1 : 0) - (a.busy ? 1 : 0))
)

const listRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
let startX = 0
let scrollLeft = 0
let moved = false

function updateFade() {
  const el = listRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 0
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function onScroll() {
  updateFade()
}

onMounted(() => {
  updateFade()
})

function onMouseDown(e: MouseEvent) {
  if (!listRef.value) return
  isDragging.value = true
  moved = false
  startX = e.pageX - listRef.value.offsetLeft
  scrollLeft = listRef.value.scrollLeft

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.value || !listRef.value) return
    const x = e.pageX - listRef.value.offsetLeft
    const delta = x - startX
    if (Math.abs(delta) > 3) moved = true
    listRef.value.scrollLeft = scrollLeft - delta
  }

  const onMouseUp = () => {
    isDragging.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    if (moved) {
      // prevent click from firing after drag
      window.addEventListener('click', (e) => e.stopPropagation(), {
        capture: true,
        once: true,
      })
    }
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.office-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.office-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  padding: 0 10px;
}

.agent-list-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.agent-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 32px;
  pointer-events: none;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.2s;
}

.agent-fade.visible {
  opacity: 1;
}

.agent-fade-left {
  left: 0;
  background: linear-gradient(to right, rgba(255, 255, 255, 0.9), transparent);
}

.agent-fade-right {
  right: 0;
  background: linear-gradient(to left, rgba(255, 255, 255, 0.9), transparent);
}

.office-controls {
  display: flex;
  flex-shrink: 0;
}

.agent-inline-list {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.agent-inline-list::-webkit-scrollbar {
  display: none;
}

.agent-inline-list.is-dragging {
  cursor: grabbing;
  user-select: none;
}

.agent-inline-list:not(.is-dragging) {
  cursor: grab;
}

.agent-inline-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 4px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(0, 0, 0, 0.06);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.agent-inline-item:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.2);
}

.agent-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0;
}

.agent-inline-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  overflow: hidden;
}

.agent-inline-name {
  color: #374151;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.agent-status-row {
  display: flex;
  align-items: center;
  gap: 3px;
}

.agent-status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-busy {
  background: #f59e0b;
}

.dot-idle {
  background: #10b981;
}

.agent-status-text {
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.4;
}

.text-busy {
  color: #d97706;
}

.text-idle {
  color: #059669;
}
</style>
