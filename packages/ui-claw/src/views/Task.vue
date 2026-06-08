<template>
  <div class="pb-10">
    <PageHeader :title="$t('claw.task.title')" />

    <ListerTop :loading="loading" :total="total" @refresh="loadData">
      <LabelSelector
        v-model="filterStatus"
        :options="statusFilters"
        :title="$t('claw.task.filterLabel')"
      />
      <AgentSelector
        :value="filterAgentId"
        :placeholder="$t('claw.task.filterAgentAll')"
        allow-clear
        style="width: 160px"
        @change="onAgentChange"
      />
      <a-select
        v-model:value="filterSource"
        style="width: 110px"
        @change="onSourceChange"
      >
        <a-select-option value="all">{{
          $t('claw.task.sourceAll')
        }}</a-select-option>
        <a-select-option value="manual">{{
          $t('claw.task.sourceManual')
        }}</a-select-option>
        <a-select-option value="objective">{{
          $t('claw.task.sourceObjective')
        }}</a-select-option>
      </a-select>
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="$t('claw.task.searchPlaceholder')"
        allow-clear
        style="width: 220px"
        @change="onSearch"
      />
      <template v-if="totalUnfiltered > 0" #actions>
        <a-button type="primary" @click="showAddModal = true">
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
          @refresh="loadData"
        />
      </div>

      <!-- 空状态：真正无任务 -->
      <EmptyState
        v-else-if="totalUnfiltered === 0"
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

      <!-- 过滤空状态：有任务但当前筛选无结果 -->
      <div
        v-else
        class="py-12 text-center text-sm text-gray-400 dark:text-gray-500"
      >
        {{ $t('claw.task.filterEmpty') }}
      </div>

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

  <TaskAddModal v-model:open="showAddModal" @created="loadData" />
</template>

<script setup lang="ts">
import { useAgentStore } from '@/claw/stores/agent'
import { getTaskStats, paginateTasks, type Task } from '@/claw/api/task'
import AgentSelector from '@/claw/views/Agent/AgentSelector.vue'
import EmptyState from '@/components/EmptyState.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import Clock from '~icons/lucide/clock'
import List from '~icons/lucide/list'
import Loader2 from '~icons/lucide/loader-2'
import MessageCircle from '~icons/lucide/message-circle'
import Plus from '~icons/lucide/plus'

import XCircle from '~icons/lucide/x-circle'
import Ban from '~icons/lucide/ban'
import TaskAddModal from './Task/TaskAddModal.vue'
import TaskCard from './Task/TaskCard.vue'

const { t } = useI18n()
const agentStore = useAgentStore()
const tasks = ref<Task[]>([])
const loading = ref(false)
const filterStatus = ref('all')
const filterAgentId = ref<string | undefined>(undefined)
const filterSource = ref('all')
const showAddModal = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')
const statusCounts = ref<Record<string, number>>({})

const totalUnfiltered = computed(() =>
  Object.values(statusCounts.value).reduce<number>((a, b) => a + b, 0)
)

const loadStats = async () => {
  statusCounts.value = await getTaskStats()
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
        page: currentPage.value,
        pageSize: pageSize.value,
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

const onSourceChange = () => {
  currentPage.value = 1
  loadData()
}

watch(filterStatus, () => {
  currentPage.value = 1
  loadData()
})

onMounted(async () => {
  agentStore.load()
  await loadData()
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
</script>
