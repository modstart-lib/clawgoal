<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FileText from '~icons/lucide/file-text'
import LogViewer from './LogViewer.vue'

defineProps<{
  logs: string
  title?: string
  maxHeight?: string
}>()

const { t } = useI18n()
const open = ref(false)
</script>

<template>
  <a-button
    class="inline-flex items-center text-primary-600 bg-primary-50 hover:bg-primary-100 dark:text-primary-400 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 rounded-lg transition-colors border-0"
    @click="open = true"
  >
    <div class="inline-flex items-center gap-1">
      <FileText class="w-4 h-4" aria-hidden="true" />
      {{ t('logViewerButton.viewLogs') }}
    </div>
  </a-button>
  <a-modal
    v-model:open="open"
    :keyboard="false"
    :mask-closable="false"
    :title="title || t('logViewerButton.logsTitle')"
    :footer="null"
    width="95vw"
  >
    <LogViewer :content="logs" :max-height="maxHeight || '65vh'" theme="dark" />
  </a-modal>
</template>
