<script setup lang="ts">
import CodeEditor from '@/components/CodeEditor.vue'
import { computed } from 'vue'

const props = defineProps<{
  open: boolean
  filePath: string
  content: string
  saving: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:content': [value: string]
  save: []
}>()

type Language =
  | 'javascript'
  | 'typescript'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'text'

const editorLanguage = computed<Language>(() => {
  const name = props.filePath.toLowerCase()
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'yaml'
  if (name.endsWith('.json')) return 'json'
  if (name.endsWith('.md')) return 'markdown'
  if (name.endsWith('.ts')) return 'typescript'
  if (name.endsWith('.js')) return 'javascript'
  return 'text'
})
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('settingFile.editFile')"
    width="95vw"
    :confirm-loading="saving"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
    @ok="emit('save')"
    @update:open="emit('update:open', $event)"
  >
    <div class="mb-2 text-xs text-gray-500 font-mono">{{ filePath }}</div>
    <CodeEditor
      :model-value="content"
      :language="editorLanguage"
      height="480px"
      @update:model-value="emit('update:content', $event)"
    />
  </a-modal>
</template>
