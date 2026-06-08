<template>
  <div
    ref="chatContainerEl"
    class="agent-chat-container relative flex flex-col h-full bg-[#f3f4f6] dark:bg-gray-900 overflow-hidden font-sans"
  >
    <!-- Header -->
    <div
      v-if="props.botName"
      class="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shrink-0"
    >
      <div class="flex items-center gap-2">
        <img
          v-if="props.botAvatar"
          :src="props.botAvatar"
          class="w-7 h-7 rounded-full object-cover shrink-0"
        />
        <Bot v-else class="w-5 h-5 text-blue-500 shrink-0" />
        <span
          class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate"
          >{{ props.botName }}</span
        >
      </div>
      <slot name="header-actions">
        <a-dropdown
          :get-popup-container="getPopupContainer"
          placement="bottomRight"
          :trigger="['hover']"
        >
          <a-button type="text" class="inline-flex items-center" @click.stop>
            <MoreHorizontal class="w-4 h-4" aria-hidden="true" />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="newSession" @click="handleNewSession">
                <div class="flex items-center gap-2">
                  <Plus class="w-4 h-4" />
                  {{ t('agentChat.newSession') }}
                </div>
              </a-menu-item>
              <a-menu-item key="sessions" @click="handleSessions">
                <div class="flex items-center gap-2">
                  <History class="w-4 h-4" />
                  {{ t('agentChat.sessions') }}
                </div>
              </a-menu-item>
              <slot name="menu-extra" />
              <a-menu-divider />
              <a-menu-item key="clearMessages" @click="handleClearMessages">
                <div class="flex items-center gap-2 text-red-500">
                  <Trash2 class="w-4 h-4" />
                  {{ t('agentChat.clearMessages') }}
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </slot>
    </div>

    <!-- 消息列表 -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto px-4 py-4 flex flex-col"
    >
      <div class="max-w-3xl mx-auto w-full flex-1 flex flex-col space-y-6">
        <!-- 初始加载状态 -->
        <div
          v-if="props.initialLoading"
          class="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-gray-500"
        >
          <span class="relative flex h-8 w-8">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-50"
            ></span>
            <span
              class="relative inline-flex rounded-full h-8 w-8 bg-blue-500"
            ></span>
          </span>
          <span class="text-sm">{{ t('agentChat.loading') }}</span>
        </div>

        <!-- 无消息空状态 -->
        <div
          v-else-if="
            !props.initialLoading &&
            messages.length === 0 &&
            !internalMsgLoading
          "
          class="flex flex-col items-center justify-center h-full text-center px-6 select-none"
        >
          <Inbox class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <div class="space-y-1.5">
            <div
              class="text-base font-semibold text-gray-800 dark:text-gray-200"
            >
              {{ t('agentChat.noMessages') }}
            </div>
            <div class="text-sm text-gray-400 dark:text-gray-500 max-w-60">
              {{ t('agentChat.noMessagesDesc') }}
            </div>
          </div>
        </div>

        <!-- 加载更多历史消息按钮 -->
        <div
          v-if="hasMoreHistory || historyLoading"
          class="flex justify-center py-2"
        >
          <button
            v-if="hasMoreHistory && !historyLoading"
            class="text-sm text-blue-500 hover:text-blue-700 px-4 py-1.5 rounded-full border border-blue-200 hover:border-blue-400 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-blue-400 transition-colors"
            @click="emit('loadMore')"
          >
            {{ t('agentChat.loadMoreHistory') }}
          </button>
          <div
            v-else-if="historyLoading"
            class="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500"
          >
            <span class="relative flex h-2 w-2">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"
              ></span>
            </span>
            {{ t('agentChat.loading') }}
          </div>
        </div>

        <MessageItem
          v-for="msg in messages"
          :key="msg.id"
          :msg="msg"
          :bot-avatar="botAvatar"
          :fetch-logs="fetchLogs"
          @preview-image="previewImage"
          @preview-file="handlePreviewFile"
          @questionnaire-submit="handleQuestionnaireSubmit"
          @suggest-click="handleSuggestClick"
          @action-view="(data) => emit('action-view', data)"
        />

        <!-- 加载中 -->
        <div v-if="internalMsgLoading" class="flex justify-start max-w-[85%]">
          <div class="flex items-start gap-3">
            <div
              class="shrink-0 h-9 w-9 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center border border-gray-100 dark:border-gray-600 mt-1"
            >
              <Bot class="w-5 h-5 text-blue-500" />
            </div>
            <div
              class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-2xl rounded-tl-none flex items-center gap-2"
            >
              <span class="relative flex h-2 w-2">
                <span
                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
                ></span>
                <span
                  class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"
                ></span>
              </span>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{
                t('agentChat.stageThinking')
              }}</span>
            </div>
          </div>
        </div>

        <div class="h-2"></div>
      </div>
    </div>

    <!-- 底部输入栏 -->
    <InputArea
      ref="inputAreaRef"
      :loading="isLoading || internalMsgLoading"
      :stoppable="stoppable"
      :placeholder="placeholder"
      :max-file-size="maxFileSize"
      :max-image-size="maxImageSize"
      :tool-actions="toolActions"
      :modal-container="chatContainerEl"
      @send="handleSend"
      @stop="emit('stop')"
    />

    <!-- 图片预览模态框 -->
    <AgentChatImagesPreviewModal
      v-model:visible="imagePreviewVisible"
      :image="previewingImage"
    />

    <!-- 文件预览弹窗 -->
    <AgentChatPreviewModal
      v-model:visible="previewModalVisible"
      :preview="currentPreview"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Bot from '~icons/lucide/bot'
import Inbox from '~icons/lucide/inbox'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import History from '~icons/lucide/history'
import AgentChatImagesPreviewModal from './components/AgentChatImagesPreviewModal.vue'
import AgentChatPreviewModal from './components/AgentChatPreviewModal.vue'
import InputArea from './components/InputArea.vue'
import MessageItem from './components/MessageItem.vue'
import { getDemoMessages } from './demo'
import type {
  AgentMessage,
  AgentMessageMeta,
  FilePreview,
  MessageAsk,
  ToolAction,
} from './types'

const { t } = useI18n()

// Define props with TS types
interface Props {
  modelValue?: AgentMessage[]
  loading?: boolean
  stoppable?: boolean
  botAvatar?: string
  botName?: string
  placeholder?: string
  maxFileSize?: number
  maxImageSize?: number
  demo?: boolean
  toolActions?: ToolAction[]
  hasMoreHistory?: boolean
  historyLoading?: boolean
  initialLoading?: boolean
  /** 获取工具日志的函数，由外部（claw）注入 */
  fetchLogs?: (
    toolCallId: string
  ) => Promise<{ items: any[]; status?: string; durationMs?: number }>
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  loading: false,
  stoppable: false,
  botAvatar: undefined,
  botName: undefined,
  placeholder: 'How can we help you today?',
  maxFileSize: 10,
  maxImageSize: 5,
  demo: false,
  toolActions: () => [],
  hasMoreHistory: false,
  historyLoading: false,
  initialLoading: false,
  fetchLogs: undefined,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: AgentMessage[]): void
  (
    e: 'send',
    data: {
      content: string
      images: any[]
      files: any[]
      meta?: AgentMessageMeta
    }
  ): void
  (
    e: 'questionnaire-submit',
    payload: { msgId: string; asks: MessageAsk[] }
  ): void
  (e: 'loadMore'): void
  (e: 'clear'): void
  (e: 'new-session'): void
  (e: 'sessions'): void
  (e: 'stop'): void
  (e: 'action-view', data: any): void
}>()

// computed shim for messages
const messages = computed({
  get: () => {
    if (props.demo) {
      return getDemoMessages()
    }
    return props.modelValue
  },
  set: (value) => emit('update:modelValue', value),
})

// State
const isLoading = computed(() => props.loading)
const chatContainerEl = ref<HTMLElement | null>(null)
const getPopupContainer = () => chatContainerEl.value ?? document.body
const messagesContainer = ref<HTMLElement | null>(null)
const inputAreaRef = ref<InstanceType<typeof InputArea> | null>(null)

const imagePreviewVisible = ref(false)
const previewingImage = ref<any>(null)

const previewModalVisible = ref(false)
const currentPreview = ref<FilePreview | null>(null)

// 内部 msgLoading：发送后显示，收到 assistant 消息后隐藏
const internalMsgLoading = ref(false)

// Scroll position preservation when prepending history messages
let savedScrollHeight = 0
let savedScrollTop = 0
let prepending = false
let prevFirstMsgId = ''

const scrollToBottom = (behavior: 'smooth' | 'instant' | 'auto' = 'smooth') => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior,
      })
    }
  })
}

// Detect prepend (load more history) vs append (new messages)
watch(
  () => props.modelValue,
  (newVal, oldVal) => {
    if (!newVal || !oldVal) return
    const newLen = newVal.length
    const oldLen = oldVal.length
    if (newLen > oldLen && newLen > 0 && oldLen > 0) {
      const newFirstId = newVal[0]?.id ?? ''
      if (newFirstId !== prevFirstMsgId && prevFirstMsgId !== '') {
        // Messages were prepended — preserve scroll position
        prepending = true
        if (messagesContainer.value) {
          savedScrollHeight = messagesContainer.value.scrollHeight
          savedScrollTop = messagesContainer.value.scrollTop
        }
        nextTick(() => {
          if (prepending && messagesContainer.value) {
            const delta =
              messagesContainer.value.scrollHeight - savedScrollHeight
            messagesContainer.value.scrollTop = savedScrollTop + delta
            prepending = false
          }
        })
        prevFirstMsgId = newVal[0]?.id ?? ''
        return
      }
    }
    // 有新消息时滚到底部
    scrollToBottom()
    prevFirstMsgId = newVal[0]?.id ?? ''
  },
  { deep: false }
)

watch(
  () => messages.value.length,
  () => {
    // 有新消息且最后一条是 assistant 消息时，隐藏 loading
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant') {
      internalMsgLoading.value = false
    }
    if (!prepending) {
      scrollToBottom()
    }
  }
)

watch(internalMsgLoading, (val) => {
  if (val) {
    scrollToBottom()
  }
})

watch(
  () => props.initialLoading,
  (val) => {
    if (!val) {
      // 初始加载完成，直接跳到底部无动画
      scrollToBottom('instant')
    }
  }
)

const previewImage = (image: any) => {
  previewingImage.value = image
  imagePreviewVisible.value = true
}

const handlePreviewFile = (preview: FilePreview) => {
  currentPreview.value = preview
  previewModalVisible.value = true
}

const handleSend = (data: {
  content: string
  images: any[]
  files: any[]
  meta?: AgentMessageMeta
}) => {
  internalMsgLoading.value = true
  emit('send', data)
}

const handleClearMessages = () => {
  emit('clear')
}

const handleNewSession = () => {
  emit('new-session')
}

const handleSessions = () => {
  emit('sessions')
}

const handleQuestionnaireSubmit = (payload: {
  msgId: string
  asks: MessageAsk[]
}) => {
  const msgIndex = messages.value.findIndex((m) => m.id === payload.msgId)
  if (msgIndex !== -1) {
    messages.value[msgIndex].asks = payload.asks
  }

  const content = payload.asks
    .map((ask) => `${ask.question}\n${ask.optionSelected}`)
    .join('\n\n')

  handleSend({
    content,
    images: [],
    files: [],
    meta: { type: 'asksResponse', msgId: payload.msgId },
  })
}

const handleSuggestClick = (payload: {
  msgId: string
  text: string
  index: number
}) => {
  const msgIndex = messages.value.findIndex((m) => m.id === payload.msgId)
  if (msgIndex !== -1 && messages.value[msgIndex].suggests) {
    const suggests = [...(messages.value[msgIndex].suggests ?? [])]
    suggests[payload.index] = { ...suggests[payload.index]!, checked: true }
    messages.value[msgIndex] = { ...messages.value[msgIndex], suggests }
  }
  handleSend({ content: payload.text, images: [], files: [] })
}

defineExpose({
  scrollToBottom: () => scrollToBottom('instant'),
  clearInput: () => {
    inputAreaRef.value?.clearInput()
  },
})
</script>

<style scoped>
.agent-chat-container {
  /* Container styles */
}

/* Custom Scrollbar for messages */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}
</style>
