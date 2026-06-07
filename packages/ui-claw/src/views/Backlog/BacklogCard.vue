<script setup lang="ts">
import type {
  BacklogPriority,
  BacklogStatus,
  BacklogItem,
} from '@/claw/api/backlog'
import {
  deleteBacklog,
  editBacklog,
  updateBacklogStatus,
} from '@/claw/api/backlog'
import {
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
} from '@/claw/views/Project/constant'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import { copyText } from '@/utils/utils'
import { message, Modal } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import CalendarDays from '~icons/lucide/calendar-days'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Trash2 from '~icons/lucide/trash-2'

const { t } = useI18n()

const props = defineProps<{
  item: BacklogItem
}>()

const emit = defineEmits<{
  view: [item: BacklogItem]
  edit: [item: BacklogItem]
  saved: [item: BacklogItem]
  deleted: [id: number]
}>()

const statusChanging = ref(false)
const priorityChanging = ref(false)

const STATUSES = BACKLOG_STATUSES
const PRIORITIES = BACKLOG_PRIORITIES

const STATUS_CONFIG: Record<string, { label: string; tagColor: string }> = {
  pending: { label: t('claw.backlog.statusPending'), tagColor: 'default' },
  active: { label: t('claw.backlog.statusActive'), tagColor: 'blue' },
  pool: { label: t('claw.backlog.statusPool'), tagColor: 'orange' },
  dropped: { label: t('claw.backlog.statusDropped'), tagColor: 'red' },
  done: { label: t('claw.backlog.statusDone'), tagColor: 'green' },
}

const PRIORITY_CONFIG: Record<
  string,
  { label: string; tagColor: string; textClass: string }
> = {
  high: {
    label: t('claw.backlog.priorityHigh'),
    tagColor: 'red',
    textClass: 'text-red-500 dark:text-red-400',
  },
  medium: {
    label: t('claw.backlog.priorityMedium'),
    tagColor: 'orange',
    textClass: 'text-orange-500 dark:text-orange-400',
  },
  low: {
    label: t('claw.backlog.priorityLow'),
    tagColor: 'default',
    textClass: 'text-gray-400 dark:text-gray-500',
  },
}

const currentConfig = computed(
  () =>
    STATUS_CONFIG[props.item.status as BacklogStatus] ?? STATUS_CONFIG.pending
)

const priorityConfig = computed(
  () => PRIORITY_CONFIG[props.item.priority] ?? PRIORITY_CONFIG.medium
)

const isDue = computed(() => {
  if (
    !props.item.dueAt ||
    props.item.status === 'done' ||
    props.item.status === 'dropped'
  )
    return false
  const today = new Date().toISOString().slice(0, 10)
  return props.item.dueAt < today
})

// ─── Status change ────────────────────────────────────────────────────────────

async function changeStatus(newStatus: BacklogStatus) {
  if (newStatus === props.item.status) return
  if (newStatus === 'dropped') {
    emit('edit', props.item)
    return
  }
  statusChanging.value = true
  try {
    const updated = await updateBacklogStatus(props.item.id, newStatus)
    emit('saved', updated)
    message.success(t('claw.backlog.statusUpdated'))
  } catch {
    message.error(t('claw.backlog.operationFailed'))
  } finally {
    statusChanging.value = false
  }
}

// ─── Priority change ──────────────────────────────────────────────────────────

async function changePriority(newPriority: BacklogPriority) {
  if (newPriority === props.item.priority) return
  priorityChanging.value = true
  try {
    const updated = await editBacklog(props.item.id, {
      priority: newPriority,
    })
    emit('saved', updated)
    message.success(t('claw.backlog.priorityUpdated'))
  } catch {
    message.error(t('claw.backlog.operationFailed'))
  } finally {
    priorityChanging.value = false
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

function confirmDelete() {
  Modal.confirm({
    title: t('claw.backlog.deleteConfirm'),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      try {
        await deleteBacklog(props.item.id)
        emit('deleted', props.item.id)
      } catch {
        message.error(t('claw.backlog.deleteFailed'))
      }
    },
  })
}

onMounted(() => {
  testActionSet('card.view', () => emit('view', props.item))
  testActionSet('card.edit', () => emit('edit', props.item))
})
onUnmounted(() => {
  testActionUnset('card.view')
  testActionUnset('card.edit')
})
</script>

<template>
  <div
    class="group flex flex-col bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl transition-all hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-600 cursor-pointer"
    :class="{
      'opacity-60': item.status === 'dropped' || item.status === 'done',
    }"
    @click="emit('view', item)"
  >
    <!-- 第一行：优先级下拉 + 状态下拉 + 标题 + 类型标签 -->
    <div class="flex items-center gap-2 px-4 pt-3">
      <!-- 优先级快速切换 -->
      <a-dropdown :trigger="['click']" placement="bottomLeft">
        <span
          class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 cursor-pointer select-none"
          :class="priorityConfig.textClass"
          @click.stop
        >
          {{ priorityConfig.label }}
          <span class="ml-0.5 opacity-60">▾</span>
        </span>
        <template #overlay>
          <a-menu>
            <a-menu-item
              v-for="p in PRIORITIES"
              :key="p"
              :class="{ 'font-medium': p === item.priority }"
              @click="changePriority(p)"
            >
              <span :class="p === item.priority ? 'text-primary-500' : ''">
                {{ PRIORITY_CONFIG[p].label }}
                <span v-if="p === item.priority" class="ml-1">✓</span>
              </span>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <!-- 状态快速切换下拉 -->
      <a-dropdown :trigger="['click']" placement="bottomLeft">
        <a-tag
          :color="currentConfig.tagColor"
          class="!mr-0 shrink-0 cursor-pointer select-none"
          @click.stop
        >
          {{ currentConfig.label }}
          <span class="ml-0.5 opacity-60">▾</span>
        </a-tag>
        <template #overlay>
          <a-menu>
            <a-menu-item
              v-for="s in STATUSES"
              :key="s"
              :class="{ 'font-medium': s === item.status }"
              @click="changeStatus(s)"
            >
              <span :class="s === item.status ? 'text-primary-500' : ''">
                {{ STATUS_CONFIG[s].label }}
                <span v-if="s === item.status" class="ml-1">✓</span>
              </span>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <!-- 标题 -->
      <span
        class="text-sm font-medium flex-1 min-w-0 truncate"
        :class="
          item.status === 'done' || item.status === 'dropped'
            ? 'line-through text-gray-400 dark:text-gray-500'
            : 'text-gray-900 dark:text-gray-100'
        "
        :title="item.title"
        >{{ item.title }}</span
      >

      <!-- 类型标签 -->
      <span
        v-if="item.type"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shrink-0"
        >{{ item.type }}</span
      >
    </div>

    <!-- 描述文字（灰色，超出截断） -->
    <div v-if="item.detail" class="px-4 pt-1">
      <p class="text-xs text-gray-400 dark:text-gray-500 truncate">
        {{ item.detail }}
      </p>
    </div>

    <!-- 最后一行：#ID + 辅助信息 | 查看按钮 + 更多操作 -->
    <div class="px-4 pb-3 flex items-center justify-between mt-1.5">
      <!-- 左侧：ID + 来源 + 截止日期 + 废弃原因 -->
      <div class="flex items-center gap-2 overflow-hidden flex-1 mr-2">
        <span
          class="text-xs text-gray-400 dark:text-gray-500 font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          :title="t('common.copyId')"
          @click.stop="copyText(String(item.id))"
          >#{{ item.id }}</span
        >
        <span
          v-if="item.source"
          class="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0"
          >{{ item.source }}</span
        >
        <div
          v-if="item.dueAt"
          class="flex items-center gap-1 text-xs shrink-0"
          :class="
            isDue
              ? 'text-red-500 dark:text-red-400'
              : 'text-gray-400 dark:text-gray-500'
          "
        >
          <CalendarDays class="w-3 h-3" aria-hidden="true" />
          <DatetimeViewer :value="item.dueAt" format="date" />
          <span v-if="isDue" class="font-medium">{{
            t('claw.backlog.overdue')
          }}</span>
        </div>
        <span
          v-if="item.reason && item.status === 'dropped'"
          class="text-xs text-red-400 dark:text-red-500 truncate max-w-48"
          :title="item.reason"
          >{{ t('claw.backlog.reason') }}{{ item.reason }}</span
        >
      </div>

      <!-- 右侧：更多操作下拉 -->
      <div class="flex items-center gap-1 shrink-0">
        <a-dropdown :trigger="['hover']" placement="bottomRight">
          <a-button type="text" size="small" class="px-2" @click.stop>
            <MoreHorizontal class="w-4 h-4 text-gray-500" aria-hidden="true" />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item @click.stop="emit('edit', item)">
                <div class="flex items-center gap-2">
                  <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ t('claw.backlog.edit') }}
                </div>
              </a-menu-item>
              <a-menu-item class="!text-red-500" @click.stop="confirmDelete">
                <div class="flex items-center gap-2">
                  <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ t('claw.backlog.delete') }}
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>
  </div>
</template>
