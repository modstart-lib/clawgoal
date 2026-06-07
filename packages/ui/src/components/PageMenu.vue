<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

interface MenuItem {
  key: string
  label: string
  icon?: Component
}

const props = defineProps<{
  modelValue: string
  items: MenuItem[]
  title?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectOptions = computed(() =>
  props.items.map((item) => ({
    value: item.key,
    label: item.label,
  }))
)
</script>

<template>
  <!-- 小屏: 下拉选择 -->
  <div class="sm:hidden w-full">
    <a-select
      :value="modelValue"
      :options="selectOptions"
      class="w-full"
      @change="(val: string) => emit('update:modelValue', val)"
    />
  </div>

  <!-- 大屏: 侧边列表 -->
  <aside class="hidden sm:block w-44 shrink-0 sticky top-4 self-start">
    <div
      class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-lg p-3 relative overflow-hidden flex flex-col"
    >
      <div
        class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-primary-hover/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"
      ></div>
      <div v-if="title" class="mb-3 relative z-10">
        <div class="text-sm font-bold text-gray-800 dark:text-gray-200">
          {{ title }}
        </div>
      </div>
      <div
        class="space-y-1.5 relative z-10 overflow-y-auto pr-1 -mr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          v-for="item in items"
          :key="item.key"
          class="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-all duration-300 group"
          :class="
            modelValue === item.key
              ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          "
          @click="emit('update:modelValue', item.key)"
        >
          <component
            :is="item.icon"
            v-if="item.icon"
            class="w-4 h-4 shrink-0"
            aria-hidden="true"
          />
          <span class="truncate">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>
