<script setup lang="ts">
import { IDomEditor, IEditorConfig } from '@wangeditor/editor'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { uploadImage } from '../api/upload'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  height?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

const editorRef = shallowRef<IDomEditor>()
const valueHtml = ref(props.modelValue ?? '')

let skipEmit = false

watch(
  () => props.modelValue,
  (val) => {
    if (editorRef.value && val !== editorRef.value.getHtml()) {
      skipEmit = true
      editorRef.value.setHtml(val ?? '')
      skipEmit = false
    }
  }
)

const editorConfig: Partial<IEditorConfig> = {
  placeholder: props.placeholder ?? t('common.markdownPlaceholder'),
  onChange(editor: IDomEditor) {
    if (!skipEmit) emit('update:modelValue', editor.getHtml())
  },
  MENU_CONF: {
    uploadImage: {
      async customUpload(
        file: File,
        insertFn: (url: string, alt: string, href: string) => void
      ) {
        const res = await uploadImage(file)
        insertFn(res.url, res.originalName, res.url)
      },
    },
  },
}

function handleCreated(editor: IDomEditor) {
  editorRef.value = editor
}

onBeforeUnmount(() => {
  editorRef.value?.destroy()
})
</script>

<template>
  <div
    class="border border-gray-200/50 dark:border-gray-700/50 rounded-xl bg-white/50 dark:bg-gray-900/50 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-primary/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 focus-within:shadow-md"
  >
    <Toolbar
      :editor="editorRef"
      :default-config="{}"
      mode="default"
      class="border-b border-gray-100/80 dark:border-gray-700/50 backdrop-blur-md"
    />
    <Editor
      v-model="valueHtml"
      :default-config="editorConfig"
      mode="default"
      :style="{ height: (height ?? 300) + 'px', overflowY: 'hidden' }"
      @on-created="handleCreated"
    />
  </div>
</template>

<style scoped>
:deep(.w-e-toolbar) {
  background: transparent;
}
:deep(.w-e-text-container) {
  background: transparent;
}
</style>
