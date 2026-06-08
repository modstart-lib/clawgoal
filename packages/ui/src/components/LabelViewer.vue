<script setup lang="ts">
import { computed } from 'vue'
import type { LabelOption } from './LabelSelector.vue'

const props = defineProps<{
  value: string
  options: LabelOption[]
  size?: 'default' | 'small'
}>()

const opt = computed(() => props.options.find((o) => o.value === props.value))
</script>

<template>
  <span
    :class="[
      opt?.class ??
        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      size === 'small'
        ? 'px-1.5 py-px rounded-full text-xs font-medium'
        : 'px-2 py-0.5 rounded-full text-sm font-medium',
    ]"
    class="inline-flex items-center gap-1"
  >
    <component
      :is="opt.icon"
      v-if="opt?.icon"
      :class="[
        size === 'small' ? 'w-3 h-3' : 'w-3.5 h-3.5',
        opt.spin ? 'animate-spin' : '',
      ]"
    />
    {{ opt?.label ?? value }}
  </span>
</template>
