<template>
  <div
    class="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.03)] z-10 transition-all duration-300"
  >
    <!-- 工具栏 (折叠区域) -->
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="transform opacity-0 -translate-y-2 h-0"
      enter-to-class="transform opacity-100 translate-y-0 h-auto"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="transform opacity-100 translate-y-0 h-auto"
      leave-to-class="transform opacity-0 -translate-y-2 h-0"
    >
      <div
        v-if="toolsPanelVisible"
        class="overflow-hidden border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50"
      >
        <div class="max-w-3xl mx-auto w-full flex flex-wrap gap-6 p-4">
          <label
            class="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 cursor-pointer transition group"
          >
            <div
              class="w-12 h-12 rounded-full bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 flex items-center justify-center group-hover:border-blue-400 group-hover:shadow-md transition"
            >
              <ImageIcon
                class="w-6 h-6 text-gray-400 dark:text-gray-300 group-hover:text-blue-500 transition"
              />
            </div>
            <span class="text-xs">{{ $t('agentChat.uploadImage') }}</span>
            <input
              ref="imageInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handleImageSelect"
            />
          </label>

          <label
            class="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 cursor-pointer transition group"
          >
            <div
              class="w-12 h-12 rounded-full bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 flex items-center justify-center group-hover:border-blue-400 group-hover:shadow-md transition"
            >
              <FileText
                class="w-6 h-6 text-gray-400 dark:text-gray-300 group-hover:text-blue-500 transition"
              />
            </div>
            <span class="text-xs">{{ $t('agentChat.uploadFile') }}</span>
            <input
              ref="fileInput"
              type="file"
              multiple
              class="hidden"
              @change="handleFileSelect"
            />
          </label>

          <!-- Custom tool actions -->
          <div
            v-for="(action, idx) in toolActions"
            :key="idx"
            class="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 cursor-pointer transition group"
            @click="openToolAction(action)"
          >
            <div
              class="w-12 h-12 rounded-full bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 flex items-center justify-center group-hover:border-blue-400 group-hover:shadow-md transition"
            >
              <component
                :is="resolveIcon(action.icon)"
                class="w-6 h-6 text-gray-400 dark:text-gray-300 group-hover:text-blue-500 transition"
              />
            </div>
            <span class="text-xs">{{ action.title }}</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- 预览区域 -->
    <div
      v-if="selectedImages.length > 0 || selectedFiles.length > 0"
      class="px-4 pt-3 pb-1"
    >
      <div class="max-w-3xl mx-auto w-full flex gap-2 overflow-x-auto">
        <!-- 图片预览 -->
        <div
          v-for="(image, idx) in selectedImages"
          :key="'img-' + idx"
          class="relative group shrink-0"
        >
          <img
            :src="image.preview"
            class="w-14 h-14 object-cover rounded-lg border border-gray-200"
          />
          <a-button
            type="primary"
            danger
            shape="circle"
            class="absolute -top-1.5 -right-1.5 !w-5 !h-5 !min-w-0 !p-0 flex items-center justify-center z-10"
            @click="removeImage(idx)"
          >
            <X class="w-3 h-3" />
          </a-button>
        </div>
        <!-- 文件预览 -->
        <div
          v-for="(file, idx) in selectedFiles"
          :key="'file-' + idx"
          class="relative group shrink-0 w-32 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-2 flex flex-col justify-center"
        >
          <div class="flex items-center gap-1.5 mb-1">
            <FileText class="w-4 h-4 text-gray-400 dark:text-gray-400" />
            <span
              class="text-[10px] text-gray-400 dark:text-gray-400 uppercase"
              >{{ file.name.split('.').pop() }}</span
            >
          </div>
          <div class="text-xs text-gray-700 dark:text-gray-300 truncate w-full">
            {{ file.name }}
          </div>
          <div
            type="primary"
            danger
            shape="circle"
            class="absolute -top-1.5 -right-1.5 !w-5 !h-5 !min-w-0 !p-0 flex items-center justify-center z-10 cursor-pointer"
            @click="removeFile(idx)"
          >
            <X class="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域主体 -->
    <div class="p-3 sm:p-4">
      <div class="max-w-3xl mx-auto w-full flex items-end gap-3">
        <!-- 加号/工具开关 -->
        <div
          type="text"
          shape="circle"
          class="!h-10 !w-10 flex items-center justify-center !rounded-full !text-gray-400 hover:!text-blue-600 hover:!bg-blue-50 transition-colors focus:outline-none shrink-0 cursor-pointer"
          :class="{ '!text-blue-600 !bg-blue-50': toolsPanelVisible }"
          @click="toggleToolsPanel"
        >
          <Plus
            class="w-6 h-6 transition-transform duration-300"
            :class="{ 'rotate-45': toolsPanelVisible }"
          />
        </div>

        <!-- 文本输入 -->
        <div
          class="relative flex-1 bg-gray-100 dark:bg-gray-700 rounded-[20px] px-4 py-2 focus-within:bg-white dark:focus-within:bg-gray-600 focus-within:ring-2 focus-within:ring-blue-100 focus-within:shadow-sm border border-transparent focus-within:border-blue-200 transition-all"
        >
          <a-textarea
            v-model:value="userInput"
            :placeholder="
              selectedImages.length || selectedFiles.length
                ? $t('agentChat.addDescription')
                : placeholder
            "
            :auto-size="{ minRows: 1, maxRows: 6 }"
            :rows="1"
            :bordered="false"
            class="bg-transparent! border-0! text-sm shadow-none! px-0! pb-0! resize-none! hover:bg-transparent focus:bg-transparent"
            @keydown="handleKeydown"
          />
          <!-- 快捷键切换提示（绝对定位到右下角） -->
          <span
            class="absolute bottom-4 right-3.5 text-[10px] text-gray-400 hover:text-blue-500 cursor-pointer select-none transition-colors leading-none"
            :title="
              enterToSubmit
                ? $t('agentChat.switchToCtrlEnter')
                : $t('agentChat.switchToEnter')
            "
            @click="toggleEnterMode"
          >
            {{
              enterToSubmit
                ? $t('agentChat.enterToSend')
                : $t('agentChat.ctrlEnterToSend')
            }}
          </span>
        </div>

        <!-- 停止按钮（loading 且 stoppable 时显示） -->
        <div
          v-if="props.loading && props.stoppable"
          class="!h-10 !w-10 flex items-center justify-center !rounded-full bg-red-500 hover:bg-red-600 cursor-pointer transition-all duration-200 shrink-0"
          @click="emit('stop')"
        >
          <Square class="w-4 h-4 text-white" />
        </div>
        <!-- 发送按钮 -->
        <div
          v-else
          :disabled="!canSend"
          type="primary"
          shape="circle"
          class="!h-10 !w-10 flex items-center justify-center !rounded-full transition-all duration-200 shrink-0"
          :class="{
            'hover:shadow-md transform hover:-translate-y-0.5 cursor-pointer':
              canSend,
            'cursor-not-allowed': !canSend,
          }"
          @click="sendMessage"
        >
          <Send class="w-5 h-5 ml-0.5" :class="{ 'opacity-50': !canSend }" />
        </div>
      </div>
    </div>

    <!-- Tool action form modal (overlays the chat area) -->
    <ToolActionFormModal
      v-if="activeToolAction && toolActionModalVisible"
      :visible="toolActionModalVisible"
      :action="activeToolAction"
      :get-container="
        props.modalContainer
          ? () => props.modalContainer as HTMLElement
          : undefined
      "
      @update:visible="toolActionModalVisible = $event"
      @send="handleToolActionSend"
    />
  </div>
</template>

<script setup lang="ts">
import { ICON_MAP as LucideIcons } from '@/components/icons/icons'
import {
  Button as AButton,
  Textarea as ATextarea,
  message,
} from 'ant-design-vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FileText from '~icons/lucide/file-text'
import ImageIcon from '~icons/lucide/image'
import Plus from '~icons/lucide/plus'
import Send from '~icons/lucide/send'
import Square from '~icons/lucide/square'
import X from '~icons/lucide/x'
import Zap from '~icons/lucide/zap'
import type { ToolAction } from '../types'
import ToolActionFormModal from './ToolActionFormModal.vue'

const { t } = useI18n()

/** Resolve a Lucide icon component by name, falling back to Zap */
const resolveIcon = (name?: string) => {
  if (!name) return Zap
  return (LucideIcons as Record<string, unknown>)[name] ?? Zap
}

interface Props {
  loading?: boolean
  stoppable?: boolean
  placeholder?: string
  maxFileSize?: number // MB
  maxImageSize?: number // MB
  toolActions?: ToolAction[]
  modalContainer?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  stoppable: false,
  placeholder: 'How can we help you today?',
  maxFileSize: 10,
  maxImageSize: 5,
  toolActions: () => [],
  modalContainer: null,
})

const emit = defineEmits<{
  (e: 'send', data: { content: string; images: any[]; files: any[] }): void
  (e: 'stop'): void
}>()

// State
const userInput = ref('')
const toolsPanelVisible = ref(false)
const selectedImages = ref<any[]>([])
const selectedFiles = ref<any[]>([])
const imageInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// Tool action modal state
const toolActionModalVisible = ref(false)
const activeToolAction = ref<ToolAction | null>(null)

const openToolAction = (action: ToolAction) => {
  activeToolAction.value = action
  toolActionModalVisible.value = true
  toolsPanelVisible.value = false
}

const handleToolActionSend = (content: string) => {
  toolsPanelVisible.value = false
  emit('send', { content, images: [], files: [] })
}

// Enter 提交模式：true = Enter 提交（Shift+Enter 换行），false = Ctrl+Enter 提交
const enterToSubmit = ref(true)

const toggleEnterMode = () => {
  enterToSubmit.value = !enterToSubmit.value
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.isComposing) return
  if (enterToSubmit.value) {
    // Enter 提交，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      sendMessage()
    }
  } else {
    // Ctrl+Enter 提交，Enter 换行
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      sendMessage()
    }
  }
}

const canSend = computed(() => {
  return (
    (userInput.value.trim() !== '' ||
      selectedImages.value.length > 0 ||
      selectedFiles.value.length > 0) &&
    !props.loading
  )
})

const toggleToolsPanel = () => {
  toolsPanelVisible.value = !toolsPanelVisible.value
}

const handleImageSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files) return
  const files = Array.from(input.files)

  for (const file of files) {
    if (file.size > props.maxImageSize * 1024 * 1024) {
      message.error(
        t('agentChat.imageSizeExceeded', {
          name: file.name,
          size: props.maxImageSize,
        })
      )
      continue
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      selectedImages.value.push({
        file: file,
        name: file.name,
        size: file.size,
        preview: e.target?.result,
      })
    }
    reader.readAsDataURL(file)
  }
  input.value = ''
}

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files) return
  const files = Array.from(input.files)

  for (const file of files) {
    if (file.size > props.maxFileSize * 1024 * 1024) {
      message.error(
        t('agentChat.fileSizeExceeded', {
          name: file.name,
          size: props.maxFileSize,
        })
      )
      continue
    }
    selectedFiles.value.push({
      file: file,
      name: file.name,
      size: file.size,
    })
  }
  input.value = ''
}

const removeImage = (index: number) => {
  selectedImages.value.splice(index, 1)
}

const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1)
}

const sendMessage = () => {
  if (!canSend.value) return

  const messageData = {
    content: userInput.value.trim(),
    images: selectedImages.value.map((img) => ({
      name: img.name,
      size: img.size,
      url: img.preview,
      file: img.file,
    })),
    files: selectedFiles.value.map((file) => ({
      name: file.name,
      size: file.size,
      file: file.file,
    })),
  }

  emit('send', messageData)

  userInput.value = ''
  selectedImages.value = []
  selectedFiles.value = []
  toolsPanelVisible.value = false
}

defineExpose({
  clearInput: () => {
    userInput.value = ''
    selectedImages.value = []
    selectedFiles.value = []
  },
})
</script>

<style scoped>
/* Override Ant Design Textarea styles to make it completely invisible */
:deep(.ant-input) {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  resize: none !important;
}

:deep(.ant-input:focus) {
  box-shadow: none !important;
}
</style>
