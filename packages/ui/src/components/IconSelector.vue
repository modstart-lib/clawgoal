<template>
  <!-- 触发按钮 -->
  <div
    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/20 transition-all select-none"
    @click="open = true"
  >
    <component
      :is="currentIcon"
      v-if="currentIcon"
      class="w-4 h-4 text-gray-600 dark:text-gray-300 shrink-0"
    />
    <span class="text-sm text-gray-600 dark:text-gray-300">{{
      modelValue || t('iconSelector.placeholder')
    }}</span>
    <ChevronDown class="w-3.5 h-3.5 text-gray-400 shrink-0" />
  </div>

  <!-- 图标选择 Modal -->
  <a-modal
    v-model:open="open"
    :keyboard="false"
    :mask-closable="false"
    :title="t('iconSelector.title')"
    width="min(600px, 90vw)"
    :footer="null"
    @cancel="open = false"
  >
    <!-- 搜索框 -->
    <div class="mb-3">
      <a-input-search
        v-model:value="query"
        :placeholder="t('iconSelector.searchPlaceholder')"
        allow-clear
        class="!rounded-lg"
      />
    </div>

    <!-- 图标网格 -->
    <div class="h-80 overflow-y-auto pr-1">
      <div
        v-if="filteredIcons.length === 0"
        class="flex items-center justify-center h-full text-gray-400 text-sm"
      >
        {{ t('iconSelector.noMatch') }}
      </div>
      <div v-else class="grid grid-cols-8 gap-1.5">
        <div
          v-for="icon in filteredIcons"
          :key="icon.name"
          :title="icon.name"
          class="flex flex-col items-center justify-center gap-1 p-2 rounded-lg cursor-pointer border-2 transition-all hover:bg-primary/5 dark:hover:bg-primary/20"
          :class="
            modelValue === icon.name
              ? 'border-primary bg-primary/10 dark:bg-primary/20'
              : 'border-transparent hover:border-primary/30 dark:hover:border-primary/30'
          "
          @click="handleSelect(icon.name)"
        >
          <component
            :is="icon.component"
            class="w-5 h-5"
            :class="
              modelValue === icon.name
                ? 'text-primary'
                : 'text-gray-500 dark:text-gray-400'
            "
          />
          <span
            class="text-[9px] leading-tight text-center text-gray-400 w-full truncate"
            >{{ icon.name }}</span
          >
        </div>
      </div>
    </div>

    <!-- 当前选择 -->
    <div
      v-if="modelValue"
      class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between"
    >
      <div class="flex items-center gap-2 text-sm text-gray-500">
        <component :is="currentIcon" class="w-4 h-4 text-primary" />
        <span
          >{{ t('iconSelector.selectedPrefix')
          }}<span class="text-gray-700 dark:text-gray-200 font-medium">{{
            modelValue
          }}</span></span
        >
      </div>
      <a-button type="text" danger @click="handleClear">{{
        t('iconSelector.clearBtn')
      }}</a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ChevronDown from '~icons/lucide/chevron-down'

import { getIconComponent, ICON_LIST } from './icons/icons'

const { t } = useI18n()

const props = defineProps<{
  modelValue?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | null): void
}>()

const open = ref(false)
const query = ref('')

const currentIcon = computed(() => {
  if (!props.modelValue) return null
  return getIconComponent(props.modelValue)
})

const filteredIcons = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return ICON_LIST
  return ICON_LIST.filter((i) => i.name.toLowerCase().includes(q))
})

const handleSelect = (name: string) => {
  emit('update:modelValue', name)
  open.value = false
}

const handleClear = () => {
  emit('update:modelValue', null)
}
</script>
