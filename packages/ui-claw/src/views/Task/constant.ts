import type { Component } from 'vue'
import type { LabelOption } from '@/components/LabelSelector.vue'
import { useI18n } from 'vue-i18n'
import Ban from '~icons/lucide/ban'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import Clock from '~icons/lucide/clock'
import Loader2 from '~icons/lucide/loader-2'
import MessageCircle from '~icons/lucide/message-circle'
import XCircle from '~icons/lucide/x-circle'

// ─── Task 状态选项（用于 LabelViewer 展示） ────────────────────────────────────

export function useTaskStatusOptions(): LabelOption[] {
  const { t } = useI18n()
  return [
    {
      value: 'draft',
      label: t('claw.task.statusDraft'),
      class: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      icon: Clock,
    },
    {
      value: 'queue',
      label: t('claw.task.statusQueue'),
      class:
        'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      icon: Clock,
    },
    {
      value: 'ready',
      label: t('claw.task.statusReady'),
      class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      icon: Loader2,
      spin: true,
    },
    {
      value: 'pending',
      label: t('claw.task.statusPending'),
      class:
        'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      icon: Clock,
    },
    {
      value: 'asking',
      label: t('claw.task.statusAsking'),
      class:
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: MessageCircle,
    },
    {
      value: 'running',
      label: t('claw.task.statusRunning'),
      class:
        'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
      icon: Loader2,
      spin: true,
    },
    {
      value: 'success',
      label: t('claw.task.statusSuccess'),
      class:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      icon: CheckCircle2,
    },
    {
      value: 'failed',
      label: t('claw.task.statusFailed'),
      class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      icon: XCircle,
    },
    {
      value: 'canceled',
      label: t('claw.task.statusCanceled'),
      class: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      icon: Ban,
    },
  ]
}

/** @deprecated 请使用 useTaskStatusOptions() */
export const TASK_STATUS_OPTIONS: LabelOption[] = [
  {
    value: 'draft',
    label: '草稿',
    class: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    icon: Clock,
  },
  {
    value: 'queue',
    label: '队列',
    class:
      'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Clock,
  },
  {
    value: 'ready',
    label: '就绪',
    class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Loader2,
    spin: true,
  },
  {
    value: 'pending',
    label: '等待',
    class:
      'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    icon: Clock,
  },
  {
    value: 'asking',
    label: '待反馈',
    class:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: MessageCircle,
  },
  {
    value: 'running',
    label: '进行中',
    class:
      'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
    icon: Loader2,
    spin: true,
  },
  {
    value: 'success',
    label: '成功',
    class:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle2,
  },
  {
    value: 'failed',
    label: '失败',
    class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
  },
  {
    value: 'canceled',
    label: '已取消',
    class: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    icon: Ban,
  },
]

// ─── Task 状态样式（用于自定义渲染：图标背景色、文字色、圆点色、脉冲） ───────────

export interface TaskStatusStyle {
  icon: string
  label: string
  dot: string
  pulse: boolean
}

export const TASK_STATUS_STYLE: Record<string, TaskStatusStyle> = {
  draft: {
    icon: 'bg-gray-100 dark:bg-gray-600 text-gray-400',
    label: 'text-gray-400',
    dot: 'bg-gray-300',
    pulse: false,
  },
  queue: {
    icon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-500',
    label: 'text-amber-500',
    dot: 'bg-amber-400',
    pulse: false,
  },
  ready: {
    icon: 'bg-blue-100 dark:bg-blue-900/30 text-blue-500',
    label: 'text-blue-500',
    dot: 'bg-blue-400',
    pulse: false,
  },
  pending: {
    icon: 'bg-orange-100 dark:bg-orange-900/30 text-orange-500',
    label: 'text-orange-500',
    dot: 'bg-orange-400',
    pulse: false,
  },
  asking: {
    icon: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500',
    label: 'text-yellow-500',
    dot: 'bg-yellow-400',
    pulse: false,
  },
  running: {
    icon: 'bg-primary-100 dark:bg-primary-900/30 text-primary-500',
    label: 'text-primary-500',
    dot: 'bg-primary-500',
    pulse: true,
  },
  success: {
    icon: 'bg-green-100 dark:bg-green-900/30 text-green-500',
    label: 'text-green-500',
    dot: 'bg-green-500',
    pulse: false,
  },
  failed: {
    icon: 'bg-red-100 dark:bg-red-900/30 text-red-500',
    label: 'text-red-500',
    dot: 'bg-red-500',
    pulse: false,
  },
  canceled: {
    icon: 'bg-gray-100 dark:bg-gray-600 text-gray-400',
    label: 'text-gray-400',
    dot: 'bg-gray-300',
    pulse: false,
  },
}

// ─── Task 状态操作权限 ────────────────────────────────────────────────────────

export const canStopTask = (status: string) =>
  ['draft', 'queue', 'ready', 'asking', 'running'].includes(status)
export const canRetryTask = (status: string) =>
  ['failed', 'canceled'].includes(status)
export const canDeleteTask = (status: string) => status !== 'running'

// ─── Task 状态筛选图标（用于 LabelSelector 筛选面板） ─────────────────────────

export interface TaskStatusFilter {
  value: string
  label: string
  icon: Component
}
