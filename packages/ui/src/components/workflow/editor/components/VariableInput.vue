<script setup lang="ts">
import { computed } from 'vue'
import { Code } from 'lucide-vue-next'
import { listAllVariables, type VariableItem } from '../core/variable'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  nodeId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const variables = computed(() => listAllVariables(props.nodeId || ''))

function onInput(e: any) {
  const val = e.target.value
  emit('update:modelValue', val)
  emit('change', val)
}

function insertVariable(v: VariableItem) {
  const token = '${' + (v.node ? v.node + '.' : '') + v.name + '}'
  emit('update:modelValue', token)
  emit('change', token)
}
</script>

<template>
  <div class="flex items-center gap-1">
    <a-input
      :value="modelValue"
      :placeholder="placeholder || $t('workflowEditor.inputTextPlaceholder')"
      class="flex-1"
      @input="onInput"
    />
    <a-dropdown v-if="variables.length" :trigger="['click']">
      <a-button class="inline-flex items-center shrink-0">
        <Code class="w-4 h-4" aria-hidden="true" />
      </a-button>
      <template #overlay>
        <div
          class="bg-white border border-gray-200 rounded shadow-lg p-1 max-h-64 overflow-y-auto min-w-40"
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
</template>
