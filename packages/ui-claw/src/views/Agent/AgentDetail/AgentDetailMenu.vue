<script setup lang="ts">
import type { Component } from 'vue'

interface MenuItem {
  key: string
  label: string
  icon: Component
}

defineProps<{
  modelValue: string
  items: MenuItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <!-- 大屏：纵向菜单 -->
  <div
    class="hidden md:flex flex-col bg-white dark:bg-gray-800 rounded-2xl p-2 border border-gray-200 dark:border-gray-700 flex-1"
  >
    <div
      v-for="item in items"
      :key="item.key"
      class="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 mb-1"
      :class="
        modelValue === item.key
          ? 'bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900 shadow-md'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
      "
      @click="emit('update:modelValue', item.key)"
    >
      <component :is="item.icon" class="w-5 h-5" />
      <span class="font-medium text-sm">{{ item.label }}</span>
    </div>
  </div>

  <!-- 小屏：水平滚动菜单 -->
  <div
    class="flex md:hidden bg-white dark:bg-gray-800 rounded-2xl px-2 py-2 border border-gray-200 dark:border-gray-700 overflow-x-auto"
  >
    <div
      v-for="item in items"
      :key="item.key"
      class="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 shrink-0 mr-1"
      :class="
        modelValue === item.key
          ? 'bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900 shadow-md'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
      "
      @click="emit('update:modelValue', item.key)"
    >
      <component :is="item.icon" class="w-4 h-4" />
      <span class="font-medium text-sm whitespace-nowrap">{{
        item.label
      }}</span>
    </div>
  </div>
</template>
