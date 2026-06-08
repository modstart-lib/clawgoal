<script setup lang="ts">
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Pencil from '~icons/lucide/pencil'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  {
    placeholder: '',
  }
)

const { t } = useI18n()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const modalOpen = ref(false)
const draft = ref('')

function openEdit() {
  draft.value = props.modelValue
  modalOpen.value = true
}

function handleOk() {
  emit('update:modelValue', draft.value)
  modalOpen.value = false
}

function handleCancel() {
  modalOpen.value = false
}

watch(
  () => props.modelValue,
  (val) => {
    if (!modalOpen.value) draft.value = val
  }
)
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
      {{
        modelValue
          ? modelValue.slice(0, 60) +
            (modelValue.length > 60 ? '\u2026\u2026' : '')
          : placeholder || t('markdownField.placeholder')
      }}
    </span>
    <a-button type="primary" class="shadow-sm" size="small" @click="openEdit">
      <div class="inline-flex items-center gap-1">
        <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
        {{ t('markdownField.edit') }}
      </div>
    </a-button>
  </div>

  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="modalOpen"
    :title="t('markdownField.editTitle')"
    width="95vw"
    :footer="null"
    @cancel="handleCancel"
  >
    <MarkdownEditor v-model="draft" :preview="false" class="min-h-[400px]" />
    <div class="flex justify-end gap-2 mt-3">
      <a-button @click="handleCancel">{{ t('common.cancel') }}</a-button>
      <a-button type="primary" @click="handleOk">{{
        t('common.save')
      }}</a-button>
    </div>
  </a-modal>
</template>
