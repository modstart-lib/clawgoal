// ─── Objective 状态 ───────────────────────────────────────────────────────────
import { useI18n } from 'vue-i18n'

export function useObjectiveStatusLabel(): Record<string, string> {
  const { t } = useI18n()
  return {
    pending: t('claw.objective.statusPending'),
    active: t('claw.objective.statusActive'),
    paused: t('claw.objective.statusPaused'),
    completed: t('claw.objective.statusCompleted'),
    failed: t('claw.objective.statusFailed'),
  }
}

/** @deprecated use useObjectiveStatusLabel() */
export const OBJECTIVE_STATUS_LABEL: Record<string, string> = {
  pending: '未开始',
  active: '进行中',
  paused: '已暂停',
  completed: '已完成',
  failed: '已失败',
}

export const OBJECTIVE_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  active: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  paused: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  completed:
    'bg-primary-50 dark:bg-primary-900/20 text-primary-500 dark:text-primary-400',
  failed: 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400',
}

// ─── KeyResult 状态 ───────────────────────────────────────────────────────────

export function useKeyResultStatusLabel(): Record<string, string> {
  const { t } = useI18n()
  return {
    running: t('claw.objective.statusRunning'),
    done: t('claw.objective.statusDone'),
    canceled: t('claw.objective.statusCanceled'),
  }
}

export function useKeyResultNextStatuses() {
  const { t } = useI18n()
  return {
    running: [
      { value: 'done', label: t('claw.objective.statusDone') },
      { value: 'canceled', label: t('claw.objective.statusCanceled') },
    ],
    canceled: [{ value: 'running', label: t('claw.objective.resume') }],
  }
}

/** @deprecated use useKeyResultStatusLabel() */
export const KEY_RESULT_STATUS_LABEL: Record<string, string> = {
  running: '进行中',
  done: '已完成',
  canceled: '已取消',
}

export const KEY_RESULT_STATUS_BADGE: Record<string, string> = {
  running:
    'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
  done: 'bg-green-50 dark:bg-green-900/20 text-green-600',
  canceled: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
}

export const KEY_RESULT_STATUS_DOT: Record<string, string> = {
  running: 'bg-primary-500',
  done: 'bg-green-400',
  canceled: 'bg-gray-300 dark:bg-gray-600',
}

/** @deprecated use useKeyResultNextStatuses() */
export const KEY_RESULT_NEXT_STATUSES: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  running: [
    { value: 'done', label: '完成' },
    { value: 'canceled', label: '取消' },
  ],
  canceled: [{ value: 'running', label: '恢复' }],
}
