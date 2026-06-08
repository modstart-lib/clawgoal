<script setup lang="ts">
defineProps<{
  items: { label: string; value: string | number }[]
}>()
</script>

<template>
  <div
    v-if="items.length > 0"
    class="border-t border-gray-100 px-2 py-1 space-y-0.5"
  >
    <div
      v-for="item in items"
      :key="item.label"
      class="text-xs flex items-center gap-1"
    >
      <span class="text-gray-400 shrink-0">{{ item.label }}:</span>
      <span class="text-gray-600 truncate">{{ item.value }}</span>
    </div>
  </div>
</template>
