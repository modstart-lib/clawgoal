<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Code } from 'lucide-vue-next'
import { listAllVariables, type VariableItem } from '../core/variable'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  nodeId?: string
  rows?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const { t } = useI18n()

const variables = computed(() => listAllVariables(props.nodeId || ''))

function onInput(e: any) {
  const val = e.target.value
  emit('update:modelValue', val)
  emit('change', val)
}

function insertVariable(v: VariableItem) {
  const token = '${' + (v.node ? v.node + '.' : '') + v.name + '}'
  const current = props.modelValue || ''
  emit('update:modelValue', current + token)
  emit('change', current + token)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <a-textarea
      :value="modelValue"
      :placeholder="placeholder || t('workflowEditor.inputTextPlaceholder')"
      :rows="rows ?? 3"
      :auto-size="{ minRows: rows ?? 3, maxRows: 8 }"
      @input="onInput"
    />
    <div v-if="variables.length" class="flex justify-end">
      <a-dropdown :trigger="['click']">
        <a-button class="inline-flex items-center">
          <div class="inline-flex items-center gap-1">
            <Code class="w-4 h-4" aria-hidden="true" />{{
              t('workflowEditor.variable')
            }}
          </div>
        </a-button>
        <template #overlay>
          <div
            class="bg-white border border-gray-200 rounded shadow-lg p-1 max-h-64 overflow-y-auto min-w-48"
          >
            <div
              v-for="v in variables"
              :key="(v.node ? v.node + '.' : '') + v.name"
              class="px-2 py-1 text-xs hover:bg-gray-100 rounded cursor-pointer truncate"
              @click="insertVariable(v)"
            >
              {{ '${' + (v.node ? v.node + '.' : '') + v.name + '}' }}
            </div>
          </div>
        </template>
      </a-dropdown>
    </div>
  </div>
</template>
