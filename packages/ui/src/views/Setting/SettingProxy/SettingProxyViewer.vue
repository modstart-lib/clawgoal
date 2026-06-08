<script setup lang="ts">
import Shield from '~icons/lucide/shield'

defineProps<{
  proxyName?: string
}>()
</script>

<template>
  <div v-if="proxyName" class="flex items-center gap-1">
    <Shield class="w-3.5 h-3.5 text-orange-400 shrink-0" aria-hidden="true" />
    <span class="text-xs font-mono text-orange-600 dark:text-orange-400">{{
      proxyName
    }}</span>
  </div>
</template>
