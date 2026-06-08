import { useI18n } from 'vue-i18n'
import type { BacklogPriority, BacklogStatus } from '@/claw/api/backlog'

// ─── Project 状态 ─────────────────────────────────────────────────────────────

export function useProjectStatusLabel(): Record<string, string> {
  const { t } = useI18n()
  return {
    planning: t('claw.project.statusPlanning'),
    active: t('claw.project.statusActive'),
    paused: t('claw.project.statusPaused'),
    done: t('claw.project.statusDone'),
  }
}

/** @deprecated use useProjectStatusLabel() */
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  planning: '规划中',
  active: '进行中',
  paused: '已暂停',
  done: '已完成',
}

export const PROJECT_STATUS_BADGE: Record<string, string> = {
  planning:
    'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400',
  active: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  paused: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  done: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
}

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  planning: 'text-gray-500',
  active: 'text-primary-600 dark:text-primary-400',
  paused: 'text-amber-500',
  done: 'text-green-600 dark:text-green-400',
}

// ─── Backlog 状态 ─────────────────────────────────────────────────────────────

export const BACKLOG_STATUSES: BacklogStatus[] = [
  'pending',
  'active',
  'pool',
  'dropped',
  'done',
]

export function useBacklogStatusConfig(): Record<
  BacklogStatus,
  { label: string; color: string; tagColor: string }
> {
  const { t } = useI18n()
  return {
    pending: {
      label: t('claw.backlog.statusPending'),
      color: 'default',
      tagColor: 'default',
    },
    active: {
      label: t('claw.backlog.statusActive'),
      color: 'blue',
      tagColor: 'blue',
    },
    pool: {
      label: t('claw.backlog.statusPool'),
      color: 'orange',
      tagColor: 'orange',
    },
    dropped: {
      label: t('claw.backlog.statusDropped'),
      color: 'red',
      tagColor: 'red',
    },
    done: {
      label: t('claw.backlog.statusDone'),
      color: 'green',
      tagColor: 'green',
    },
  }
}

/** @deprecated use useBacklogStatusConfig() */
export const BACKLOG_STATUS_CONFIG: Record<
  BacklogStatus,
  { label: string; color: string; tagColor: string }
> = {
  pending: { label: '待评估', color: 'default', tagColor: 'default' },
  active: { label: '已采纳', color: 'blue', tagColor: 'blue' },
  pool: { label: '暂缓', color: 'orange', tagColor: 'orange' },
  dropped: { label: '废弃', color: 'red', tagColor: 'red' },
  done: { label: '已完成', color: 'green', tagColor: 'green' },
}

// ─── Backlog 优先级 ────────────────────────────────────────────────────────────

export const BACKLOG_PRIORITIES: BacklogPriority[] = ['high', 'medium', 'low']

export function useBacklogPriorityConfig(): Record<
  BacklogPriority,
  { label: string; tagColor: string; textClass: string }
> {
  const { t } = useI18n()
  return {
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
}

/** @deprecated use useBacklogPriorityConfig() */
export const BACKLOG_PRIORITY_CONFIG: Record<
  BacklogPriority,
  { label: string; tagColor: string; textClass: string }
> = {
  high: {
    label: '高',
    tagColor: 'red',
    textClass: 'text-red-500 dark:text-red-400',
  },
  medium: {
    label: '中',
    tagColor: 'orange',
    textClass: 'text-orange-500 dark:text-orange-400',
  },
  low: {
    label: '低',
    tagColor: 'default',
    textClass: 'text-gray-400 dark:text-gray-500',
  },
}
