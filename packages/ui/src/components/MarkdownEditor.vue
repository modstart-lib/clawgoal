<template>
  <div class="markdown-editor-wrapper">
    <MdEditor
      v-model="content"
      :language="effectiveLanguage"
      :theme="effectiveTheme"
      :preview="preview"
      :toolbars-exclude="toolbarsExclude"
      :placeholder="effectivePlaceholder"
      @on-change="handleChange"
      @on-save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/theme.ts'
import { useLocale } from '@/composables/locale.ts'
import { MdEditor, config, type ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const localeStore = useLocale()
const { t } = useI18n()

interface Props {
  modelValue?: string
  language?: 'zh-CN' | 'en-US'
  theme?: 'light' | 'dark'
  preview?: boolean
  placeholder?: string
  toolbarsExclude?: ToolbarNames[]
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  language: undefined,
  theme: undefined,
  preview: true,
  placeholder: undefined,
  toolbarsExclude: () => [],
})

const { isDark } = useTheme()
const effectiveTheme = computed(
  () => props.theme ?? (isDark.value ? 'dark' : 'light')
)
const effectivePlaceholder = computed(
  () => props.placeholder ?? t('common.markdownPlaceholder')
)
const effectiveLanguage = computed(() => props.language ?? localeStore.locale)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
  save: [value: string]
}>()

onMounted(() => {
  config({
    markdownItConfig(md) {
      const defaultRender = md.renderer.rules.link_open
      md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        tokens[idx].attrSet('target', '_blank')
        tokens[idx].attrSet('rel', 'noopener noreferrer')
        return defaultRender
          ? defaultRender(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options)
      }
    },
  })
})

const content = computed({
  get: () => props.modelValue,
  set: (value: string) => {
    emit('update:modelValue', value)
  },
})

const handleChange = (value: string) => {
  emit('change', value)
}

const handleSave = (value: string) => {
  emit('save', value)
}
</script>

<style scoped>
.markdown-editor-wrapper {
  width: 100%;
}

/* 覆盖默认样式，适配项目主题 */
:deep(.md-editor) {
  --md-color: var(--color-primary);
  border-radius: 12px;
  border: 1px solid var(--color-glass-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  transition: border-color 0.3s ease;
}

:deep(.md-editor:focus-within) {
  border-color: var(--color-primary);
}

:deep(.md-editor-toolbar) {
  border-bottom: 1px solid var(--color-glass-border);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

:deep(.md-editor-toolbar-item) {
  color: inherit;
  transition:
    color 0.2s,
    background-color 0.2s;
}

:deep(.md-editor-toolbar-item:hover),
:deep(.md-editor-toolbar-item.active) {
  color: var(--color-primary);
}

:deep(.md-editor-preview .md-editor-a),
:deep(.md-editor-preview a) {
  color: var(--color-primary);
  text-decoration: none;
}

:deep(.md-editor-preview .md-editor-a:hover),
:deep(.md-editor-preview a:hover) {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.theme-dark :deep(.md-editor-toolbar),
.dark :deep(.md-editor-toolbar) {
  background: rgba(31, 41, 55, 0.5);
}
</style>
