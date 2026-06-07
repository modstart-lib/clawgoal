<script setup lang="ts">
import type { CronTask } from '@/claw/api/cron'
import CronViewer from '@/components/CronViewer.vue'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import TextHighlight from '@/components/TextHighlight.vue'
import type { Agent } from '@/types'
import { copyText } from '@/utils/utils'
import { Modal } from 'ant-design-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Bot from '~icons/lucide/bot'
import CalendarDays from '~icons/lucide/calendar-days'
import CircleCheck from '~icons/lucide/circle-check'
import Clock from '~icons/lucide/clock'
import History from '~icons/lucide/history'
import Copy from '~icons/lucide/copy'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import PauseCircle from '~icons/lucide/pause-circle'
import Pencil from '~icons/lucide/pencil'
import Play from '~icons/lucide/play'
import ScrollText from '~icons/lucide/scroll-text'
import Terminal from '~icons/lucide/terminal'
import Timer from '~icons/lucide/timer'
import Trash2 from '~icons/lucide/trash-2'
import AgentViewer from '../Agent/AgentViewer.vue'

const { t } = useI18n()

const props = defineProps<{
  task: CronTask
  agent?: Agent
  keyword?: string
}>()

const emit = defineEmits<{
  toggle: [id: number, val: boolean]
  toggleNotify: [id: number, val: boolean]
  viewLogs: [task: CronTask]
  edit: [task: CronTask]
  copy: [task: CronTask]
  delete: [id: number]
  runNow: [id: number]
}>()

const configTypeLabel = computed(() =>
  props.task.config?.type === 'shell'
    ? t('claw.cron.configTypeShell')
    : t('claw.cron.configTypeAgent')
)
const configTypeIcon = computed(() =>
  props.task.config?.type === 'shell' ? Terminal : Bot
)
const configDetail = computed(() =>
  props.task.config?.type === 'shell'
    ? props.task.config.shell || ''
    : props.task.config?.agent || ''
)

function handleDelete() {
  Modal.confirm({
    title: t('claw.cron.deleteConfirm'),
    okText: t('claw.cron.deleteBtn'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: () => emit('delete', props.task.id),
  })
}
</script>

<template>
  <div
    class="group relative bg-white dark:bg-gray-800 rounded-xl px-5 py-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 flex items-center gap-4 flex-col md:flex-row"
  >
    <!-- 左侧：主信息 -->
    <div class="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3">
      <!-- 主信息 -->
      <div class="flex-1 min-w-0">
        <!-- 第一行：任务名 + 状态 -->
        <div class="flex items-center gap-2 mb-1.5">
          <div
            class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate"
          >
            <TextHighlight :text="task.name" :keyword="keyword" />
          </div>
          <a-tag
            v-if="task.status === 'enabled'"
            color="green"
            class="!text-xs shrink-0"
          >
            <span class="inline-flex items-center gap-1">
              <span
                class="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"
              ></span>
              {{ $t('claw.cron.tagEnabled') }}
            </span>
          </a-tag>
          <a-tag v-else color="default" class="!text-xs shrink-0">
            <span class="inline-flex items-center gap-1">
              <span
                class="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"
              ></span>
              {{ $t('claw.cron.tagDisabled') }}
            </span>
          </a-tag>
        </div>
        <!-- 第二行：执行命令/Agent -->
        <div class="flex items-center gap-1.5 mb-1.5 min-w-0">
          <component
            :is="configTypeIcon"
            class="w-3.5 h-3.5 text-primary-500 shrink-0"
          />
          <span
            class="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0"
            >{{ configTypeLabel }}</span
          >
          <span
            v-if="configDetail"
            class="text-xs text-gray-700 dark:text-gray-200 font-mono bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 rounded break-all min-w-0"
            >{{ configDetail }}</span
          >
        </div>
        <!-- 第三行：执行周期 + 所属 Agent -->
        <div class="flex items-center gap-3 mb-1.5">
          <span
            class="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 rounded-full shrink-0"
          >
            <Clock class="w-3 h-3 shrink-0" />
            <CronViewer :value="task.cron" />
          </span>
          <AgentViewer
            v-if="agent"
            :agent-id="agent.id"
            :agent-title="agent.title"
            :agent-avatar="agent.avatar"
          />
        </div>
        <!-- 第四行：时间信息 -->
        <div class="flex items-center gap-3 flex-wrap">
          <span
            class="text-xs text-gray-400 dark:text-gray-500 font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            :title="t('claw.common.copyIdTooltip')"
            @click.stop="copyText(String(task.id))"
            >#{{ task.id }}</span
          >
          <span
            class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"
          >
            <History class="w-3 h-3 shrink-0" />
            {{ $t('claw.cron.lastRun') }}
            <DatetimeViewer
              :value="task.lastRun"
              :fallback="$t('claw.cron.neverRun')"
            />
          </span>
          <span
            class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"
          >
            <Timer class="w-3 h-3 shrink-0" />
            {{ $t('claw.cron.nextRun') }}
            <DatetimeViewer
              :value="task.nextRun"
              :fallback="$t('claw.cron.pendingCalc')"
            />
          </span>
          <span
            class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"
          >
            <CalendarDays class="w-3 h-3 shrink-0" />
            {{ $t('claw.cron.createdAt') }}
            <DatetimeViewer :value="task.createdAt" />
          </span>
        </div>
      </div>
    </div>

    <!-- 操作区 -->
    <div class="md:max-w-lg grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
      <!-- 启用/禁用卡片 -->
      <button
        class="w-full flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer"
        :class="
          task.status === 'enabled'
            ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
            : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
        "
        @click="emit('toggle', task.id, task.status !== 'enabled')"
      >
        <component
          :is="task.status === 'enabled' ? CircleCheck : PauseCircle"
          class="w-4 h-4"
        />
        <span class="text-xs leading-none">{{
          task.status === 'enabled'
            ? $t('claw.cron.tagEnabled')
            : $t('claw.cron.tagDisabled')
        }}</span>
      </button>

      <!-- 成功通知 -->
      <a-tooltip :title="$t('claw.cron.successNotifyTip')">
        <div
          class="w-full flex flex-col items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
        >
          <a-switch
            :checked="task.successNotify"
            size="small"
            @change="(val: boolean) => emit('toggleNotify', task.id, val)"
          />
          <span
            class="text-xs leading-none text-gray-500 dark:text-gray-400 whitespace-nowrap"
            >{{ $t('claw.cron.successNotifyLabel') }}</span
          >
        </div>
      </a-tooltip>

      <!-- 立即执行卡片 -->
      <button
        class="w-full flex flex-col items-center gap-1 px-3 py-2 rounded-lg border bg-primary-50 border-primary-200 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-400 transition-all duration-150 cursor-pointer"
        @click="emit('runNow', task.id)"
      >
        <Play class="w-4 h-4" />
        <span class="text-xs leading-none">{{
          $t('claw.cron.runNowBtn')
        }}</span>
      </button>

      <!-- 查看日志卡片 -->
      <button
        class="w-full flex flex-col items-center gap-1 px-3 py-2 rounded-lg border bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 transition-all duration-150 cursor-pointer"
        @click="emit('viewLogs', task)"
      >
        <ScrollText class="w-4 h-4" />
        <span class="text-xs leading-none">{{ $t('claw.cron.viewLogs') }}</span>
      </button>
    </div>

    <!-- 更多操作 -->
    <a-dropdown :trigger="['hover']" placement="bottomRight">
      <a-button
        type="text"
        class="absolute! bottom-2! right-2! p-1! flex items-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        @click.stop
      >
        <MoreHorizontal class="w-4 h-4 text-gray-500" aria-hidden="true" />
      </a-button>
      <template #overlay>
        <a-menu>
          <a-menu-item @click="emit('edit', task)">
            <div class="flex items-center gap-2">
              <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
              {{ $t('claw.cron.editBtn') }}
            </div>
          </a-menu-item>
          <a-menu-item @click="emit('copy', task)">
            <div class="flex items-center gap-2">
              <Copy class="w-3.5 h-3.5" aria-hidden="true" />
              {{ $t('claw.cron.copyBtn') }}
            </div>
          </a-menu-item>
          <a-menu-item class="!text-red-500" @click="handleDelete">
            <div class="flex items-center gap-2">
              <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
              {{ $t('claw.cron.deleteBtn') }}
            </div>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>
