<script setup lang="ts">
/**
 * DatetimeViewer — 将 ISO 8601 UTC 时间字符串转为本地时间显示
 *
 * Props:
 *   value   string   ISO 时间字符串，如 "2026-03-02T01:06:00.737Z"
 *   format  'datetime' | 'date' | 'time' | 'short' | 'human'
 *             datetime（默认）: 2026-03-02 09:06:00
 *             date            : 2026-03-02
 *             time            : 09:06:00
 *             short           : 03-02 09:06
 *             human           : 3分钟前 / 2小时后
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    value?: string | null
    format?: 'datetime' | 'date' | 'time' | 'short' | 'human'
    fallback?: string
  }>(),
  {
    value: null,
    format: 'datetime',
    fallback: '-',
  }
)

function pad(n: number) {
  return String(n).padStart(2, '0')
}

const display = computed<string>(() => {
  const raw = props.value
  if (!raw) return props.fallback

  // 纯日期字符串（YYYY-MM-DD）直接返回，避免时区偏移导致日期错位
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (props.format === 'date' || props.format === 'datetime') return raw
  }

  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw

  if (props.format === 'human') {
    const diffMs = d.getTime() - Date.now()
    const abs = Math.abs(diffMs)
    const past = diffMs < 0
    let text: string
    if (abs < 60_000) {
      text = t('datetimeViewer.justNow')
    } else if (abs < 3_600_000) {
      text = t('datetimeViewer.minutes', { n: Math.round(abs / 60_000) })
    } else if (abs < 86_400_000) {
      text = t('datetimeViewer.hours', { n: Math.round(abs / 3_600_000) })
    } else if (abs < 2_592_000_000) {
      text = t('datetimeViewer.days', { n: Math.round(abs / 86_400_000) })
    } else if (abs < 31_536_000_000) {
      text = t('datetimeViewer.months', { n: Math.round(abs / 2_592_000_000) })
    } else {
      text = t('datetimeViewer.years', { n: Math.round(abs / 31_536_000_000) })
    }
    return text === t('datetimeViewer.justNow')
      ? text
      : past
        ? t('datetimeViewer.ago', { time: text })
        : t('datetimeViewer.later', { time: text })
  }

  const yyyy = d.getFullYear()
  const MM = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())

  switch (props.format) {
    case 'date':
      return `${yyyy}-${MM}-${dd}`
    case 'time':
      return `${hh}:${mm}:${ss}`
    case 'short':
      return `${MM}-${dd} ${hh}:${mm}`
    default:
      return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`
  }
})
</script>

<template>
  <span class="text-gray-600 dark:text-primary-400">{{ display }}</span>
</template>
