<script setup lang="ts">
import { useAgentStore } from '@/claw/stores/agent'
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
  testActionSet('members.refresh', () => refreshAgents())
  testActionSet('members.selectFirst', () => {
    if (agents.value.length > 0) selectedAgent.value = agents.value[0]
  })
})

onUnmounted(() => {
  systemWs.off('claw:agent:updated', onAgentUpdated)
  testActionUnset('members.refresh')
  testActionUnset('members.selectFirst')
})

async function onAgentUpdated() {
  await refreshAgents()
}

function handleAgentUpdated(patch: Partial<Agent>) {
  if (selectedAgent.value) Object.assign(selectedAgent.value, patch)
}
</script>

<template>
  <div class="flex h-full">
    <!-- 左侧智能体列表 -->
    <div
      class="hidden md:flex w-52 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col overflow-hidden"
    >
      <div
        class="flex items-center gap-1 px-3 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0"
      >
        <span class="text-sm font-semibold text-gray-600 dark:text-gray-400">{{
          t('claw.project.tabAgent')
        }}</span>
      </div>
      <div v-if="loading" class="p-3 text-sm text-gray-400">
        {{ t('common.loading') }}
      </div>
      <EmptyStateTiny
        v-else-if="agents.length === 0"
        :description="t('claw.project.agentEmpty')"
        :icon="Bot"
      />
      <div v-else class="flex-1 overflow-y-auto p-2 space-y-1">
        <div
          v-for="item in agents"
          :key="item.id"
          class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-200"
          :class="
            selectedAgent?.id === item.id
              ? 'bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          "
          @click="selectedAgent = item"
        >
          <div
            class="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-600"
          >
            <img
              v-if="item.avatar"
              :src="item.avatar"
              alt=""
              class="w-full h-full object-cover"
            />
          </div>
          <div class="min-w-0 flex flex-col">
            <span class="text-sm font-medium truncate leading-tight">{{
              item.title
            }}</span>
            <div class="flex items-center gap-1 mt-0.5">
              <span
                class="w-1.5 h-1.5 rounded-full shrink-0"
                :class="
                  item.workStatus === 'working'
                    ? 'bg-green-400'
                    : 'bg-gray-300 dark:bg-gray-500'
                "
              />
              <span
                class="text-xs truncate"
                :class="
                  selectedAgent?.id === item.id
                    ? 'text-gray-300 dark:text-gray-600'
                    : 'text-gray-400 dark:text-gray-500'
                "
                >{{
                  item.workStatus === 'working'
                    ? t('claw.project.memberWorking')
                    : t('claw.project.memberIdle')
                }}</span
              >
            </div>
          </div>
        </div>
      </div>
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

<style scoped>
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
</style>
