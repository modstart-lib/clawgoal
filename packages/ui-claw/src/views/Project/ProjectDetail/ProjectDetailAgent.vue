<script setup lang="ts">
import { useAgentStore } from '@/claw/stores/agent'
import AgentList from '@/claw/components/AgentList.vue'
import EmptyStateTiny from '@/components/EmptyStateTiny.vue'
import type { Agent } from '@/types'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { systemWs } from '@/utils/system'
import AgentDetailChat from '@/claw/views/Agent/AgentDetail/AgentDetailChat.vue'
import Bot from '~icons/lucide/bot'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()
const props = defineProps<{ projectId: number }>()

const {
  agents: allAgents,
  load: loadAgents,
  refresh: refreshAgents,
} = useAgentStore()
const agents = computed(() =>
  allAgents.value.filter((a) => a.projectId === props.projectId)
)
const selectedAgent = ref<Agent | null>(null)
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    await loadAgents()
    if (agents.value.length > 0) selectedAgent.value = agents.value[0]
  } finally {
    loading.value = false
  }
  systemWs.on('claw:agent:updated', onAgentUpdated)
  testActionSet('agents.refresh', () => refreshAgents())
  testActionSet('agents.selectFirst', () => {
    if (agents.value.length > 0) selectedAgent.value = agents.value[0]
  })
})

onUnmounted(() => {
  systemWs.off('claw:agent:updated', onAgentUpdated)
  testActionUnset('agents.refresh')
  testActionUnset('agents.selectFirst')
})

async function onAgentUpdated() {
  await refreshAgents()
}

function handleAgentUpdated(patch: Partial<Agent>) {
  if (selectedAgent.value) Object.assign(selectedAgent.value, patch)
}
</script>

<template>
  <div class="flex h-full min-h-[calc(100vh-9em)]">
    <!-- 左侧 Agent 列表 -->
    <div
      class="hidden md:flex w-52 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col overflow-hidden"
    >
      <div v-if="loading" class="p-3 text-sm text-gray-400">
        {{ t('common.loading') }}
      </div>
      <EmptyStateTiny
        v-else-if="agents.length === 0"
        :description="t('claw.project.agentEmpty')"
        :icon="Bot"
      />
      <AgentList
        v-else
        :agents="agents"
        :selected-id="selectedAgent?.id"
        @select="selectedAgent = $event"
      />
    </div>

    <!-- 右侧聊天区 -->
    <div class="flex-1 min-w-0">
      <AgentDetailChat
        v-if="selectedAgent"
        :key="String(selectedAgent.id)"
        :agent-id="Number(selectedAgent.id)"
        :agent-title="selectedAgent.title"
        :agent-avatar="selectedAgent.avatar ?? null"
        :agent="selectedAgent"
        @updated="handleAgentUpdated"
      />
      <EmptyStateTiny
        v-else
        :description="t('claw.project.agentEmpty')"
        :icon="Bot"
        class="h-full"
      />
    </div>
  </div>
</template>
