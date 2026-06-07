<script setup lang="ts">
/**
 * AgentList — 左侧 Agent 列表
 *
 * Props:
 *   agents      需要显示的 Agent 列表
 *   selectedId  当前高亮的 Agent ID
 *   grouped     是否按项目分组（内部通过 useProjectStore 获取项目信息）
 *
 * Emits:
 *   select  点击某个 Agent 时触发，由父组件决定路由跳转或状态更新
 */
import { useProjectStore } from '@/claw/stores/project'
import type { ProjectItem } from '@/claw/api/project'
import type { Agent } from '@/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  agents: Agent[]
  selectedId?: string | number | null
  grouped?: boolean
}>()

const emit = defineEmits<{
  select: [agent: Agent]
}>()

const { t } = useI18n()

const { projects } = useProjectStore()

// 按项目分组
const groupedAgents = computed(() => {
  if (!props.grouped) return null
  const byProject = new Map<number | null, Agent[]>()

  for (const agent of props.agents) {
    const pid = agent.projectId ?? null
    if (!byProject.has(pid)) byProject.set(pid, [])
    byProject.get(pid)!.push(agent)
  }

  const groups: { project: ProjectItem | null; agents: Agent[] }[] = []
  // 系统内置（无项目）放最前
  const noProject = byProject.get(null)
  if (noProject?.length) groups.push({ project: null, agents: noProject })
  for (const project of projects.value) {
    const list = byProject.get(project.id)
    if (list?.length) groups.push({ project, agents: list })
  }

  return groups.length > 0 ? groups : null
})

const activeId = computed(() => String(props.selectedId ?? ''))
</script>

<template>
  <div class="flex-1 overflow-y-auto p-2">
    <!-- 分组模式 -->
    <template v-if="grouped && groupedAgents">
      <div
        v-for="group in groupedAgents"
        :key="group.project?.id ?? 'none'"
        class="mb-3"
      >
        <div class="flex items-center gap-1.5 px-2 py-1">
          <img
            v-if="group.project?.logo"
            :src="group.project.logo"
            class="w-3.5 h-3.5 rounded object-cover shrink-0"
            alt=""
          />
          <span
            class="text-xs font-semibold text-gray-400 dark:text-gray-500 truncate"
          >
            {{ group.project?.title ?? t('claw.compAgentList.systemBuiltin') }}
          </span>
        </div>
        <div
          v-for="item in group.agents"
          :key="item.id"
          class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-200"
          :class="
            String(item.id) === activeId
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          "
          @click="emit('select', item)"
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
              <span class="text-xs truncate text-gray-400 dark:text-gray-500">{{
                item.workStatus === 'working'
                  ? t('claw.compAgentList.statusWorking')
                  : t('claw.compAgentList.statusIdle')
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 平铺模式 -->
    <template v-else>
      <div class="space-y-1">
        <div
          v-for="item in agents"
          :key="item.id"
          class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-200"
          :class="
            String(item.id) === activeId
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          "
          @click="emit('select', item)"
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
              <span class="text-xs truncate text-gray-400 dark:text-gray-500">{{
                item.workStatus === 'working'
                  ? t('claw.compAgentList.statusWorking')
                  : t('claw.compAgentList.statusIdle')
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
</style>
