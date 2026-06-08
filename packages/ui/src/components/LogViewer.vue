<template>
  <div class="log-viewer">
    <div class="code-header">
      <span class="code-lang">log</span>
      <button class="copy-btn" :class="{ copied }" @click="copyContent">
        <Check v-if="copied" class="w-3.5 h-3.5" />
        <Copy v-else class="w-3.5 h-3.5" />
        <span>{{ copied ? $t('common.copied') : $t('common.copy') }}</span>
      </button>
    </div>
    <div
      ref="logContainer"
      class="code-body"
      :style="maxHeight ? { maxHeight } : {}"
    >
      <pre v-if="content" class="log-content">{{ content }}</pre>
      <pre v-else class="log-empty">{{
        placeholder || t('logViewer.noLogs')
      }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { copyText } from '@/utils/utils'
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Check from '~icons/lucide/check'
import Copy from '~icons/lucide/copy'

const { t } = useI18n()

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  maxHeight: {
    type: String,
    default: '16rem',
  },
  autoScroll: {
    type: Boolean,
    default: false,
  },
})

const logContainer = ref<HTMLDivElement>()
const copied = ref(false)

const copyContent = async () => {
  try {
    await copyText(props.content, false)
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

watch(
  () => props.content,
  async () => {
    if (props.autoScroll && logContainer.value) {
      await nextTick()
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  }
)
</script>

<style scoped>
.log-viewer {
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
  overflow-y: auto;
  font-family: '"Fira Code", "JetBrains Mono", ui-monospace, monospace';
  font-size: 11px;
  white-space: pre-wrap;
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
