<template>
  <div class="py-6 px-1">
    <ListerTop :loading="loading" :total="total" @refresh="loadData">
      <LabelSelector
        v-model="filterStatus"
        :options="statusFilters"
        :title="$t('claw.task.filterLabel')"
      />
      <LabelSelector
        v-model="filterSource"
        :options="sourceFilters"
        :title="t('claw.task.sourceLabel')"
      />
      <AgentSelector
        :value="filterAgentId"
        :placeholder="$t('claw.task.filterAgentAll')"
        :project-id="props.projectId"
        allow-clear
        style="width: 160px"
        @change="onAgentChange"
      />
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="$t('claw.task.searchPlaceholder')"
        allow-clear
        style="width: 220px"
        @change="onSearch"
      />
      <template #actions>
        <a-button
          v-if="tasks.length > 0 || loading"
          type="primary"
          @click="showAddModal = true"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.task.add') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <LoadingState :loading="loading">
      <!-- 任务列表 -->
      <div v-if="tasks.length > 0" class="flex flex-col gap-3">
        <TaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          :keyword="searchKeyword"
          @refresh="loadData"
        />
      </div>

      <!-- 空状态 -->
      <EmptyState
        v-else
        :loading="loading"
        :description="$t('claw.task.noTasks')"
      >
        <a-button type="primary" @click="showAddModal = true">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.task.add') }}
          </div>
        </a-button>
      </EmptyState>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="flex justify-center mt-6">
        <a-pagination
          v-model:current="currentPage"
          :total="total"
          :page-size="pageSize"
          :show-size-changer="false"
          @change="loadData"
        />
      </div>
    </LoadingState>
  </div>

  <TaskAddModal
    v-model:open="showAddModal"
    :project-id="props.projectId"
    @created="loadData"
  />
</template>

<script setup lang="ts">
import { useAgentStore } from '@/claw/stores/agent'
import { getTaskStats, paginateTasks, type Task } from '@/claw/api/task'
import AgentSelector from '@/claw/views/Agent/AgentSelector.vue'
import EmptyState from '@/components/EmptyState.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { systemWs } from '@/utils/system'
import { testActionSet, testActionUnset } from '@/utils/test'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import Clock from '~icons/lucide/clock'
import List from '~icons/lucide/list'
import Loader2 from '~icons/lucide/loader-2'
import MessageCircle from '~icons/lucide/message-circle'
import MousePointerClick from '~icons/lucide/mouse-pointer-click'
import Plus from '~icons/lucide/plus'

import Target from '~icons/lucide/target'
import XCircle from '~icons/lucide/x-circle'
import Ban from '~icons/lucide/ban'
import TaskAddModal from './TaskAddModal.vue'
import TaskCard from './TaskCard.vue'

const { t } = useI18n()
const props = defineProps<{ projectId: number }>()
const agentStore = useAgentStore()
const tasks = ref<Task[]>([])
const loading = ref(false)
const filterStatus = ref('all')
const filterSource = ref('all')
const filterAgentId = ref<string | undefined>(undefined)
const showAddModal = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')
const statusCounts = ref<Record<string, number>>({})

const loadStats = async () => {
  statusCounts.value = await getTaskStats({ projectId: props.projectId })
}

const loadData = async () => {
  loading.value = true
  try {
    const [result] = await Promise.all([
      paginateTasks({
        status: filterStatus.value !== 'all' ? filterStatus.value : undefined,
        agentId: filterAgentId.value ? Number(filterAgentId.value) : undefined,
        keyword: searchKeyword.value || undefined,
        source: filterSource.value !== 'all' ? filterSource.value : undefined,
        rootOnly: true,
        page: currentPage.value,
        pageSize: pageSize.value,
        projectId: props.projectId,
      }),
      loadStats(),
    ])
    tasks.value = result.data
    total.value = result.total
  } finally {
    loading.value = false
  }
}

const onSearch = () => {
  currentPage.value = 1
  loadData()
}

const onAgentChange = (val: string | undefined) => {
  filterAgentId.value = val
  currentPage.value = 1
  loadData()
}

watch(filterStatus, () => {
  currentPage.value = 1
  loadData()
})

watch(filterSource, () => {
  currentPage.value = 1
  loadData()
})

const onTaskUpdated = (data: Record<string, unknown>) => {
  const taskId = data.taskId as number
  const isRelevant = tasks.value.some(
    (t: Task) =>
      t.id === taskId || t.descendants?.some((d: Task) => d.id === taskId)
  )
  if (isRelevant) loadData()
}

onMounted(async () => {
  agentStore.load()
  await loadData()
  systemWs.on('claw:task:updated', onTaskUpdated)
  testActionSet('list.refresh', () => loadData())
  testActionSet('list.search', (kw: string) => {
    searchKeyword.value = kw ?? ''
    currentPage.value = 1
    loadData()
  })
  testActionSet('list.add', () => {
    showAddModal.value = true
  })
})

onUnmounted(() => {
  systemWs.off('claw:task:updated', onTaskUpdated)
  testActionUnset('list.refresh')
  testActionUnset('list.search')
  testActionUnset('list.add')
})

const statusFilters = computed(() => {
  const total = Object.values(statusCounts.value).reduce((a, b) => a + b, 0)
  return [
    {
      value: 'all',
      label: t('claw.task.all'),
      icon: List,
      count: total || undefined,
    },
    {
      value: 'draft',
      label: t('claw.task.statusDraft'),
      icon: Clock,
      count: statusCounts.value.draft,
    },
    {
      value: 'ready',
      label: t('claw.task.statusReady'),
      icon: Loader2,
      count: statusCounts.value.ready,
    },
    {
      value: 'asking',
      label: t('claw.task.statusAsking'),
      icon: MessageCircle,
      count: statusCounts.value.asking,
    },
    {
      value: 'running',
      label: t('claw.task.statusRunning'),
      icon: Loader2,
      count: statusCounts.value.running,
    },
    {
      value: 'success',
      label: t('claw.task.statusSuccess'),
      icon: CheckCircle2,
      count: statusCounts.value.success,
    },
    {
      value: 'failed',
      label: t('claw.task.statusFailed'),
      icon: XCircle,
      count: statusCounts.value.failed,
    },
    {
      value: 'canceled',
      label: t('claw.task.statusCanceled'),
      icon: Ban,
      count: statusCounts.value.canceled,
    },
  ]
})

const sourceFilters = computed(() => [
  { value: 'all', label: t('claw.task.sourceAll'), icon: List },
  {
    value: 'manual',
    label: t('claw.task.sourceManual'),
    icon: MousePointerClick,
  },
  { value: 'objective', label: t('claw.task.sourceObjective'), icon: Target },
])
</script>
