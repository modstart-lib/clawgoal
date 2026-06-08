<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FileText from '~icons/lucide/file-text'

const props = defineProps<{
  /** Primary content to display (result summary or message) */
  content?: string
  /** Optional raw logs (shown in a second tab if provided) */
  logs?: string
  /** Title displayed in the detail modal */
  title?: string
}>()

const modalOpen = ref(false)

const { t } = useI18n()

const hasDetail = computed(() => !!(props.content || props.logs))
const displayText = computed(() => props.content || props.logs || '')

function openModal() {
  if (hasDetail.value) modalOpen.value = true
}
</script>

<template>
  <!-- Inline truncated text -->
  <span
    :class="[
      'inline-flex items-center gap-1 text-xs leading-snug max-w-full',
      hasDetail
        ? 'cursor-pointer text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:underline transition-colors'
        : 'text-gray-500',
    ]"
    :title="hasDetail ? t('inlineLogViewer.clickToView') : undefined"
    @click="openModal"
  >
    <span class="truncate max-w-90">{{ displayText }}</span>
    <FileText v-if="hasDetail" class="w-3 h-3 shrink-0 opacity-70" />
  </span>

  <!-- Detail modal -->
  <a-modal
    v-model:open="modalOpen"
    :keyboard="false"
    :mask-closable="false"
    :title="title || t('inlineLogViewer.logDetail')"
    width="95vw"
    :footer="null"
  >
    <a-tabs v-if="content && logs" default-active-key="result" size="small">
      <a-tab-pane key="result" :tab="t('inlineLogViewer.execResult')">
        <pre
          class="whitespace-pre-wrap break-all text-[11px] font-mono bg-primary-50/50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200 rounded-xl p-4 max-h-[60vh] overflow-auto border border-gray-200 dark:border-gray-700 shadow-inner backdrop-blur-sm"
          >{{ content }}</pre
        >
      </a-tab-pane>
      <a-tab-pane key="logs" :tab="t('inlineLogViewer.rawLogs')">
        <pre
          class="whitespace-pre-wrap break-all text-[11px] font-mono bg-primary-50/50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200 rounded-xl p-4 max-h-[60vh] overflow-auto border border-gray-200 dark:border-gray-700 shadow-inner backdrop-blur-sm"
          >{{ logs }}</pre
        >
      </a-tab-pane>
    </a-tabs>
    <pre
      v-else
      class="whitespace-pre-wrap break-all text-[11px] font-mono bg-primary-50/50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200 rounded-xl p-4 max-h-[60vh] overflow-auto border border-gray-200 dark:border-gray-700 shadow-inner backdrop-blur-sm"
      >{{ displayText }}</pre
    >
  </a-modal>
</template>
