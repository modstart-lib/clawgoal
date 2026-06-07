<template>
  <a-modal
    :open="open"
    :title="$t('agentChat.toolLogTitle')"
    width="min(800px, 95vw)"
    :footer="null"
    :body-style="{ padding: 0 }"
    @cancel="$emit('update:open', false)"
  >
    <div class="flex flex-col" style="height: min(70vh, 600px)">
      <!-- 工具名 + 状态 + 耗时 -->
      <div
        class="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 shrink-0"
      >
        <span
          v-if="toolName"
          class="font-mono text-sm text-blue-600 dark:text-blue-400 flex-1 truncate"
          >{{ toolName }}</span
        >
        <span v-else class="flex-1" />
        <span
          v-if="status"
          class="text-xs"
          :class="
            status === 'success'
              ? 'text-emerald-600 dark:text-emerald-400'
              : status === 'error'
                ? 'text-red-500 dark:text-red-400'
                : 'text-blue-500 dark:text-blue-400'
          "
        >
          {{
            status === 'success'
              ? $t('agentChat.statusSuccess')
              : status === 'error'
                ? $t('agentChat.statusError')
                : $t('agentChat.statusRunning')
          }}
        </span>
        <span
          v-if="durationMs"
          class="text-xs text-gray-400 dark:text-gray-500 shrink-0"
        >
          {{ durationMs }} ms
        </span>
      </div>

      <!-- 日志内容 -->
      <div class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <div
          v-if="loading"
          class="flex items-center justify-center h-full text-gray-400"
        >
          <a-spin />
        </div>

        <!-- 结构化日志 -->
        <div v-else-if="items && items.length > 0" class="p-3 space-y-1">
          <template v-for="(item, idx) in items" :key="idx">
            <!-- 动作行 -->
            <div
              v-if="item.type === 'action'"
              class="flex items-start gap-2 px-2 py-1.5 rounded text-xs"
              :class="
                item.status === 'error'
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : item.status === 'running'
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'bg-white dark:bg-gray-800'
              "
            >
              <!-- 状态图标 -->
              <span class="shrink-0 mt-0.5">
                <CheckCircle2
                  v-if="item.status === 'success'"
                  class="w-3.5 h-3.5 text-emerald-500"
                  aria-hidden="true"
                />
                <XCircle
                  v-else-if="item.status === 'error'"
                  class="w-3.5 h-3.5 text-red-500"
                  aria-hidden="true"
                />
                <Loader2
                  v-else
                  class="w-3.5 h-3.5 text-blue-500 animate-spin"
                  aria-hidden="true"
                />
              </span>
              <!-- 标题 + 内容 -->
              <div class="flex-1 min-w-0">
                <span
                  class="font-medium"
                  :class="
                    item.status === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-700 dark:text-gray-300'
                  "
                  >{{ item.title }}</span
                >
                <span
                  v-if="item.content"
                  class="ml-1.5 text-gray-500 dark:text-gray-400 break-all"
                  >{{ item.content }}</span
                >
              </div>
            </div>

            <!-- 纯文本行 -->
            <pre
              v-else
              class="px-2 py-1 text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all leading-relaxed"
              >{{ item.content }}</pre
            >
          </template>
        </div>

        <!-- 无日志 -->
        <div
          v-else
          class="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-500"
        >
          {{ $t('agentChat.noLogs') }}
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import CheckCircle2 from '~icons/lucide/check-circle-2'
import Loader2 from '~icons/lucide/loader-2'
import XCircle from '~icons/lucide/x-circle'

export interface ToolLogItem {
  type: 'text' | 'action'
  title?: string
  content: string
  status?: 'running' | 'success' | 'error'
}

defineProps<{
  open: boolean
  toolName?: string
  status?: string
  durationMs?: number
  items?: ToolLogItem[]
  loading?: boolean
}>()

defineEmits<{
  (e: 'update:open', val: boolean): void
}>()
</script>
