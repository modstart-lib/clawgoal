<script setup lang="ts">
import type { Task } from '@/claw/api/task'
import { deleteTask, getTasks, retryTask, stopTask } from '@/claw/api/task'
import {
  TASK_STATUS_STYLE,
  canDeleteTask,
  canRetryTask,
  canStopTask,
} from '@/claw/views/Task/constant'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import { message, Modal } from 'ant-design-vue'
import Briefcase from '~icons/lucide/briefcase'
import FlagTriangleRight from '~icons/lucide/flag-triangle-right'
import Play from '~icons/lucide/play'
import RotateCcw from '~icons/lucide/rotate-ccw'
import Square from '~icons/lucide/square'
import Trash2 from '~icons/lucide/trash-2'
import X from '~icons/lucide/x'
import Calendar from '~icons/lucide/calendar'
import CalendarDays from '~icons/lucide/calendar-days'
import CalendarRange from '~icons/lucide/calendar-range'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import List from '~icons/lucide/list'
import Loader2 from '~icons/lucide/loader-2'
import MessageCircle from '~icons/lucide/message-circle'
import XCircle from '~icons/lucide/x-circle'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{ agentId: number }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const tasks = ref<Task[]>([])
const loading = ref(false)
const actionLoading = ref<Record<number, string>>({})

// 筛选状态
const filterStatus = ref('all')
const filterDate = ref('all')

const statusOptions = computed(() => [
  { label: t('claw.agent.taskHistoryAll'), value: 'all', icon: List },
  { label: t('claw.agent.taskRunning'), value: 'running', icon: Loader2 },
  { label: t('claw.agent.taskPending'), value: 'asking', icon: MessageCircle },
  { label: t('claw.agent.taskSuccess'), value: 'success', icon: CheckCircle2 },
  { label: t('claw.agent.taskFail'), value: 'failed', icon: XCircle },
])

const dateOptions = computed(() => [
  { label: t('claw.agent.taskHistoryDateAll'), value: 'all', icon: Calendar },
  {
    label: t('claw.agent.taskHistoryDateToday'),
    value: 'today',
    icon: CalendarDays,
  },
  {
    label: t('claw.agent.taskHistoryDateWeek'),
    value: 'week',
    icon: CalendarRange,
  },
  {
    label: t('claw.agent.taskHistoryDateMonth'),
    value: 'month',
    icon: CalendarRange,
  },
])

const fetchTasks = async () => {
  loading.value = true
  try {
    tasks.value = await getTasks({ agentId: props.agentId })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchTasks()
  testActionSet('list.refresh', () => fetchTasks())
})
onUnmounted(() => {
  testActionUnset('list.refresh')
})

const isInDateRange = (createdAt: string, range: string): boolean => {
  if (range === 'all' || !createdAt) return true
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (range === 'today') return diffDays < 1
  if (range === 'week') return diffDays < 7
  if (range === 'month') return diffDays < 30
  return true
}

const filteredTasks = computed(() => {
  return tasks.value.filter((task) => {
    const statusMatch =
      filterStatus.value === 'all' || task.status === filterStatus.value
    const dateMatch = isInDateRange(task.createdAt, filterDate.value)
    return statusMatch && dateMatch
  })
})

const statusStyle = TASK_STATUS_STYLE
const canStop = canStopTask
const canRetry = canRetryTask
const canDelete = canDeleteTask

const handleStop = (task: Task) => {
  Modal.confirm({
    title: t('claw.agent.taskStopConfirm'),
    okText: t('claw.agent.taskStop'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      actionLoading.value[task.id] = 'stop'
      try {
        await stopTask(task.id)
        message.success(t('claw.agent.taskStopSuccess'))
        await fetchTasks()
      } catch {
        message.error(t('claw.agent.taskOperationFailed'))
      } finally {
        delete actionLoading.value[task.id]
      }
    },
  })
}

const handleRetry = async (task: Task) => {
  actionLoading.value[task.id] = 'retry'
  try {
    await retryTask(task.id)
    message.success(t('claw.agent.taskRetrySuccess'))
    await fetchTasks()
  } catch {
    message.error(t('claw.agent.taskOperationFailed'))
  } finally {
    delete actionLoading.value[task.id]
  }
}

const handleDelete = (task: Task) => {
  Modal.confirm({
    title: t('claw.agent.taskDeleteConfirm'),
    okText: t('claw.agent.taskDelete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      actionLoading.value[task.id] = 'delete'
      try {
        await deleteTask(task.id)
        message.success(t('claw.agent.taskDeleteSuccess'))
        await fetchTasks()
      } catch {
        message.error(t('claw.agent.taskOperationFailed'))
      } finally {
        delete actionLoading.value[task.id]
      }
    },
  })
}
</script>

<template>
  <!-- 弹窗遮罩 -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[85vh]"
    >
      <!-- 标题栏 -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
      >
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
          {{ $t('claw.agent.taskHistoryTitle') }}
        </h2>
        <button
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- 筛选栏 -->
      <div
        class="px-6 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-3 items-center shrink-0"
      >
        <!-- 时间筛选 -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">{{
            $t('claw.agent.taskHistoryTimeLabel')
          }}</span>
          <LabelSelector v-model="filterDate" :options="dateOptions" />
        </div>
        <!-- 状态筛选 -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">{{
            $t('claw.agent.taskHistoryStatusLabel')
          }}</span>
          <LabelSelector v-model="filterStatus" :options="statusOptions" />
        </div>
        <div class="ml-auto">
          <a-button type="default" :loading="loading" @click="fetchTasks">
            <div class="inline-flex items-center gap-1">
              <RotateCcw class="w-3 h-3" aria-hidden="true" />
              {{ $t('claw.agent.taskRefresh') }}
            </div>
          </a-button>
        </div>
      </div>

      <!-- 任务列表 -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <!-- 加载中 -->
        <div
          v-if="loading && !tasks.length"
          class="flex justify-center items-center py-12 text-gray-400"
        >
          {{ $t('claw.agent.loading') }}
        </div>

        <!-- 列表 -->
        <div v-else-if="filteredTasks.length" class="space-y-2">
          <div
            v-for="task in filteredTasks"
            :key="task.id"
            class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
          >
            <!-- 状态图标 -->
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              :class="statusStyle[task.status]?.icon"
            >
              <Briefcase class="w-3.5 h-3.5" />
            </div>

            <!-- 主体信息 -->
            <div class="flex-1 min-w-0">
              <h4
                class="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate mb-0.5"
              >
                {{ task.title }}
              </h4>
              <p
                v-if="task.description"
                class="text-xs text-gray-500 dark:text-gray-400 truncate"
              >
                {{ task.description }}
              </p>
              <div
                class="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500"
              >
                <span class="flex items-center gap-1">
                  <Play class="w-3 h-3" />
                  <DatetimeViewer :value="task.startAt" />
                </span>
                <span class="flex items-center gap-1">
                  <FlagTriangleRight class="w-3 h-3" />
                  <DatetimeViewer :value="task.endAt" />
                </span>
              </div>
              <p
                v-if="task.statusRemark"
                class="text-xs text-red-400 mt-1 truncate"
              >
                {{ task.statusRemark }}
              </p>
            </div>

            <!-- 状态标签 -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="relative flex h-2 w-2">
                <span
                  v-if="statusStyle[task.status]?.pulse"
                  class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  :class="statusStyle[task.status]?.dot"
                ></span>
                <span
                  class="relative inline-flex rounded-full h-2 w-2"
                  :class="statusStyle[task.status]?.dot"
                ></span>
              </span>
              <span
                class="text-xs font-medium"
                :class="statusStyle[task.status]?.label"
              >
                {{ task.statusText }}
              </span>
            </div>

            <!-- 操作按钮 -->
            <div class="flex items-center gap-1 shrink-0">
              <a-tooltip
                v-if="canStop(task.status)"
                :title="$t('claw.agent.taskStop')"
              >
                <a-button
                  type="primary"
                  danger
                  class="inline-flex items-center"
                  :loading="actionLoading[task.id] === 'stop'"
                  @click="handleStop(task)"
                >
                  <Square class="w-4 h-4" aria-hidden="true" />
                </a-button>
              </a-tooltip>
              <a-tooltip
                v-if="canRetry(task.status)"
                :title="$t('claw.agent.taskRetry')"
              >
                <a-button
                  type="primary"
                  class="inline-flex items-center"
                  :loading="actionLoading[task.id] === 'retry'"
                  @click="handleRetry(task)"
                >
                  <RotateCcw class="w-4 h-4" aria-hidden="true" />
                </a-button>
              </a-tooltip>
              <a-tooltip
                v-if="canDelete(task.status)"
                :title="$t('claw.agent.taskDelete')"
              >
                <a-button
                  type="default"
                  class="inline-flex items-center"
                  :loading="actionLoading[task.id] === 'delete'"
                  @click="handleDelete(task)"
                >
                  <Trash2 class="w-4 h-4" aria-hidden="true" />
                </a-button>
              </a-tooltip>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="text-center py-12 text-gray-400 dark:text-gray-500">
          {{ $t('claw.agent.noWorkTasks') }}
        </div>
      </div>

      <!-- 底部统计 -->
      <div
        class="px-6 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
      >
        <span>{{
          $t('claw.agent.taskHistoryTotal', {
            filtered: filteredTasks.length,
            total: tasks.length,
          })
        }}</span>
        <a-button type="default" @click="emit('close')">{{
          $t('common.close')
        }}</a-button>
      </div>
    </div>
  </div>
</template>
