<template>
  <div>
    <div
      v-if="buttonViewText"
      class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-600 cursor-pointer hover:text-gray-700 hover:border-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-400 transition-colors select-none"
      @click="modalOpen = true"
    >
      <Eye class="w-3 h-3" aria-hidden="true" />
      {{ buttonViewText }}
    </div>
    <!-- 单行预览 + 图标操作 -->
    <div
      v-else
      class="relative rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 bg-white/60 dark:bg-gray-900/60"
    >
      <!-- 浮动按钮 -->
      <div class="absolute top-1 right-1 flex items-center gap-0.5">
        <a-button
          v-if="!expanded"
          type="text"
          class="shrink-0 !p-0.5 !h-auto !min-w-0 !leading-none text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          :title="t('codeInlineViewer.fullscreen')"
          @click="modalOpen = true"
        >
          <Maximize2 class="w-3 h-3" aria-hidden="true" />
        </a-button>
        <a-button
          type="text"
          class="shrink-0 !p-0.5 !h-auto !min-w-0 !leading-none text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          :title="expanded ? t('common.collapse') : t('common.expand')"
          @click="expanded = !expanded"
        >
          <ChevronDown
            :class="[
              'w-3 h-3 transition-transform duration-200',
              expanded ? 'rotate-180' : '',
            ]"
            aria-hidden="true"
          />
        </a-button>
      </div>
      <!-- 收起：单行预览 -->
      <div v-if="!expanded" class="pr-10">
        <span
          class="truncate text-xs text-gray-500 dark:text-gray-400 leading-tight cursor-pointer transition-colors font-mono block"
          @click="expanded = !expanded"
          >{{ linePreview }}</span
        >
      </div>
      <!-- 展开内容 -->
      <div v-else class="pr-3">
        <CodeViewer :content="content" :lang="lang" />
      </div>
    </div>
    <a-modal
      v-model:open="modalOpen"
      :keyboard="false"
      :mask-closable="false"
      :title="t('codeInlineViewer.detail')"
      :footer="null"
      width="min(600px, 90vw)"
      destroy-on-close
    >
      <div class="py-2">
        <CodeViewer :content="content" :lang="lang" />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ChevronDown from '~icons/lucide/chevron-down'
import Maximize2 from '~icons/lucide/maximize-2'
import Eye from '~icons/lucide/eye'
import CodeViewer from './CodeViewer.vue'

const { t } = useI18n()

const props = defineProps<{
  content: string
  lang?: string
  buttonViewText?: string
}>()

const expanded = ref(false)
const modalOpen = ref(false)

const linePreview = computed(() => {
  const trimmed = props.content.trim()
  if (
    (trimmed.startsWith('{') || trimmed.startsWith('[')) &&
    trimmed.length > 1
  ) {
    try {
      const parsed = JSON.parse(trimmed)
      const compact = JSON.stringify(parsed)
      return compact.length > 120 ? compact.slice(0, 120) + '…' : compact
    } catch {
      // fall through
    }
  }
  const firstLine =
    props.content.split('\n').find((l) => l.trim().length > 0) ?? ''
  return firstLine.length > 120 ? firstLine.slice(0, 120) + '…' : firstLine
})
</script>
