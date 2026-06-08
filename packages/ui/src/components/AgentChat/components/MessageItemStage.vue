<template>
  <div v-bind="$attrs" class="py-1 flex items-start gap-2.5 text-xs">
    <div class="shrink-0 mt-0.5">
      <Loader2
        v-if="stage.status === 'running'"
        class="w-4 h-4 text-blue-500 animate-spin"
      />
      <CheckCircle2
        v-else-if="stage.status === 'success'"
        class="w-4 h-4 text-emerald-500"
      />
      <XCircle v-else class="w-4 h-4 text-red-500" />
    </div>
    <div class="flex-1 min-w-0">
      <span class="font-medium text-gray-700 dark:text-gray-300">
        {{ stage.title }}
      </span>
      <!-- 成功摘要 -->
      <div
        v-if="stage.status === 'success' && stage.success"
        class="mt-0.5 text-gray-500 dark:text-gray-400 break-all"
      >
        {{
          stage.success.length > 120
            ? stage.success.slice(0, 120) + '…'
            : stage.success
        }}
      </div>
      <!-- 错误信息 -->
      <div
        v-if="stage.status === 'error' && stage.error"
        class="mt-0.5 text-red-500 dark:text-red-400"
      >
        {{ stage.error }}
      </div>
    </div>
    <!-- 详情按钮（有 meta 信息时显示） -->
    <a-button
      v-if="hasDetail"
      type="text"
      class="shrink-0 inline-flex items-center"
      :title="$t('agentChat.stageDetail')"
      @click.stop="showDetail = true"
    >
      <Eye class="w-3.5 h-3.5" aria-hidden="true" />
    </a-button>
  </div>

  <MessageItemStageDetailModal
    v-if="hasDetail"
    v-model:open="showDetail"
    :stage="stage"
    :meta="meta"
    :fetch-logs="fetchLogs"
  />
</template>

<script setup lang="ts">
import CheckCircle2 from '~icons/lucide/check-circle-2'
import Eye from '~icons/lucide/eye'
import Loader2 from '~icons/lucide/loader-2'
import XCircle from '~icons/lucide/x-circle'
import { computed, ref } from 'vue'
import type { MessageStage } from '../types'
import MessageItemStageDetailModal from './MessageItemStageDetailModal.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  stage: MessageStage
  meta?: Record<string, any>
  /** 获取工具日志的函数，由外部（claw）注入 */
  fetchLogs?: (
    toolCallId: string
  ) => Promise<{ items: any[]; status?: string; durationMs?: number }>
}>()

const showDetail = ref(false)

const hasDetail = computed(() => {
  return !!(
    props.meta?.toolName ||
    props.meta?.detail ||
    props.stage.success ||
    props.stage.error
  )
})
</script>
