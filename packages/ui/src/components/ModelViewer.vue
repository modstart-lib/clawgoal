<script setup lang="ts">
import { computed } from 'vue'
import ModelIcon from './ModelIcon.vue'

const props = defineProps<{ value: string }>()

const provider = computed(() => {
  if (!props.value) return ''
  const idx = props.value.indexOf('|')
  return idx !== -1 ? props.value.slice(0, idx) : ''
})

const modelName = computed(() => {
  if (!props.value) return props.value
  const idx = props.value.indexOf('|')
  return idx !== -1 ? props.value.slice(idx + 1) : props.value
})
</script>

<template>
  <div
    v-if="value"
    class="inline-flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-md border border-gray-100"
  >
    <ModelIcon :provider="provider" :model="modelName" :size="14" />
    <span class="text-sm text-gray-700 font-medium truncate">{{
      modelName
    }}</span>
    <span v-if="provider" class="text-xs text-gray-400 shrink-0">{{
      provider
    }}</span>
  </div>
</template>
