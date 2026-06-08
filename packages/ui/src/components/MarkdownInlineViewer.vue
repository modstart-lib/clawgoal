<template>
  <div
    class="relative rounded-lg border border-gray-100/80 dark:border-gray-700/50 px-3 py-1.5 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm"
  >
    <!-- 浮动按钮 -->
    <div class="absolute top-1 right-1 flex items-center gap-0.5">
      <a-button
        v-if="!expanded"
        type="text"
        class="shrink-0 !p-0.5 !h-auto !min-w-0 !leading-none text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
        :title="$t('markdownInlineViewer.viewAll')"
        @click="modalOpen = true"
      >
        <Maximize2 class="w-3 h-3" aria-hidden="true" />
      </a-button>
      <a-button
        type="text"
        class="shrink-0 !p-0.5 !h-auto !min-w-0 !leading-none text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
        :title="
          expanded
            ? $t('markdownInlineViewer.collapse')
            : $t('markdownInlineViewer.expand')
        "
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
        class="truncate text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 leading-tight cursor-pointer transition-colors block"
        @click="expanded = !expanded"
        >{{ plainPreview }}</span
      >
    </div>
    <!-- 展开内容 -->
    <div v-else class="pr-1 max-h-[20rem] overflow-y-auto custom-scrollbar">
      <MarkdownViewer :content="content" :text-size="'xs'" />
    </div>
    <a-modal
      v-model:open="modalOpen"
      :keyboard="false"
      :mask-closable="false"
      :title="$t('markdownInlineViewer.detail')"
      :footer="null"
      width="min(600px, 90vw)"
      destroy-on-close
    >
      <div class="max-h-[70vh] overflow-y-auto py-2">
        <MarkdownViewer :content="content" />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ChevronDown from '~icons/lucide/chevron-down'
import Maximize2 from '~icons/lucide/maximize-2'
import MarkdownViewer from './MarkdownViewer.vue'

const props = defineProps<{ content: string }>()

const expanded = ref(false)
const modalOpen = ref(false)

const plainPreview = computed(() =>
  props.content
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
)
</script>
