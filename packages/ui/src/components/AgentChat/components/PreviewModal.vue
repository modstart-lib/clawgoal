<template>
  <a-modal
    v-model:open="isOpen"
    :keyboard="false"
    :mask-closable="false"
    :title="preview?.name || $t('agentChat.filePreview')"
    width="95vw"
    @cancel="handleClose"
  >
    <template #footer>
      <a-button type="default" @click="handleCopy">
        <div class="inline-flex items-center gap-1">
          <Copy class="w-4 h-4" aria-hidden="true" />
          {{ $t('agentChat.copyContent') }}
        </div>
      </a-button>
      <a-button type="default" @click="handleDownload">
        <div class="inline-flex items-center gap-1">
          <Download class="w-4 h-4" aria-hidden="true" />
          {{ $t('agentChat.downloadFile') }}
        </div>
      </a-button>
    </template>
    <div v-if="preview" class="preview-modal-content">
      <div v-if="preview.type === 'md'" class="markdown-preview">
        <MarkdownViewer :content="preview.content" />
      </div>
      <iframe
        v-else-if="preview.type === 'html'"
        :srcdoc="preview.content"
        class="html-preview-iframe"
        frameborder="0"
      ></iframe>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import Copy from '~icons/lucide/copy'
import Download from '~icons/lucide/download'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { copyText } from '../../../utils/utils'
import MarkdownViewer from '../../MarkdownViewer.vue'
import type { FilePreview } from '../types'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  preview: FilePreview | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const isOpen = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

const handleClose = () => {
  isOpen.value = false
}

const handleCopy = async () => {
  if (!props.preview) return

  try {
    await copyText(props.preview.content, false)
    message.success(t('agentChat.copySuccess'))
  } catch (error) {
    message.error(t('agentChat.copyFailed'))
  }
}

const handleDownload = () => {
  if (!props.preview) return

  try {
    const blob = new Blob([props.preview.content], {
      type: props.preview.type === 'md' ? 'text/markdown' : 'text/html',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = props.preview.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    message.success(t('agentChat.downloadSuccess'))
  } catch (error) {
    message.error(t('agentChat.downloadFailed'))
  }
}
</script>

<style scoped>
.preview-modal-content {
  max-height: 70vh;
  overflow-y: auto;
}

.markdown-preview {
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.html-preview-iframe {
  width: 100%;
  min-height: 60vh;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
</style>
