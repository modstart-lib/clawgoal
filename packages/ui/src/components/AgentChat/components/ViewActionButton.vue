<template>
  <div
    class="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 cursor-pointer transition-colors group"
    @click="$emit('click')"
  >
    <Eye class="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
    <span class="text-sm text-gray-700 font-medium truncate flex-1">{{
      label
    }}</span>
    <ExternalLink
      class="w-3.5 h-3.5 text-blue-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import ExternalLink from '~icons/lucide/external-link'
import Eye from '~icons/lucide/eye'

defineProps<{
  label: string
}>()

defineEmits<{
  (e: 'click'): void
}>()
</script>
