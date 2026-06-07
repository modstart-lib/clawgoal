<script setup lang="ts">
import AgentDetailChat from '@/claw/views/Agent/AgentDetail/AgentDetailChat.vue'
import AgentDetailChatSessionModal from '@/claw/views/Agent/AgentDetail/AgentDetailChatSessionModal.vue'
import Bot from '~icons/lucide/bot'
import History from '~icons/lucide/history'
import { onMounted, onUnmounted, ref } from 'vue'
import { testActionSet, testActionUnset } from '@/utils/test'

withDefaults(
  defineProps<{
    visible: boolean
    /** Modal 标题，通常为 "agentTitle · taskTitle" */
    title?: string
    agentId: number
    agentTitle: string
    agentAvatar?: string | null
    /** 初始显示的会话 ID，0 表示使用最近一个会话 */
    sessionId?: number
    /** 聊天区域高度，默认 520px */
    chatHeight?: number | string
    /** Modal 宽度，默认 720 */
    width?: number | string
  }>(),
  {
    sessionId: 0,
    chatHeight: 520,
    width: 720,
    title: undefined,
    agentAvatar: null,
  }
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const showSessionModal = ref(false)
const chatRef = ref<InstanceType<typeof AgentDetailChat>>()

const handleClose = () => emit('update:visible', false)

const handleSwitchSession = (sessionId: number) => {
  chatRef.value?.handleSwitchSession(sessionId)
  showSessionModal.value = false
}

onMounted(() => {
  testActionSet('modal.openSessions', () => {
    showSessionModal.value = true
  })
  testActionSet('modal.close', () => handleClose())
})
onUnmounted(() => {
  testActionUnset('modal.openSessions')
  testActionUnset('modal.close')
})
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="visible"
    :footer="null"
    :width="width"
    :body-style="{ padding: '0' }"
    destroy-on-close
    @cancel="handleClose"
  >
    <template #title>
      <div class="flex items-center justify-between gap-2 pr-6">
        <div class="flex items-center gap-2 min-w-0">
          <img
            v-if="agentAvatar"
            :src="agentAvatar"
            class="w-6 h-6 rounded-full object-cover shrink-0"
            alt=""
          />
          <Bot
            v-else
            class="w-5 h-5 text-gray-400 shrink-0"
            aria-hidden="true"
          />
          <span class="truncate">{{ title ?? agentTitle }}</span>
        </div>
        <a-button
          class="inline-flex items-center shrink-0"
          @click.stop="showSessionModal = true"
        >
          <History class="w-4 h-4 text-gray-500" aria-hidden="true" />
        </a-button>
      </div>
    </template>
    <AgentDetailChat
      v-if="visible"
      ref="chatRef"
      :agent-id="agentId"
      :agent-title="agentTitle"
      :agent-avatar="agentAvatar"
      :session-id="sessionId"
      :show-header="false"
      :style="{
        height: typeof chatHeight === 'number' ? `${chatHeight}px` : chatHeight,
      }"
    />
  </a-modal>

  <AgentDetailChatSessionModal
    v-model:open="showSessionModal"
    :agent-id="agentId"
    :current-session-id="chatRef?.currentSessionId ?? 0"
    @switch="handleSwitchSession"
  />
</template>
