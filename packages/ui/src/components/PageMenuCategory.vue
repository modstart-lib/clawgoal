<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface MenuItem {
  key: string
  label: string
  count?: number
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    items: MenuItem[]
    title?: string
    allLabel?: string
    allCount?: number
  }>(),
  {
    title: '',
    allLabel: '',
    allCount: 0,
  }
)

const effectiveTitle = computed(
  () => props.title || t('pageMenuCategory.title')
)
const effectiveAllLabel = computed(
  () => props.allLabel || t('pageMenuCategory.allLabel')
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectOptions = computed(() => [
  {
    value: '',
    label:
      effectiveAllLabel.value +
      (props.allCount !== undefined ? ` (${props.allCount})` : ''),
  },
  ...props.items.map((item) => ({
    value: item.key,
    label: item.label + (item.count !== undefined ? ` (${item.count})` : ''),
  })),
])
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
      class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-lg p-3 relative overflow-hidden max-h-[calc(100vh-12rem)] flex flex-col"
    >
      <div
        class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-primary-hover/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"
      ></div>
      <div v-if="effectiveTitle" class="mb-3 relative z-10">
        <div class="text-sm font-bold text-gray-800 dark:text-gray-200">
          {{ effectiveTitle }}
        </div>
      </div>
      <div
        class="space-y-1.5 relative z-10 overflow-y-auto pr-1 -mr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          class="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-all duration-300 group"
          :class="
            modelValue === ''
              ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          "
          @click="emit('update:modelValue', '')"
        >
          <span>{{ effectiveAllLabel }}</span>
          <span
            v-if="allCount !== undefined"
            class="text-xs px-1.5 py-0.5 rounded-full transition-colors"
            :class="
              modelValue === ''
                ? 'bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary-200'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
            "
            >{{ allCount }}</span
          >
        </div>
        <div
          v-for="item in items"
          :key="item.key"
          class="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-all duration-300 group"
          :class="
            modelValue === item.key
              ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          "
          @click="emit('update:modelValue', item.key)"
        >
          <span class="truncate pr-1">{{ item.label }}</span>
          <span
            v-if="item.count !== undefined"
            class="text-xs px-1.5 py-0.5 rounded-full transition-colors shrink-0"
            :class="
              modelValue === item.key
                ? 'bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary-200'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
            "
            >{{ item.count }}</span
          >
        </div>
      </div>
    </div>
  </aside>
</template>
