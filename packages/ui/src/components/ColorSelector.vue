<template>
  <div class="space-y-2">
    <div>
      <input
        v-if="showCustom"
        type="color"
        :value="modelValue"
        class="w-7 h-7 rounded-lg cursor-pointer border border-gray-200 border-solid dark:border-gray-600 p-0"
        :title="$t('colorSelector.customColor')"
        @input="
          emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
      />
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <div
        v-for="color in colors"
        :key="color"
        class="w-7 h-7 border-2 transition-all duration-300 cursor-pointer hover:shadow-md"
        :class="[
          shape === 'circle' ? 'rounded-full' : 'rounded-lg',
          modelValue === color
            ? 'border-primary-500 dark:border-primary-400 ring-2 ring-primary-500/30 dark:ring-primary-400/30 scale-125 shadow-lg z-10 relative'
            : 'border-white/50 dark:border-black/50 opacity-80 hover:opacity-100 hover:scale-110',
        ]"
        :style="{ background: color }"
        @click="emit('update:modelValue', color)"
      />
    </div>
  </div>
</template>

<script lang="ts">
export const DEFAULT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#06b6d4',
  '#64748b',
  '#1e293b',
]
</script>

<script setup lang="ts">
import { onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    colors?: string[]
    shape?: 'circle' | 'square'
    showCustom?: boolean
    randomOnEmpty?: boolean
  }>(),
  {
    colors: () => DEFAULT_COLORS,
    shape: 'circle',
    showCustom: false,
    randomOnEmpty: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

onMounted(() => {
  if (props.randomOnEmpty && !props.modelValue) {
    const list = props.colors
    emit('update:modelValue', list[Math.floor(Math.random() * list.length)])
  }
})
</script>
