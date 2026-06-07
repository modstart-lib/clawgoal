<template>
  <a-modal
    :open="open"
    :title="$t('agentChat.stageDetailTitle')"
    :width="'min(700px, 90vw)'"
    :footer="null"
    @cancel="$emit('update:open', false)"
  >
    <div class="space-y-3 text-sm">
      <!-- 头部：工具名称 + 状态 + 日志按钮 -->
      <div class="flex items-center gap-3">
        <span
          v-if="meta?.toolName"
          class="font-mono text-blue-600 dark:text-blue-400 flex-1 truncate"
          >{{ meta.label || meta.toolName }}</span
        >
        <span v-else class="flex-1" />
        <span
          :class="
            stage.status === 'success'
              ? 'text-emerald-600 dark:text-emerald-400'
              : stage.status === 'error'
                ? 'text-red-500 dark:text-red-400'
                : 'text-blue-500 dark:text-blue-400'
          "
        >
          {{
            stage.status === 'success'
              ? $t('agentChat.statusSuccess')
              : stage.status === 'error'
                ? $t('agentChat.statusError')
                : $t('agentChat.statusRunning')
          }}
        </span>
        <a-button
          v-if="meta?.toolCallId && fetchLogs"
          type="text"
          class="inline-flex items-center shrink-0"
          :title="$t('agentChat.viewLogs')"
          @click="openLogModal"
        >
          <ScrollText class="w-4 h-4" aria-hidden="true" />
        </a-button>
      </div>

      <!-- 调用参数 -->
      <div v-if="detailParams">
        <div class="text-gray-500 dark:text-gray-400 mb-1">
          {{ $t('agentChat.callParams') }}
        </div>
        <CodeViewer :content="detailParams" lang="json" />
      </div>
      <!-- 返回结果 -->
      <div v-if="stage.success || stage.error">
        <div class="text-gray-500 dark:text-gray-400 mb-1">
          {{ $t('agentChat.callResult') }}
        </div>
        <div
          class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 overflow-auto max-h-64"
          :class="
            stage.status === 'error'
              ? 'text-red-500 dark:text-red-400 text-xs whitespace-pre-wrap break-all'
              : ''
          "
        >
          <MarkdownViewer
            v-if="stage.status !== 'error'"
            :content="stage.success || ''"
            text-size="xs"
          />
          <span v-else>{{ stage.error }}</span>
        </div>
      </div>
    </div>
  </a-modal>

  <!-- 独立日志弹窗 -->
  <ToolLogModal
    v-model:open="logModalOpen"
    :tool-name="meta?.label || meta?.toolName"
    :status="logStatus"
    :duration-ms="logDurationMs"
    :items="logItems"
    :loading="logLoading"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ScrollText from '~icons/lucide/scroll-text'
import CodeViewer from '../../CodeViewer.vue'
import MarkdownViewer from '../../MarkdownViewer.vue'
import type { MessageStage } from '../types'
import ToolLogModal, { type ToolLogItem } from './ToolLogModal.vue'

const props = defineProps<{
  open: boolean
  stage: MessageStage
  meta?: Record<string, any>
  /** 获取工具日志的函数，由外部（claw）注入 */
  fetchLogs?: (
    toolCallId: string
  ) => Promise<{ items: ToolLogItem[]; status?: string; durationMs?: number }>
}>()

defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const { t } = useI18n()

const logModalOpen = ref(false)
const logLoading = ref(false)
const logItems = ref<ToolLogItem[]>([])
const logStatus = ref<string | undefined>()
const logDurationMs = ref<number | undefined>()

const detailParams = computed(() => {
  if (!props.meta?.detail) return null
  try {
    const parsed = JSON.parse(props.meta.detail)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return props.meta.detail
  }
})

async function openLogModal() {
  logModalOpen.value = true
  if (!props.fetchLogs || !props.meta?.toolCallId) return
  logLoading.value = true
  logItems.value = []
  logStatus.value = undefined
  logDurationMs.value = undefined
  try {
    const result = await props.fetchLogs(props.meta.toolCallId)
    logItems.value = result.items
    logStatus.value = result.status
    logDurationMs.value = result.durationMs
  } catch {
    logItems.value = [{ type: 'text', content: t('agentChat.loadLogFailed') }]
  } finally {
    logLoading.value = false
  }
}
</script>
