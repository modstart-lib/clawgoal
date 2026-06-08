<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import type { OpsWorkflowCondition } from '../../../ui-ops/src/types'

const props = defineProps<{ modelValue: OpsWorkflowCondition[] }>()
const emit = defineEmits<{ 'update:modelValue': [OpsWorkflowCondition[]] }>()

const { t } = useI18n()

const list = computed(() => props.modelValue ?? [])

const operatorOptions = computed(() => [
  { value: 'eq', label: t('stepsBuilder.opEq') },
  { value: 'notEq', label: t('stepsBuilder.opNotEq') },
  { value: 'gt', label: t('stepsBuilder.opGt') },
  { value: 'lt', label: t('stepsBuilder.opLt') },
])

function add() {
  emit('update:modelValue', [
    ...list.value,
    { var1: '', var2: '', operator: 'eq' as const },
  ])
}

function remove(index: number) {
  emit(
    'update:modelValue',
    list.value.filter((_, i) => i !== index)
  )
}

function update(index: number, changes: Partial<OpsWorkflowCondition>) {
  emit(
    'update:modelValue',
    list.value.map((c, i) => (i === index ? { ...c, ...changes } : c))
  )
}
</script>

<template>
  <div>
    <div v-if="list.length > 0" class="space-y-2 mb-3">
      <div
        v-for="(cond, ci) in list"
        :key="ci"
        class="flex items-center gap-2 p-2 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800/80 transition-colors focus-within:ring-2 focus-within:ring-primary-500/20"
      >
        <a-input
          :value="cond.var1"
          placeholder="${VAR1}"
          class="flex-1 font-mono bg-transparent! border-dashed focus:border-solid hover:border-primary-400 transition-colors"
          @change="update(ci, { var1: $event.target?.value ?? '' })"
        />
        <a-select
          :value="cond.operator"
          class="w-24 shrink-0"
          @change="(v: any) => update(ci, { operator: v })"
        >
          <a-select-option
            v-for="op in operatorOptions"
            :key="op.value"
            :value="op.value"
          >
            {{ op.label }}
          </a-select-option>
        </a-select>
        <a-input
          :value="cond.var2"
          placeholder="${VAR2}"
          class="flex-1 font-mono bg-transparent! border-dashed focus:border-solid hover:border-primary-400 transition-colors"
          @change="update(ci, { var2: $event.target?.value ?? '' })"
        />
        <a-button
          class="inline-flex items-center shrink-0 mx-1 border-red-200 hover:border-red-400 hover:bg-red-50 text-red-500 transition-colors rounded-lg"
          @click="remove(ci)"
        >
          <Trash2 class="w-4 h-4" aria-hidden="true" />
        </a-button>
      </div>
    </div>
    <a-button @click="add">
      <div class="inline-flex items-center gap-1">
        <Plus class="w-4 h-4" aria-hidden="true" />
        {{ $t('stepsBuilder.addCondition') }}
      </div>
    </a-button>
  </div>
</template>
