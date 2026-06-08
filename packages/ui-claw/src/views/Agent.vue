<script setup lang="ts">
import { useAgentStore } from '@/claw/stores/agent'
import { useProjectStore } from '@/claw/stores/project'
import { type ProjectItem } from '@/claw/api/project'
import EmptyState from '@/components/EmptyState.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import PageHeader from '@/components/PageHeader.vue'
import type { Agent } from '@/types'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { systemWs } from '@/utils/system'
import Plus from '~icons/lucide/plus'
import AgentAddModal from './Agent/AgentAddModal.vue'
import AgentCard from './Agent/AgentCard.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const router = useRouter()

const agentStore = useAgentStore()
const { projects: allProjects } = useProjectStore()
const { loading } = agentStore
const showAddModal = ref(false)

// 按项目分组，系统内置（无项目）放最前
const groupedAgents = computed(() => {
  const agents = agentStore.agents.value
  const groups: { project: ProjectItem | null; agents: Agent[] }[] = []
  const byProject = new Map<number | null, Agent[]>()

  for (const agent of agents) {
    const pid = agent.projectId ?? null
    if (!byProject.has(pid)) byProject.set(pid, [])
    byProject.get(pid)!.push(agent)
  }

  // 系统内置（无项目）放最前
  const noProject = byProject.get(null)
  if (noProject?.length) groups.push({ project: null, agents: noProject })

  // 有项目的分组按项目顺序排列
  for (const project of allProjects.value) {
    const list = byProject.get(project.id)
    if (list?.length) groups.push({ project, agents: list })
  }

  return groups.length > 0 ? groups : null
})

onMounted(() => {
  testActionSet('list.refresh', () => agentStore.refresh())
  testActionSet('list.add', () => {
    showAddModal.value = true
  })
})
onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
})

onMounted(() => {
  agentStore.load()
  systemWs.on('claw:agent:updated', onAgentUpdated)
})

onUnmounted(() => {
  systemWs.off('claw:agent:updated', onAgentUpdated)
})

function onAgentUpdated() {
  agentStore.refresh()
}

const handleCreated = (agent: Agent) => {
  agentStore.agents.value.push(agent)
}

const navigateToAgent = (id: string) => {
  router.push(`/claw/agent/${id}`)
}
</script>
<template>
  <div class="pb-10">
    <PageHeader :title="$t('claw.agent.title')" />

    <ListerTop
      :loading="loading"
      :total="agentStore.agents.value.length"
      @refresh="agentStore.refresh"
    >
      <template v-if="agentStore.agents.value.length > 0" #actions>
        <a-button type="primary" @click="showAddModal = true">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.agent.addAgent') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <LoadingState :loading="loading">
      <!-- 按项目分组显示 -->
      <template v-if="groupedAgents">
        <div
          v-for="group in groupedAgents"
          :key="group.project?.id ?? 'none'"
          class="mb-8"
        >
          <div class="flex items-center gap-2 mb-3 mt-6 px-1">
            <img
              v-if="group.project?.logo"
              :src="group.project.logo"
              class="w-4 h-4 rounded object-cover shrink-0"
              alt=""
            />
            <span
              class="text-sm font-semibold text-gray-500 dark:text-gray-400"
            >
              {{ group.project?.title ?? $t('claw.agent.systemBuiltin') }}
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AgentCard
              v-for="agent in group.agents"
              :key="agent.id"
              :agent="agent"
              @click="navigateToAgent"
            />
          </div>
        </div>
      </template>

      <EmptyState
        v-else
        :loading="loading"
        :description="$t('claw.agent.noAgents')"
      >
        <a-button type="primary" @click="showAddModal = true">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.agent.addAgent') }}
          </div>
        </a-button>
      </EmptyState>
    </LoadingState>

    <AgentAddModal v-model:open="showAddModal" @created="handleCreated" />
  </div>
</template>
