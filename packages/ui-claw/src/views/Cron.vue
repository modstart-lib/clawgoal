<template>
  <div class="pb-10">
    <PageHeader :title="$t('claw.cron.title')" />

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.cron.totalTasks') }}
            </div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ tasks.length }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center"
          >
            <CalendarClock class="w-5 h-5 text-primary-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.cron.enabledTasks') }}
            </div>
            <div class="text-2xl font-bold text-green-600">
              {{ enabledCount }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center"
          >
            <CircleCheck class="w-5 h-5 text-green-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.cron.disabledTasks') }}
            </div>
            <div class="text-2xl font-bold text-gray-400">
              {{ disabledCount }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center"
          >
            <PauseCircle class="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.cron.totalRuns') }}
            </div>
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-500">
              {{ totalRuns }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center"
          >
            <Activity class="w-5 h-5 text-blue-500" />
          </div>
        </div>
      </div>
    </div>

    <ListerTop :loading="loading" :total="tasks.length" @refresh="loadData">
      <LabelSelector
        v-model="filterStatus"
        :options="statusFilters"
        :title="$t('claw.cron.filterLabel')"
      />
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="$t('claw.cron.searchPlaceholder')"
        allow-clear
        class="!max-w-xs"
      />
      <template #actions>
        <a-button type="default" @click="historyModalVisible = true">
          <div class="inline-flex items-center gap-1">
            <History class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.cron.historyBtn') }}
          </div>
        </a-button>
        <a-button
          v-if="tasks.length > 0"
          type="primary"
          @click="openAddModal()"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.cron.addBtn') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <!-- 任务卡片列表 -->
    <LoadingState :loading="loading">
      <div v-if="filteredTasks.length > 0" class="flex flex-col gap-3">
        <CronTaskCard
          v-for="task in filteredTasks"
          :key="task.id"
          :task="task"
          :agent="getAgent(task.agentId)"
          :keyword="searchKeyword"
          @toggle="handleToggle"
          @toggle-notify="handleToggleNotify"
          @run-now="handleRunNow"
          @view-logs="openDetailModal"
          @edit="openAddModal"
          @copy="handleCopy"
          @delete="handleDelete"
        />
      </div>

      <!-- 真空状态：无任何任务 -->
      <EmptyState
        v-else-if="tasks.length === 0"
        :loading="loading"
        :description="$t('claw.cron.noTasks')"
      >
        <a-button type="primary" @click="openAddModal()">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.cron.addBtn') }}
          </div>
        </a-button>
      </EmptyState>

      <!-- 过滤空状态：有任务但当前筛选无结果 -->
      <div
        v-else
        class="py-12 text-center text-sm text-gray-400 dark:text-gray-500"
      >
        {{ $t('claw.cron.filterEmpty') }}
      </div>
    </LoadingState>

    <!-- 新建/编辑 Modal -->
    <CronAddModal
      v-model:open="addModalVisible"
      :task="editingTask"
      :copy-from="copyFromTask"
      @saved="handleSaved"
    />

    <!-- 详情 Modal -->
    <CronDetailModal
      v-model:open="detailModalVisible"
      :task="detailTask"
      :agent="detailTask ? getAgent(detailTask.agentId) : undefined"
    />

    <!-- 调度历史 Modal -->
    <CronHistoryModal v-model:open="historyModalVisible" />
  </div>
</template>

<script setup lang="ts">
import { useAgentStore } from '@/claw/stores/agent'
import {
  deleteCronTask,
  getCronStat,
  listCronTasks,
  runCronTaskNow,
  toggleCronTask,
  updateCronTask,
  type CronTask,
} from '@/claw/api/cron'
import EmptyState from '@/components/EmptyState.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import Activity from '~icons/lucide/activity'
import CalendarClock from '~icons/lucide/calendar-clock'
import CircleCheck from '~icons/lucide/circle-check'
import History from '~icons/lucide/history'
import List from '~icons/lucide/list'
import PauseCircle from '~icons/lucide/pause-circle'
import Plus from '~icons/lucide/plus'

import CronAddModal from './Cron/CronAddModal.vue'
import CronTaskCard from './Cron/CronCard.vue'
import CronDetailModal from './Cron/CronDetailModal.vue'
import CronHistoryModal from './Cron/CronHistoryModal.vue'

const { t } = useI18n()

const tasks = ref<CronTask[]>([])
const agentStore = useAgentStore()
const { agents } = agentStore
const loading = ref(false)
const filterStatus = ref<string>('all')
const searchKeyword = ref('')
const totalRuns = ref(0)

const statusFilters = computed(() => [
  {
    value: 'all',
    label: t('claw.cron.filterAll'),
    count: tasks.value.length,
    icon: List,
  },
  {
    value: 'enabled',
    label: t('claw.cron.filterEnabled'),
    count: tasks.value.filter((t) => t.status === 'enabled').length,
    icon: CircleCheck,
  },
  {
    value: 'disabled',
    label: t('claw.cron.filterDisabled'),
    count: tasks.value.filter((t) => t.status === 'disabled').length,
    icon: PauseCircle,
  },
])

const filteredTasks = computed(() => {
  let list =
    filterStatus.value === 'all'
      ? tasks.value
      : tasks.value.filter((t) => t.status === filterStatus.value)
  const kw = searchKeyword.value.trim()
  if (kw) {
    const idMatch = kw.match(/^#(\d+)$/)
    if (idMatch) {
      list = list.filter((t) => t.id === Number(idMatch[1]))
    } else {
      const kwLower = kw.toLowerCase()
      list = list.filter((t) => t.name.toLowerCase().includes(kwLower))
    }
  }
  return list
})

const enabledCount = computed(
  () => tasks.value.filter((t) => t.status === 'enabled').length
)
const disabledCount = computed(
  () => tasks.value.filter((t) => t.status === 'disabled').length
)

const getAgent = (agentId?: string) =>
  agents.value.find((w) => w.id === agentId)

const loadData = async () => {
  loading.value = true
  try {
    const [tasksRes, statRes] = await Promise.all([
      listCronTasks(),
      getCronStat(),
    ])
    tasks.value = tasksRes
    totalRuns.value = statRes.totalRunCount
  } catch (e: any) {
    message.error(e.message || t('claw.cron.loadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  testActionSet('list.refresh', () => loadData())
  testActionSet('list.add', () => openAddModal())
  testActionSet('list.search', (kw: string) => {
    searchKeyword.value = kw
  })
})
onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
  testActionUnset('list.search')
})

onMounted(() => {
  agentStore.load()
  loadData()
})

// ─── 新建 / 编辑 ──────────────────────────────────────────────────────────────
const addModalVisible = ref(false)
const editingTask = ref<CronTask | null>(null)
const copyFromTask = ref<CronTask | null>(null)

const openAddModal = (task?: CronTask) => {
  editingTask.value = task || null
  copyFromTask.value = null
  addModalVisible.value = true
}

const handleCopy = (task: CronTask) => {
  editingTask.value = null
  copyFromTask.value = task
  addModalVisible.value = true
}

const handleSaved = (saved: CronTask) => {
  const idx = tasks.value.findIndex((t) => t.id === saved.id)
  if (idx !== -1) {
    tasks.value[idx] = saved
  } else {
    tasks.value.push(saved)
  }
}

// ─── 详情 ────────────────────────────────────────────────────────────────────
const detailModalVisible = ref(false)
const detailTask = ref<CronTask | null>(null)

// ─── 调度历史 ─────────────────────────────────────────────────────────────────
const historyModalVisible = ref(false)

const openDetailModal = (task: CronTask) => {
  detailTask.value = task
  detailModalVisible.value = true
}

// ─── 切换启用 ────────────────────────────────────────────────────────────────
const handleToggle = async (id: number, val: boolean) => {
  try {
    const updated = await toggleCronTask(id, val)
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx !== -1) tasks.value[idx] = updated
    message.success(
      t('claw.cron.toggleSuccess', {
        action: val
          ? t('claw.cron.toggleEnable')
          : t('claw.cron.toggleDisable'),
      })
    )
  } catch (e: any) {
    message.error(e.message || t('claw.cron.operationFailed'))
  }
}
// ─── 切换成功通知 ────────────────────────────────────────
const handleToggleNotify = async (id: number, val: boolean) => {
  try {
    const updated = await updateCronTask(id, { successNotify: val })
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx !== -1) tasks.value[idx] = updated
    message.success(
      val
        ? t('claw.cron.toggleNotifyEnable')
        : t('claw.cron.toggleNotifyDisable')
    )
  } catch (e: any) {
    message.error(e.message || t('claw.cron.operationFailed'))
  }
}
// ─── 立即执行 ────────────────────────────────────────────────────────────────
const handleRunNow = async (id: number) => {
  try {
    await runCronTaskNow(id)
    message.success(t('claw.cron.runNowSuccess'))
  } catch (e: any) {
    message.error(e.message || t('claw.cron.operationFailed'))
  }
}

// ─── 删除 ────────────────────────────────────────────────────────────────────
const handleDelete = async (id: number) => {
  try {
    await deleteCronTask(id)
    tasks.value = tasks.value.filter((t) => t.id !== id)
    message.success(
      t('claw.cron.toggleSuccess', { action: t('claw.cron.deleteBtn') })
    )
  } catch (e: any) {
    message.error(e.message || t('claw.cron.deleteFailed'))
  }
}
</script>
