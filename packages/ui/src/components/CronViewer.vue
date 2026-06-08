<script setup lang="ts">
/**
 * CronViewer — 友好展示 Cron 表达式
 *
 * Props:
 *   value  string  5 位标准 Cron 表达式（分 时 日 月 周）
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ value: string; block?: boolean }>()
const { t } = useI18n()

const WEEK_NAMES: Record<string, () => string> = {
  '0': () => t('cronViewer.weekSun'),
  '1': () => t('cronViewer.weekMon'),
  '2': () => t('cronViewer.weekTue'),
  '3': () => t('cronViewer.weekWed'),
  '4': () => t('cronViewer.weekThu'),
  '5': () => t('cronViewer.weekFri'),
  '6': () => t('cronViewer.weekSat'),
}

function pad(n: number | string) {
  return String(n).padStart(2, '0')
}

const description = computed<string>(() => {
  const raw = (props.value ?? '').trim()
  if (!raw) return '—'
  const parts = raw.split(/\s+/)
  if (parts.length !== 5) return raw
  const [min, hour, dom, , dow] = parts

  // 每 N 分钟
  if (/^\*\/(\d+)$/.test(min) && hour === '*' && dom === '*' && dow === '*') {
    const n = min.split('/')[1]
    return t('cronViewer.everyNMinutes', { n })
  }

  // 每 N 小时 M 分
  if (
    /^\*\/(\d+)$/.test(hour) &&
    dom === '*' &&
    dow === '*' &&
    /^\d+$/.test(min)
  ) {
    const n = hour.split('/')[1]
    return t('cronViewer.everyNHoursAtM', { n, min })
  }

  // 每 N 天 H:M
  if (
    /^\*\/(\d+)$/.test(dom) &&
    dow === '*' &&
    /^\d+$/.test(hour) &&
    /^\d+$/.test(min)
  ) {
    const n = dom.split('/')[1]
    return t('cronViewer.everyNDaysAt', {
      n,
      time: `${pad(hour)}:${pad(min)}`,
    })
  }

  // 每小时整点
  if (min === '0' && hour === '*' && dom === '*' && dow === '*') {
    return t('cronViewer.everyHourly')
  }

  // 每天 H:M
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && dow === '*') {
    return t('cronViewer.everyDayAt', { time: `${pad(hour)}:${pad(min)}` })
  }

  // 每周某天 H:M
  if (
    /^\d+$/.test(min) &&
    /^\d+$/.test(hour) &&
    dom === '*' &&
    /^\d+$/.test(dow)
  ) {
    const dayName = WEEK_NAMES[dow]?.() ?? `${dow}`
    return t('cronViewer.everyWeekdayAt', {
      day: dayName,
      time: `${pad(hour)}:${pad(min)}`,
    })
  }

  // 每月某日 H:M
  if (
    /^\d+$/.test(min) &&
    /^\d+$/.test(hour) &&
    /^\d+$/.test(dom) &&
    dow === '*'
  ) {
    return t('cronViewer.everyMonthDayAt', {
      dom,
      time: `${pad(hour)}:${pad(min)}`,
    })
  }

  return raw
})
</script>

<template>
  <span
    v-if="value && !block"
    class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-800/60 p-1"
  >
    <span class="text-xs tracking-wide">{{ description }}</span>
    <code
      class="font-mono text-xs text-[11px] text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700"
    >
      {{ value }}
    </code>
  </span>
  <span v-else-if="value && block" class="flex flex-col gap-0.5">
    <span class="text-xs text-gray-500 dark:text-gray-400">{{
      description
    }}</span>
    <code class="font-mono text-xs text-primary-500 dark:text-primary-400">{{
      value
    }}</code>
  </span>
  <span v-else class="text-sm text-gray-400">—</span>
</template>
