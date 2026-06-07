<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelSelector from '@/components/ModelSelector.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import VariableTextareaInput from '../../components/VariableTextareaInput.vue'

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const { t } = useI18n()

const model = ref('')
const prompt = ref('')
const format = ref('text')

watch(
  () => props.properties,
  (p) => {
    model.value = p?.data?.model || ''
    format.value = p?.data?.format || 'text'
    const pf = p?.inputFields?.find((f: any) => f.name === 'Prompt')
    prompt.value = pf?.value || ''
  },
  { immediate: true }
)

function sync() {
  const inputFields = JSON.parse(
    JSON.stringify(
      props.properties?.inputFields || [
        { name: 'Prompt', type: 'textarea', value: '' },
      ]
    )
  )
  const pIdx = inputFields.findIndex((f: any) => f.name === 'Prompt')
  if (pIdx >= 0) inputFields[pIdx].value = prompt.value
  else
    inputFields.push({ name: 'Prompt', type: 'textarea', value: prompt.value })
  emit('update:properties', {
    data: { model: model.value, format: format.value },
    inputFields,
  })
}
</script>

<template>
  <div class="p-2 space-y-2">
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.llmModel') }}
      </div>
      <ModelSelector v-model:value="model" @update:value="sync" />
      <ModelViewer v-if="model" :value="model" class="mt-1.5 w-full" />
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.llmOutputFormat') }}
      </div>
      <a-select v-model:value="format" class="w-full" @change="sync">
        <a-select-option value="text">{{
          t('workflowEditor.llmOutputText')
        }}</a-select-option>
        <a-select-option value="json">JSON</a-select-option>
      </a-select>
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.llmPrompt') }}
      </div>
      <VariableTextareaInput
        v-model="prompt"
        :rows="4"
        :node-id="props.node?.id"
        :placeholder="t('workflowEditor.llmPromptPlaceholder')"
        @change="sync"
      />
    </div>
  </div>
</template>
