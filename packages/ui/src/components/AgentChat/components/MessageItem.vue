<template>
  <div
    class="flex w-full"
    :class="
      msg.type === 'newSession'
        ? 'justify-center'
        : msg.role === 'user'
          ? 'justify-end'
          : 'justify-start'
    "
  >
    <!-- New Session Divider -->
    <div
      v-if="msg.type === 'newSession'"
      class="flex items-center gap-3 w-full py-1"
    >
      <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
      <span
        class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap select-none"
        >{{ t('agentChat.newSession') }}</span
      >
      <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
    </div>

    <!-- User Message -->
    <div
      v-else-if="msg.role === 'user'"
      class="flex flex-row-reverse max-w-[85%] items-end gap-2"
    >
      <div
        class="p-2 bg-blue-50 text-gray-800 rounded-2xl rounded-tr-none border border-blue-100 text-[15px] leading-relaxed break-words whitespace-pre-wrap"
      >
        <!-- 文本消息 -->
        <div v-if="msg.content">
          {{ msg.content }}
        </div>

        <!-- 图片列表 (User) -->
        <div
          v-if="msg.images && msg.images.length > 0"
          class="flex flex-wrap gap-2 mt-2 justify-end"
        >
          <div
            v-for="(image, idx) in msg.images"
            :key="idx"
            class="relative group"
          >
            <img
              :src="image.url"
              :alt="image.name"
              class="w-32 h-32 object-cover rounded-lg border border-blue-200 cursor-pointer hover:opacity-90 transition"
              @click="$emit('preview-image', image)"
            />
          </div>
        </div>

        <!-- 文件列表 (User) -->
        <div v-if="msg.files && msg.files.length > 0" class="space-y-1 mt-2">
          <div
            v-for="(file, idx) in msg.files"
            :key="idx"
            class="flex items-center gap-2 bg-blue-100 rounded px-3 py-2 border border-blue-200"
          >
            <FileText class="w-4 h-4 text-blue-600 shrink-0" />
            <span class="text-gray-700 flex-1 truncate">{{ file.name }}</span>
            <span class="text-gray-500 opacity-80">{{
              formatFileSize(file.size)
            }}</span>
            <div
              v-if="file.url || file.file"
              class="shrink-0 p-1 rounded hover:bg-blue-200 text-blue-600 transition-colors"
              :title="$t('agentChat.downloadFile')"
              @click.stop="downloadFile(file)"
            >
              <Download class="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Assistant Message -->
    <div v-else class="flex max-w-[85%] items-start gap-3">
      <!-- 头像 -->
      <div
        class="shrink-0 h-9 w-9 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center border border-gray-100 dark:border-gray-600 overflow-hidden mt-1"
      >
        <!-- 可以替换为专门的机器人图片 -->
        <img
          v-if="botAvatar"
          :src="botAvatar"
          class="w-full h-full object-cover"
        />
        <Bot v-else class="w-5 h-5 text-blue-500" />
      </div>

      <div class="flex flex-col gap-1 min-w-0">
        <!-- 气泡 -->
        <div
          class="py-2 px-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 text-[15px] leading-relaxed break-words"
        >
          <!-- 文本消息 (Markdown渲染) -->
          <div v-if="msg.content" class="overflow-hidden">
            <MarkdownViewer :content="msg.content" />
          </div>

          <!-- 图片列表 (Assistant) -->
          <div
            v-if="msg.images && msg.images.length > 0"
            class="grid grid-cols-2 gap-2 my-2"
          >
            <div
              v-for="(image, idx) in msg.images"
              :key="idx"
              class="relative group"
            >
              <img
                :src="image.url"
                :alt="image.name"
                class="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition"
                @click="$emit('preview-image', image)"
              />
              <div
                class="absolute top-1 right-1 bg-white/90 rounded px-2 py-0.5 text-[10px] text-gray-600 backdrop-blur-sm"
              >
                {{ image.name }}
              </div>
            </div>
          </div>

          <!-- 文件列表 (Assistant) -->
          <div v-if="msg.files && msg.files.length > 0" class="space-y-1 my-2">
            <div
              v-for="(file, idx) in msg.files"
              :key="idx"
              class="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded px-3 py-2 border border-gray-200 dark:border-gray-600"
            >
              <FileText
                class="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0"
              />
              <span class="text-gray-700 dark:text-gray-300 flex-1 truncate">{{
                file.name
              }}</span>
              <span class="text-gray-500 dark:text-gray-400">{{
                formatFileSize(file.size)
              }}</span>
              <div
                v-if="file.url || file.file"
                class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                :title="$t('agentChat.downloadFile')"
                @click.stop="downloadFile(file)"
              >
                <Download class="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <!-- 文件预览按钮 -->
          <PreviewButton
            v-if="msg.preview"
            :preview="msg.preview"
            :class="{
              'mt-2': msg.content || msg.images?.length || msg.files?.length,
            }"
            @click="$emit('preview-file', msg.preview)"
          />

          <!-- Stage（节点/任务生命周期/工具调用/工作流） -->
          <MessageItemStage
            v-if="msg.stage"
            :stage="msg.stage"
            :meta="msg.meta"
            :fetch-logs="fetchLogs"
            :class="{
              'mt-3': msg.content || msg.images?.length || msg.files?.length,
            }"
          />

          <!-- 操作视图按钮（查看工具详情、代码变更等） -->
          <ViewActionButton
            v-if="msg.actionView"
            :label="msg.actionView.label"
            :class="{
              'mt-1': msg.stage,
              'mt-2':
                !msg.stage &&
                (msg.content || msg.images?.length || msg.files?.length),
            }"
            @click="$emit('action-view', msg.actionView.data)"
          />
          <!-- 问答卡片 -->
          <MessageItemAsk
            v-if="msg.asks && msg.asks.length > 0"
            :asks="msg.asks"
            @submit="handleQuestionnaireSubmit"
          />
        </div>

        <!-- Suggests 快捷回复按钮 -->
        <div
          v-if="msg.suggests && msg.suggests.length > 0"
          class="flex flex-wrap gap-2 mt-2"
        >
          <button
            v-for="(s, idx) in msg.suggests"
            :key="idx"
            :disabled="s.checked"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors"
            :class="
              s.checked
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-500'
                : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 cursor-pointer dark:bg-gray-800 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30'
            "
            @click="handleSuggestClick(idx, s.text)"
          >
            {{ s.text }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Bot from '~icons/lucide/bot'
import Download from '~icons/lucide/download'
import FileText from '~icons/lucide/file-text'
import MarkdownViewer from '../../MarkdownViewer.vue'
import type { AgentMessage, FilePreview, MessageAsk } from '../types'
import MessageItemAsk from './MessageItemAsk.vue'
import MessageItemStage from './MessageItemStage.vue'
import PreviewButton from './PreviewButton.vue'
import ViewActionButton from './ViewActionButton.vue'

const props = defineProps<{
  msg: AgentMessage
  botAvatar?: string
  /** 获取工具日志的函数，由外部（claw）注入 */
  fetchLogs?: (
    toolCallId: string
  ) => Promise<{ items: any[]; status?: string; durationMs?: number }>
}>()

const emit = defineEmits<{
  (e: 'preview-image', image: any): void
  (e: 'preview-file', preview: FilePreview): void
  (e: 'action-view', data: any): void
  (
    e: 'questionnaire-submit',
    payload: { msgId: string; asks: MessageAsk[] }
  ): void
  (
    e: 'suggest-click',
    payload: { msgId: string; text: string; index: number }
  ): void
}>()

const { t } = useI18n()

const handleQuestionnaireSubmit = (asks: MessageAsk[]) => {
  emit('questionnaire-submit', { msgId: props.msg.id, asks })
}

const handleSuggestClick = (index: number, text: string) => {
  if (props.msg.suggests?.[index]?.checked) return
  emit('suggest-click', { msgId: props.msg.id, text, index })
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return ''
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

const downloadFile = (file: { name: string; url?: string; file?: File }) => {
  let url: string
  let needRevoke = false
  if (file.url) {
    url = file.url
  } else if (file.file) {
    url = URL.createObjectURL(file.file)
    needRevoke = true
  } else {
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (needRevoke) {
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
}
</script>
