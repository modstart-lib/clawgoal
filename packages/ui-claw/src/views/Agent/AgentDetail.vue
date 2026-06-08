<script setup lang="ts">
import { useAgentStore } from '@/claw/stores/agent'
import AgentList from '@/claw/components/AgentList.vue'
import type { Agent } from '@/types'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { systemWs } from '@/utils/system'
import ChevronLeft from '~icons/lucide/chevron-left'
import Loader2 from '~icons/lucide/loader-2'
import AgentDetailChat from './AgentDetail/AgentDetailChat.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const route = useRoute()
const router = useRouter()

const agentId = ref(route.params.id as string)
const agent = ref<Agent | null>(null)
const loading = ref(true)

const {
  agents,
  load: loadAgents,
  refresh: refreshAgents,
  getById,
} = useAgentStore()

async function loadAgent(id: string) {
  loading.value = true
  agent.value = null
  try {
    await loadAgents()
    agent.value = getById(id) ?? null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadAgent(agentId.value)
  systemWs.on('claw:agent:updated', onAgentUpdated)
  testActionSet('page.ready', () => {})
})

onUnmounted(() => {
  systemWs.off('claw:agent:updated', onAgentUpdated)
  testActionUnset('page.ready')
})

watch(
  () => route.params.id,
  (id) => {
    if (id && id !== agentId.value) {
      agentId.value = id as string
      agent.value = getById(id as string) ?? null
    }
  }
)

async function onAgentUpdated(data: Record<string, unknown>) {
  await refreshAgents()
  const updatedId = Number(data.agentId)
  if (updatedId === Number(agentId.value)) {
    agent.value = getById(agentId.value) ?? agent.value
  }
}

function handleAgentUpdated(patch: Partial<Agent>) {
  if (agent.value) {
    Object.assign(agent.value, patch)
    const storeAgent = agents.value.find((a) => a.id === agent.value!.id)
    if (storeAgent) Object.assign(storeAgent, patch)
  }
}
</script>

<template>
  <div class="flex h-full">
    <!-- 左侧 Agent 列表（手机隐藏） -->
    <div
      class="hidden md:flex w-52 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col overflow-hidden"
    >
      <div
        class="flex items-center gap-1 px-2 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0"
      >
        <a-button
          type="text"
          class="inline-flex items-center shrink-0"
          @click="router.push('/claw/agent')"
        >
          <ChevronLeft class="w-4 h-4" aria-hidden="true" />
        </a-button>
        <span class="text-sm font-semibold text-gray-600 dark:text-gray-400">{{
          $t('claw.agent.title')
        }}</span>
      </div>
      <AgentList
        :agents="agents"
        :selected-id="agentId"
        :grouped="true"
        @select="(a) => router.push(`/claw/agent/${a.id}`)"
      />
    </div>

    <!-- 右侧聊天区域 -->
    <div class="flex-1 min-w-0">
      <div v-if="loading" class="flex flex-col gap-3 p-4">
        <div class="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>{{ $t('claw.agent.loading') }}</span>
        </div>
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>
      <AgentDetailChat
        v-else-if="agent"
        :key="agentId"
        :agent-id="Number(agentId)"
        :agent-title="agent.title"
        :agent-avatar="agent.avatar"
        :agent="agent"
        @updated="handleAgentUpdated"
      />
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.8);
}
</style>
