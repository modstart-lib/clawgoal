<template>
  <div class="fixed left-0 top-1/2 -translate-y-1/2 z-[100]">
    <!-- 收起状态：箭头按钮 -->
    <div
      v-if="!open"
      class="flex items-center justify-center w-4 h-9 rounded-r-lg bg-white/90 dark:bg-zinc-800/90 border border-l-0 border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
      @click="open = true"
    >
      <ChevronRightIcon class="w-3 h-3" aria-hidden="true" />
    </div>
    <!-- 展开状态：调试面板 -->
    <div
      v-else
      class="flex items-center gap-1.5 px-2 py-1.5 rounded-r-xl bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm border border-l-0 border-gray-200 dark:border-gray-700 shadow-xl"
    >
      <a-select
        :value="activeType"
        style="width: 130px"
        @change="handleTypeChange"
      >
        <a-select-option
          v-for="type in availableTypes"
          :key="type.key"
          :value="type.key"
          >{{ type.label }}</a-select-option
        >
      </a-select>
      <a-dropdown placement="bottomRight">
        <a-button class="inline-flex items-center">
          <MoreHorizontalIcon class="w-4 h-4" aria-hidden="true" />
        </a-button>
        <template #overlay>
          <a-menu>
            <a-menu-item key="copy-route" @click="copyCurrentRoute">{{
              t('debugPanel.copyRoute')
            }}</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
      <a-button class="inline-flex items-center" @click="open = false">
        <ChevronLeftIcon class="w-4 h-4" aria-hidden="true" />
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ChevronLeftIcon from '~icons/lucide/chevron-left'
import ChevronRightIcon from '~icons/lucide/chevron-right'
import MoreHorizontalIcon from '~icons/lucide/more-horizontal'
import { copyText } from '@/utils/utils'

const { t } = useI18n()

const props = defineProps<{
  modules: Array<{ key: string; label: string; homeMode: unknown }>
  activeType: string
}>()

const emit = defineEmits<{
  (e: 'typeSwitch', key: string): void
}>()

const route = useRoute()
const open = ref(false)

const availableTypes = computed(() =>
  props.modules
    .filter((m) => m.homeMode !== null)
    .map((m) => ({ key: m.key, label: m.label }))
)

const handleTypeChange = (val: string) => {
  emit('typeSwitch', val)
  open.value = false
}

const copyCurrentRoute = () => {
  copyText(route.path, t('debugPanel.copiedRoute'))
}
</script>
