<template>
  <div v-if="props.switchCode" class="relative">
    <div class="absolute top-0 right-0 flex items-center gap-0.5 z-10">
      <a-tooltip
        v-if="viewMode === 'preview'"
        :title="t('markdownViewer.source')"
      >
        <div
          class="cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400"
          @click="viewMode = 'code'"
        >
          <Code2 class="w-4 h-4" aria-hidden="true" />
        </div>
      </a-tooltip>
      <a-tooltip v-else :title="t('markdownViewer.preview')">
        <div
          class="cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400"
          @click="viewMode = 'preview'"
        >
          <Eye class="w-4 h-4" aria-hidden="true" />
        </div>
      </a-tooltip>
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      v-if="viewMode === 'preview'"
      :class="[
        'markdown-viewer',
        { 'markdown-viewer--xs': props.textSize === 'xs' },
      ]"
      v-html="renderedHtml"
    ></div>
    <pre
      v-else
      :class="[
        'whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 overflow-auto leading-relaxed select-text',
        props.textSize === 'xs' ? 'text-xs' : 'text-sm',
      ]"
      >{{ props.content }}</pre
    >
  </div>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div
    v-else
    :class="[
      'markdown-viewer',
      { 'markdown-viewer--xs': props.textSize === 'xs' },
    ]"
    v-html="renderedHtml"
  ></div>
</template>

<script setup lang="ts">
import { marked, type Tokens } from 'marked'
import { computed, PropType, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Code2 from '~icons/lucide/code-2'
import Eye from '~icons/lucide/eye'

const { t } = useI18n()

const props = defineProps({
  content: { type: String, default: '' },
  textSize: { type: String as PropType<'base' | 'xs'>, default: 'base' },
  switchCode: { type: Boolean, default: false },
})

const viewMode = ref<'preview' | 'code'>('preview')

const renderer = new marked.Renderer()
const originalLinkRenderer = renderer.link.bind(renderer)

renderer.link = (token: Tokens.Link) => {
  const html = originalLinkRenderer(token)
  return html.replace('<a', '<a target="_blank" rel="noopener noreferrer"')
}

marked.setOptions({
  renderer: renderer,
})

const renderedHtml = computed(() => {
  if (!props.content) return ''
  try {
    // 自动补全不完整的 <think> 标签（流式输出中可能出现半截标签）
    let content = props.content
    const openCount = (content.match(/<think>/g) ?? []).length
    const closeCount = (content.match(/<\/think>/g) ?? []).length
    if (openCount > closeCount) {
      content += '</think>'
    }

    // 将 <think>...</think> 块转换为样式化 HTML
    const parts: string[] = []
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = thinkRegex.exec(content)) !== null) {
      const before = content.slice(lastIndex, match.index)
      if (before) parts.push(marked(before) as string)
      const thinkContent = (match[1] ?? '').trim()
      const renderedThink = marked(thinkContent) as string
      parts.push(
        `<div class="think-block"><div class="think-header">${t('markdownViewer.thinkingProcess')}</div><div class="think-content">${renderedThink}</div></div>`
      )
      lastIndex = thinkRegex.lastIndex
    }
    const tail = content.slice(lastIndex)
    if (tail) parts.push(marked(tail) as string)
    return parts.join('')
  } catch (error) {
    console.error(t('markdownViewer.renderError'), error)
    return props.content
  }
})
</script>

<style scoped>
.markdown-viewer {
  line-height: 1.5;
  color: #374151;
  font-size: 0.875rem;
  padding: 0;
  margin: 0;
  max-width: 100%;
}

.markdown-viewer :deep(h1) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.markdown-viewer :deep(h2) {
  font-size: 1.125rem;
  font-weight: 700;
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
}

.markdown-viewer :deep(h3) {
  font-size: 1rem;
  font-weight: 700;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

.markdown-viewer :deep(p) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.markdown-viewer :deep(ul),
.markdown-viewer :deep(ol) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding-left: 1.5rem;
}

.markdown-viewer :deep(li) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.markdown-viewer :deep(code) {
  background-color: rgba(156, 163, 175, 0.15);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.markdown-viewer :deep(pre) {
  background-color: rgba(156, 163, 175, 0.1);
  padding: 0.75rem;
  border-radius: 0.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  overflow-x: auto;
  border: 1px solid var(--color-glass-border);
  backdrop-filter: blur(8px);
}

.markdown-viewer :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.markdown-viewer :deep(blockquote) {
  border-left: 4px solid var(--color-primary);
  background-color: rgba(156, 163, 175, 0.05);
  padding: 0.5rem 1rem;
  border-radius: 0 0.5rem 0.5rem 0;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  color: #6b7280;
}

.markdown-viewer :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 4px;
  transition: color 0.2s;
}

.markdown-viewer :deep(a:hover) {
  color: var(--color-primary-hover);
}

.markdown-viewer :deep(img) {
  max-width: 100%;
  height: auto;
}

.markdown-viewer :deep(strong) {
  font-weight: 700;
}

.markdown-viewer :deep(em) {
  font-style: italic;
}

.markdown-viewer :deep(table) {
  border-collapse: collapse;
  width: 100%;
  max-width: 100%;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  display: block;
  overflow-x: auto;
}

.markdown-viewer :deep(th),
.markdown-viewer :deep(td) {
  border: 1px solid #d1d5db;
  padding: 0.5rem;
  text-align: left;
}

.markdown-viewer :deep(th) {
  background-color: #f3f4f6;
  font-weight: 600;
}

/* xs size variant */
.markdown-viewer--xs {
  font-size: 0.75rem;
}

.markdown-viewer--xs :deep(h1) {
  font-size: 1rem;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

.markdown-viewer--xs :deep(h2) {
  font-size: 0.875rem;
  margin-top: 0.375rem;
  margin-bottom: 0.25rem;
}

.markdown-viewer--xs :deep(h3) {
  font-size: 0.8125rem;
  margin-top: 0.25rem;
  margin-bottom: 0.125rem;
}

.markdown-viewer--xs :deep(p) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.markdown-viewer--xs :deep(ul),
.markdown-viewer--xs :deep(ol) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
  padding-left: 1rem;
}

.markdown-viewer--xs :deep(li) {
  margin-top: 0.125rem;
  margin-bottom: 0.125rem;
}

.markdown-viewer--xs :deep(code) {
  font-size: 0.75rem;
}

.markdown-viewer--xs :deep(pre) {
  padding: 0.5rem;
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.markdown-viewer--xs :deep(blockquote) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.markdown-viewer :deep(.think-block) {
  background-color: rgba(156, 163, 175, 0.05);
  border-left: 3px solid var(--color-primary);
  border-radius: 0.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: #9ca3af;
  font-size: 0.8125rem;
  border: 1px solid var(--color-glass-border);
  backdrop-filter: blur(8px);
}

.markdown-viewer :deep(.think-header) {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 0.25rem;
  letter-spacing: 0.025em;
}

.markdown-viewer :deep(.think-content p) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}
</style>

<style>
/* 暗色模式覆盖（非 scoped，允许 .dark 父级匹配） */
.dark .markdown-viewer {
  color: #e5e7eb;
}

.dark .markdown-viewer th,
.dark .markdown-viewer td {
  border-color: #4b5563;
}

.dark .markdown-viewer th {
  background-color: #374151;
}

.dark .markdown-viewer blockquote {
  color: #9ca3af;
}
</style>
