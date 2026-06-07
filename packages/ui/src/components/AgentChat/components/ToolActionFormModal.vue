<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="visible"
    :title="action.title"
    :footer="null"
    width="min(600px, 90vw)"
    :get-container="getContainer"
    :mask-style="{ position: 'absolute' }"
    :wrap-style="{ position: 'absolute' }"
    @cancel="handleCancel"
  >
    <div class="py-2">
      <a-form :model="formData" layout="vertical" @finish="handleSubmit">
        <template v-for="field in action.config.fields" :key="field.name">
          <!-- Text field -->
          <a-form-item
            v-if="field.type === 'text'"
            :name="field.name"
            :label="field.title"
            :rules="
              field.required
                ? [{ required: true, message: `${field.title} is required` }]
                : []
            "
          >
            <a-input
              v-model:value="formData[field.name]"
              :placeholder="field.title"
            />
          </a-form-item>

          <!-- Radio field -->
          <a-form-item
            v-else-if="field.type === 'radio'"
            :name="field.name"
            :label="field.title"
            :rules="
              field.required
                ? [{ required: true, message: `${field.title} is required` }]
                : []
            "
          >
            <a-radio-group
              v-model:value="formData[field.name]"
              class="flex flex-wrap gap-2"
            >
              <a-radio
                v-for="opt in field.options"
                :key="opt"
                :value="opt"
                class="!mr-0"
              >
                {{ opt }}
              </a-radio>
            </a-radio-group>
          </a-form-item>

          <!-- Textarea field -->
          <a-form-item
            v-else-if="field.type === 'textarea'"
            :name="field.name"
            :label="field.title"
            :rules="
              field.required
                ? [{ required: true, message: `${field.title} is required` }]
                : []
            "
          >
            <a-textarea
              v-model:value="formData[field.name]"
              :placeholder="field.title"
              :auto-size="{
                minRows: (field as any).minRows ?? 3,
                maxRows: (field as any).maxRows ?? 8,
              }"
            />
          </a-form-item>
        </template>

        <div class="flex justify-end gap-2 mt-4">
          <a-button @click="handleCancel">{{ $t('common.cancel') }}</a-button>
          <a-button type="primary" html-type="submit">{{
            $t('common.confirm')
          }}</a-button>
        </div>
      </a-form>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  Modal as AModal,
  Radio as ARadio,
  RadioGroup as ARadioGroup,
  Textarea as ATextarea,
} from 'ant-design-vue'
import { reactive, watch } from 'vue'
import type { ToolAction, ToolActionField } from '../types'

interface Props {
  visible: boolean
  action: ToolAction
  getContainer?: () => HTMLElement
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'send', content: string): void
}>()

const formData = reactive<Record<string, string>>({})

/** Initialise formData with default values whenever action changes or modal opens */
const initFormData = () => {
  for (const field of props.action.config.fields) {
    formData[field.name] =
      (field as ToolActionField).defaultValue ??
      ((field as ToolActionField).type === 'radio' &&
      (field as any).options?.length
        ? (field as any).options[0]
        : '')
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) initFormData()
  }
)

watch(
  () => props.action,
  () => {
    if (props.visible) initFormData()
  },
  { deep: true }
)

const handleCancel = () => {
  emit('update:visible', false)
}

const handleSubmit = () => {
  let content = props.action.config.template
  for (const [key, value] of Object.entries(formData)) {
    content = content.split(`{{${key}}}`).join(value ?? '')
  }
  emit('send', content.trim())
  emit('update:visible', false)
}
</script>
