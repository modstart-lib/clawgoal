<script setup lang="ts">
import { computed } from 'vue'
import { safeJsonParse } from '@/utils/utils'

const props = defineProps<{
  meta: string | Record<string, unknown> | null | undefined
}>()

function isUrl(val: unknown): boolean {
  if (typeof val !== 'string') return false
  return /^https?:\/\//i.test(val.trim())
}

const entries = computed<Array<{ key: string; value: unknown }>>(() => {
  if (!props.meta) return []
  let obj: Record<string, unknown>
  if (typeof props.meta === 'string') {
    try {
      obj = safeJsonParse(props.meta, {})
    } catch {
      return []
    }
  } else {
    obj = props.meta
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return []
  return Object.entries(obj).map(([key, value]) => ({ key, value }))
})
</script>

<template>
  <div v-if="entries.length > 0" class="space-y-1.5">
    <div
      v-for="entry in entries"
      :key="entry.key"
      class="flex items-start gap-2 text-sm"
    >
      <span
        class="font-medium text-gray-500 dark:text-gray-400 shrink-0 min-w-[80px] pt-px"
        >{{ entry.key }}</span
      >
      <span class="text-gray-700 dark:text-gray-300 break-all">
        <a
          v-if="isUrl(entry.value)"
          :href="String(entry.value)"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary hover:underline"
          >{{ entry.value }}</a
        >
        <template v-else>{{ entry.value }}</template>
      </span>
    </div>
  </div>
</template>
