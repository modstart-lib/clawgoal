<script setup lang="ts">
import { getTaskStats, paginateTasks, type Task } from '@/claw/api/task'
import TaskAddModal from '@/claw/views/Task/TaskAddModal.vue'
import TaskCard from '@/claw/views/Task/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
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

const { t } = useI18n()

const props = defineProps<{ agentId: number }>()

const tasks = ref<Task[]>([])
const loading = ref(false)
const filterStatus = ref('all')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const statusCounts = ref<Record<string, number>>({})
const showAddModal = ref(false)

const loadStats = async () => {
  statusCounts.value = await getTaskStats()
}

const loadData = async () => {
  loading.value = true
  try {
    const [result] = await Promise.all([
      paginateTasks({
        agentId: props.agentId,
        status: filterStatus.value !== 'all' ? filterStatus.value : undefined,
        keyword: searchKeyword.value || undefined,
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

watch(filterStatus, () => {
  currentPage.value = 1
  loadData()
})

onMounted(() => {
  loadData()
  testActionSet('list.refresh', () => loadData())
  testActionSet('list.add', () => {
    showAddModal.value = true
  })
  testActionSet('list.search', (kw: string) => {
    searchKeyword.value = kw ?? ''
    onSearch()
  })
})
onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
  testActionUnset('list.search')
})

const statusFilters = computed(() => {
  const tot = Object.values(statusCounts.value).reduce((a, b) => a + b, 0)
  return [
    {
      value: 'all',
      label: t('claw.task.all'),
      icon: List,
      count: tot || undefined,
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
  ]
})
</script>

<template>
  <div class="p-5">
    <ListerTop :loading="loading" :total="total" @refresh="loadData">
      <LabelSelector
        v-model="filterStatus"
        :options="statusFilters"
        :title="$t('claw.task.filterLabel')"
      />
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="$t('claw.task.searchPlaceholder')"
        allow-clear
        style="width: 220px"
        @change="onSearch"
      />
      <template #actions>
        <a-button type="primary" @click="showAddModal = true">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.task.add') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <LoadingState :loading="loading">
      <div v-if="tasks.length > 0" class="flex flex-col gap-3">
        <TaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          @refresh="loadData"
        />
      </div>
      <EmptyState
        v-else
        :loading="loading"
        :description="$t('claw.task.noTasks')"
      />
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
