<script lang="ts">
export interface ParamType {
  name: string
  type: 'text' | 'select'
  defaultValue: string
  options?: string[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'

const props = defineProps<{ modelValue: ParamType[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: ParamType[]] }>()

const list = computed(() => props.modelValue ?? [])

function update(index: number, changes: Partial<ParamType>) {
  const next = list.value.map((item, i) =>
    i === index ? { ...item, ...changes } : item
  )
  emit('update:modelValue', next)
}

function addRow() {
  emit('update:modelValue', [
    ...list.value,
    { name: '', type: 'text', defaultValue: '', options: [] },
  ])
}

function removeRow(index: number) {
  emit(
    'update:modelValue',
    list.value.filter((_, i) => i !== index)
  )
}

function updateOptions(index: number, raw: string) {
  const options = raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  update(index, { options })
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="list.length === 0" class="text-sm text-gray-400 py-2">
      {{ $t('paramBuilderInput.noParams') }}
    </div>
    <div
      v-for="(item, index) in list"
      :key="index"
      class="flex flex-col gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-primary-50/30 dark:bg-primary-900/10 backdrop-blur-sm transition-colors hover:border-primary-200/60 dark:hover:border-primary-800/40 hover:bg-primary-50/50 dark:hover:bg-primary-900/20"
    >
      <div class="flex items-center gap-2">
        <a-input
          :value="item.name"
          :placeholder="$t('paramBuilderInput.paramNamePlaceholder')"
          class="flex-1 font-mono"
          @change="update(index, { name: $event.target?.value ?? '' })"
        />
        <a-select
          :value="item.type"
          class="w-24"
          @change="(v: any) => update(index, { type: v })"
        >
          <a-select-option value="text">{{
            $t('paramBuilderInput.typeText')
          }}</a-select-option>
          <a-select-option value="select">{{
            $t('paramBuilderInput.typeSelect')
          }}</a-select-option>
        </a-select>
        <a-button
          class="inline-flex items-center"
          danger
          @click="removeRow(index)"
        >
          <Trash2 class="w-4 h-4" aria-hidden="true" />
        </a-button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500 w-16 shrink-0">{{
          $t('paramBuilderInput.defaultValue')
        }}</span>
        <a-input
          :value="item.defaultValue"
          :placeholder="$t('paramBuilderInput.defaultValuePlaceholder')"
          class="flex-1"
          @change="update(index, { defaultValue: $event.target?.value ?? '' })"
        />
      </div>
      <div v-if="item.type === 'select'" class="flex items-start gap-2">
        <span class="text-xs text-gray-500 w-16 shrink-0 pt-1">{{
          $t('paramBuilderInput.optionsLabel')
        }}</span>
        <a-textarea
          :value="(item.options || []).join('\n')"
          :rows="3"
          :placeholder="$t('paramBuilderInput.optionsPlaceholder')"
          class="flex-1 font-mono"
          @change="updateOptions(index, $event.target?.value ?? '')"
        />
      </div>
    </div>
    <a-button @click="addRow">
      <div class="inline-flex items-center gap-1">
        <Plus class="w-4 h-4" aria-hidden="true" />
        {{ $t('paramBuilderInput.addParam') }}
      </div>
    </a-button>
  </div>
</template>
