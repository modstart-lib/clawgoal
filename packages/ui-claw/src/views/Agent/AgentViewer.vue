<script setup lang="ts">
import AgentChatModal from '@/claw/views/Agent/AgentChatModal.vue'
import { ref } from 'vue'
import Bot from '~icons/lucide/bot'

defineProps<{
  agentId?: number | string | null
  agentTitle?: string
  agentAvatar?: string | null
  /** 弹窗初始显示的会话 ID */
  sessionId?: number
}>()

const chatVisible = ref(false)

const handleClick = () => {
  chatVisible.value = true
}
</script>

<template>
  <div
    class="flex items-center gap-1.5 min-w-0 overflow-hidden cursor-pointer hover:opacity-75"
    @click.stop="handleClick"
  >
    <div>
      <img
        v-if="agentAvatar"
        :src="agentAvatar"
        class="w-5 h-5 rounded-full object-cover shrink-0"
        alt=""
      />
      <Bot v-else class="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
    </div>
    <span class="text-gray-600 dark:text-gray-300 truncate min-w-0">{{
      agentTitle
    }}</span>
    <AgentChatModal
      v-if="agentId"
      :visible="chatVisible"
      :agent-id="Number(agentId)"
      :agent-title="agentTitle ?? ''"
      :agent-avatar="agentAvatar"
      :session-id="sessionId"
      @update:visible="chatVisible = $event"
    />
  </div>
</template>
