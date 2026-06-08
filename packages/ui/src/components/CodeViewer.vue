<template>
  <div
    class="code-viewer"
    :class="effectiveTheme === 'light' ? 'theme-light' : 'theme-dark'"
  >
    <div class="code-header">
      <span class="code-lang">{{ lang || 'js' }}</span>
      <button class="copy-btn" :class="{ copied }" @click="copyCode">
        <Check v-if="copied" class="w-3.5 h-3.5" />
        <Copy v-else class="w-3.5 h-3.5" />
        <span>{{ copied ? $t('common.copied') : $t('common.copy') }}</span>
      </button>
    </div>
    <div ref="editorContainer" class="code-body" />
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/theme.ts'
import { copyText, safeJsonParse } from '@/utils/utils'
import { javascript } from '@codemirror/lang-javascript'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Check from '~icons/lucide/check'
import Copy from '~icons/lucide/copy'
/**
 * CodeViewer read-only code display component (with syntax highlighting)
 *
 * @prop {string} content - Code content
 * @prop {string} lang    - Language identifier (display label only, defaults to js)
 * @prop {boolean} json   - When true, auto-format content as pretty-printed JSON
 */
const props = defineProps({
  content: {
    type: String,
    default: '',
  },
  lang: {
    type: String,
    default: 'js',
  },
  json: {
    type: Boolean,
    default: false,
  },
})

const { isDark } = useTheme()
const effectiveTheme = computed(() => (isDark.value ? 'dark' : 'light'))

const editorContainer = ref<HTMLDivElement>()
let view: EditorView | null = null
const themeCompartment = new Compartment()

// 当 json=true 时自动格式化
const displayContent = computed(() => {
  if (!props.json) return props.content ?? ''
  try {
    const parsed = safeJsonParse(props.content ?? '', null)
    return parsed !== null
      ? JSON.stringify(parsed, null, 2)
      : (props.content ?? '')
  } catch {
    return props.content ?? ''
  }
})

const getThemeExtension = () => (effectiveTheme.value === 'dark' ? oneDark : [])

onMounted(() => {
  const state = EditorState.create({
    doc: displayContent.value,
    extensions: [
      basicSetup,
      javascript(),
      themeCompartment.of(getThemeExtension()),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      EditorView.theme({
        '&': { maxHeight: '400px' },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: '"Fira Code", "JetBrains Mono", ui-monospace, monospace',
          fontSize: '13px',
        },
        '.cm-gutters': { userSelect: 'none' },
      }),
    ],
  })

  view = new EditorView({
    state,
    parent: editorContainer.value!,
  })
})

watch(effectiveTheme, () => {
  if (!view) return
  view.dispatch({
    effects: themeCompartment.reconfigure(getThemeExtension()),
  })
})

watch(
  () => displayContent.value,
  (val) => {
    if (!view) return
    const current = view.state.doc.toString()
    if (val !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: val },
      })
    }
  }
)

onBeforeUnmount(() => {
  view?.destroy()
})

const copied = ref(false)

const copyCode = async () => {
  try {
    await copyText(displayContent.value, false)
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
</script>

<style scoped>
.code-viewer {
  border-radius: 12px;
  overflow: hidden;
  font-size: 0.8125rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--color-glass-border);
}

/* ── Dark theme ── */
.theme-dark .code-header {
  background-color: rgba(31, 41, 55, 0.5);
  backdrop-filter: blur(8px);
  color: #9ca3af;
  border-bottom: 1px solid var(--color-glass-border);
}

.theme-dark .copy-btn {
  border-color: #374151;
  color: #9ca3af;
}

.theme-dark .copy-btn:hover {
  border-color: var(--token-primary);
  color: var(--token-primary);
  background-color: rgba(55, 65, 81, 0.4);
}

.theme-dark .code-body :deep(.cm-editor) {
  background-color: rgba(17, 24, 39, 0.4);
}

/* ── Light theme ── */
.theme-light .code-header {
  background-color: rgba(243, 244, 246, 0.6);
  backdrop-filter: blur(8px);
  color: #374151;
  border-bottom: 1px solid var(--color-glass-border);
}

.theme-light .copy-btn {
  border-color: #d1d5db;
  color: #6b7280;
}

.theme-light .copy-btn:hover {
  border-color: var(--token-primary);
  color: var(--token-primary);
  background-color: rgba(229, 231, 235, 0.4);
}

.theme-light .code-body :deep(.cm-editor) {
  background-color: rgba(255, 255, 255, 0.6);
}

/* ── Shared ── */
.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.75rem;
  border-radius: 12px 12px 0 0;
}

.code-lang {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  text-transform: lowercase;
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
  border: 1px solid transparent;
}

.copy-btn.copied {
  border-color: var(--token-primary) !important;
  color: var(--token-primary) !important;
}

.code-body :deep(.cm-editor.cm-focused) {
  outline: none;
  border-radius: 0 0 12px 12px;
}
</style>
