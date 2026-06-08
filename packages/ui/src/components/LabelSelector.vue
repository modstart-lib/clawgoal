<template>
  <div v-bind="$attrs" ref="containerRef" class="overflow-hidden">
    <!-- 宽度足够时：按钮组 -->
    <div
      v-if="!useSelect"
      ref="buttonGroupRef"
      class="inline-flex rounded-lg backdrop-blur-md bg-white/60 dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-700/60 p-1"
    >
      <div
        v-for="opt in options"
        :key="opt.value"
        class="cursor-pointer !text-sm !font-medium !transition-all !duration-300 !border-none !rounded-md !h-6 !inline-flex !items-center !gap-1.5 !px-3 whitespace-nowrap"
        :class="
          modelValue === opt.value
            ? '!bg-white dark:!bg-gray-700 !text-primary shadow-[0_1px_3px_rgba(0,0,0,0.05)] ring-1 ring-primary/20'
            : '!bg-transparent !text-gray-500 dark:!text-gray-400 hover:!text-primary hover:!bg-gray-50/50 dark:hover:!bg-gray-800/50'
        "
        @click="emit('update:modelValue', opt.value)"
      >
        <component
          :is="opt.icon"
          v-if="opt.icon"
          class="w-3.5 h-3.5 shrink-0"
          aria-hidden="true"
        />
        {{
          title && (opt.value === 'all' || opt.value === '') ? title : opt.label
        }}
        <span
          v-if="opt.count !== undefined"
          class="text-[11px] px-1.5 py-0.5 rounded-full transition-colors"
          :class="
            modelValue === opt.value
              ? 'bg-primary/10 text-primary font-medium'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 opacity-60 group-hover:bg-primary/10 group-hover:text-primary'
          "
          >{{ opt.count }}</span
        >
      </div>
    </div>

    <!-- 宽度不够时：下拉选择 -->
    <a-select
      v-else
      class="!w-full"
      :value="modelValue"
      @change="(v: string) => emit('update:modelValue', v)"
    >
      <a-select-option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
      >
        {{
          title && (opt.value === 'all' || opt.value === '') ? title : opt.label
        }}
        <span v-if="opt.count !== undefined" class="ml-1 text-xs opacity-60"
          >({{ opt.count }})</span
        >
      </a-select-option>
    </a-select>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

export interface LabelOption {
  value: string
  label: string
  class?: string
  count?: number
  icon?: Component
  /** 图标是否持续旋转（如 loading 状态） */
  spin?: boolean
}

const props = defineProps<{
  modelValue: string
  options: LabelOption[]
  title?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const containerRef = ref<HTMLElement | null>(null)
const buttonGroupRef = ref<HTMLElement | null>(null)
const useSelect = ref(false)

let naturalWidth = 0
let ro: ResizeObserver | null = null

const checkOverflow = () => {
  if (!containerRef.value) return
  if (buttonGroupRef.value) {
    naturalWidth = buttonGroupRef.value.offsetWidth
  }
  useSelect.value =
    naturalWidth > 0 && containerRef.value.clientWidth < naturalWidth
}

// 选项变化时重新测量（可能需要从 select 切回按钮组）
watch(
  () => props.options,
  async () => {
    if (useSelect.value) {
      useSelect.value = false
      await nextTick()
    }
    checkOverflow()
  },
  { deep: true }
)

onMounted(() => {
  nextTick(checkOverflow)
  ro = new ResizeObserver(checkOverflow)
  if (containerRef.value) ro.observe(containerRef.value)
})

onUnmounted(() => ro?.disconnect())
</script>
