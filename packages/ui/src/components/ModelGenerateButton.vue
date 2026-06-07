<script setup lang="ts">
import { chatWithModel } from '@/api/model'
import { message } from 'ant-design-vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelSelector from '@/components/ModelSelector.vue'
import Sparkles from '~icons/lucide/sparkles'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    text?: string
    systemPrompt?: string
    title?: string
    placeholder?: string
    beforeGenerate?: () =>
      | boolean
      | string
      | void
      | Promise<boolean | string | void>
  }>(),
  {
    text: undefined,
    systemPrompt: undefined,
    title: undefined,
    placeholder: undefined,
    beforeGenerate: undefined,
  }
)

const resolvedText = computed(
  () => props.text ?? t('modelGenerate.generateBtn')
)
const resolvedPlaceholder = computed(
  () => props.placeholder ?? t('modelGenerate.promptPlaceholder')
)

const emit = defineEmits<{
  generate: [content: string]
}>()

const open = ref(false)
const prompt = ref('')
const generating = ref(false)
const selectedModel = ref<string | undefined>(undefined)

function handleOpenChange(val: boolean) {
  if (val) {
    prompt.value = ''
  }
  if (!generating.value) {
    open.value = val
  }
}

async function canGenerate() {
  if (!props.beforeGenerate) {
    return true
  }
  try {
    const result = await props.beforeGenerate()
    if (result === false) {
      return false
    }
    if (typeof result === 'string') {
      message.error(result)
      return false
    }
    return true
  } catch (error: any) {
    message.error(error?.message || t('modelGenerate.generateBeforeFailed'))
    return false
  }
}

function handleTextareaKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    handleGenerate()
  }
}

async function handleGenerate() {
  if (!prompt.value.trim()) {
    return
  }
  if (!(await canGenerate())) {
    return
  }
  generating.value = true
  try {
    const messages = []
    if (props.systemPrompt) {
      messages.push({ role: 'system' as const, content: props.systemPrompt })
    }
    messages.push({ role: 'user' as const, content: prompt.value.trim() })
    const res = await chatWithModel({
      messages,
      model: selectedModel.value,
    })
    emit('generate', res.message.content)
    open.value = false
  } catch (err: any) {
    message.error(err?.message || t('modelGenerate.generateFailed'))
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <a-popover
    v-model:open="open"
    trigger="click"
    placement="bottomLeft"
    :arrow="false"
    @open-change="handleOpenChange"
  >
    <a-button
      class="!text-primary-600 !border-primary-200 hover:!bg-primary-50"
    >
      <div class="inline-flex items-center gap-1">
        <Sparkles class="w-4 h-4" aria-hidden="true" />
        {{ resolvedText }}
      </div>
    </a-button>

    <template #content>
      <div class="flex flex-col gap-2 w-72">
        <div v-if="title" class="text-sm font-medium text-gray-700">
          {{ title }}
        </div>
        <div v-else class="text-sm text-gray-500">
          {{ $t('modelGenerate.promptLabel') }}
        </div>
        <slot name="beforePrompt" :prompt="prompt" :generating="generating" />
        <a-textarea
          v-model:value="prompt"
          :placeholder="resolvedPlaceholder"
          :auto-size="{ minRows: 4, maxRows: 10 }"
          :disabled="generating"
          class="font-mono text-sm"
          @keydown="handleTextareaKeydown"
        />
        <ModelSelector
          :value="selectedModel"
          :disabled="generating"
          @update:value="selectedModel = $event"
        />
        <div class="text-xs text-gray-400">{{ $t('modelGenerate.hint') }}</div>
        <div class="flex justify-end gap-2">
          <a-button @click="open = false">{{ $t('common.cancel') }}</a-button>
          <a-button
            type="primary"
            :loading="generating"
            @click="handleGenerate"
          >
            {{ $t('common.generate') }}
          </a-button>
        </div>
      </div>
    </template>
  </a-popover>
</template>
