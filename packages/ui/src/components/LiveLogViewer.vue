<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { copyText } from '@/utils/utils'
import Check from '~icons/lucide/check'
import Copy from '~icons/lucide/copy'
import WrapText from '~icons/lucide/wrap-text'
import ArrowDownToLine from '~icons/lucide/arrow-down-to-line'

const { t } = useI18n()

const props = defineProps<{
  /**
   * 拉取日志的函数，传入当前已读取的字符偏移量，
   * 返回 { content: 新内容, done: 是否已结束 }
   */
  fetchFn: (startOffset: number) => Promise<{ content: string; done: boolean }>
  /** 是否处于活动（实时拉取）状态，默认 true */
  active?: boolean
  /** 日志区域最大高度，默认 12rem */
  maxHeight?: string
  /** 无日志时的占位文本 */
  placeholder?: string
}>()

const content = ref('')
const offset = ref(0)
const logContainer = ref<HTMLDivElement | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null
const copied = ref(false)
const autoScroll = ref(true)
const wordWrap = ref(true)

async function fetchMore() {
  try {
    const result = await props.fetchFn(offset.value)
    if (result.content) {
      content.value += result.content
      offset.value += result.content.length
      await nextTick()
      if (logContainer.value && autoScroll.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    }
    if (result.done) stopPoll()
  } catch {
    // 忽略拉取错误，等下次重试
  }
}

function startPoll() {
  stopPoll()
  fetchMore()
  pollTimer = setInterval(fetchMore, 1500)
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const copyContent = async () => {
  try {
    await copyText(content.value, false)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

onMounted(() => {
  if (props.active !== false) {
    startPoll()
  } else {
    fetchMore()
  }
})

watch(
  () => props.active,
  (active) => {
    if (active) {
      startPoll()
    } else {
      stopPoll()
      // 任务结束后补拉一次，确保获取完整日志
      fetchMore()
    }
  }
)

onUnmounted(stopPoll)
</script>

<template>
  <div class="live-log-viewer">
    <div class="code-header">
      <span class="code-lang">log</span>
      <div class="header-actions">
        <button
          class="toggle-btn"
          :class="{ active: wordWrap }"
          @click="wordWrap = !wordWrap"
        >
          <WrapText class="w-3.5 h-3.5" aria-hidden="true" />
          <span>{{ t('liveLogViewer.wordWrap') }}</span>
        </button>
        <button
          class="toggle-btn"
          :class="{ active: autoScroll }"
          @click="autoScroll = !autoScroll"
        >
          <ArrowDownToLine class="w-3.5 h-3.5" aria-hidden="true" />
          <span>{{ t('liveLogViewer.autoScroll') }}</span>
        </button>
        <button class="copy-btn" :class="{ copied }" @click="copyContent">
          <Check v-if="copied" class="w-3.5 h-3.5" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ copied ? t('common.copied') : t('common.copy') }}</span>
        </button>
      </div>
    </div>
    <div
      ref="logContainer"
      class="code-body"
      :style="{
        maxHeight: maxHeight || '12rem',
        whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
      }"
    >
      <pre v-if="content" class="log-content">{{ content }}</pre>
      <pre v-else class="log-empty">{{
        placeholder || t('logViewer.noLogs')
      }}</pre>
    </div>
  </div>
</template>

<style scoped>
.live-log-viewer {
  border-radius: 12px;
  overflow: hidden;
  font-size: 0.8125rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--color-glass-border);
}

.code-header {
  background-color: #1a1a1a;
  color: #d1d5db;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.75rem;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.15s;
  border: 1px solid #444;
  color: #6b7280;
}

.toggle-btn:hover {
  border-color: #666;
  color: #9ca3af;
}

.toggle-btn.active {
  border-color: var(--token-primary);
  color: var(--token-primary);
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.15s;
  border: 1px solid #444;
  color: #9ca3af;
}

.copy-btn:hover {
  border-color: var(--token-primary);
  color: var(--token-primary);
  background-color: rgba(255, 255, 255, 0.08);
}

.copy-btn.copied {
  border-color: var(--token-primary) !important;
  color: var(--token-primary) !important;
}

.code-body {
  background-color: #0d0d0d;
  color: #e5e7eb;
  overflow: auto;
  font-family: '"Fira Code", "JetBrains Mono", ui-monospace, monospace';
  font-size: 11px;
  word-wrap: break-word;
  padding: 1rem;
}

.code-lang {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  text-transform: lowercase;
}

.log-content,
.log-empty {
  margin: 0;
  font-family: inherit;
  font-size: inherit;
}

.log-empty {
  opacity: 0.5;
}
</style>
