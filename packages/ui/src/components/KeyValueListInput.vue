<script setup lang="ts">
import { computed } from 'vue'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'

export interface KeyValueItem {
  key: string
  value: string
}

const props = defineProps<{
  modelValue: KeyValueItem[]
  keyPlaceholder?: string
  valuePlaceholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: KeyValueItem[]]
}>()

const list = computed<KeyValueItem[]>(() => props.modelValue ?? [])

function updateKey(index: number, key: string) {
  const next = list.value.map((item, i) =>
    i === index ? { ...item, key } : item
  )
  emit('update:modelValue', next)
}

function updateValue(index: number, value: string) {
  const next = list.value.map((item, i) =>
    i === index ? { ...item, value } : item
  )
  emit('update:modelValue', next)
}

function addRow() {
  emit('update:modelValue', [...list.value, { key: '', value: '' }])
}

function removeRow(index: number) {
  emit(
    'update:modelValue',
    list.value.filter((_, i) => i !== index)
  )
}
</script>

<template>
  <div
    class="space-y-2 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm content-transition"
  >
    <div
      v-for="(item, index) in list"
      :key="index"
      class="flex items-center gap-2"
    >
      <a-input
        :value="item.key"
        :placeholder="keyPlaceholder ?? 'KEY'"
        class="w-36 shrink-0 font-mono bg-white/80 dark:bg-gray-900/50 border-dashed focus:border-solid hover:border-primary-400 transition-colors"
        @change="updateKey(index, $event.target?.value ?? '')"
      />
      <a-input
        :value="item.value"
        :placeholder="valuePlaceholder ?? 'VALUE'"
        class="flex-1 font-mono bg-white/80 dark:bg-gray-900/50 border-dashed focus:border-solid hover:border-primary-400 transition-colors"
        @change="updateValue(index, $event.target?.value ?? '')"
      />
      <a-button
        class="inline-flex items-center border-red-200 hover:border-red-400 hover:bg-red-50 text-red-500 transition-colors rounded-lg bg-transparent border shadow-none"
        @click="removeRow(index)"
      >
        <Trash2 class="w-4 h-4" aria-hidden="true" />
      </a-button>
    </div>
    <a-button type="dashed" class="w-full" @click="addRow">
      <div class="inline-flex items-center gap-1">
        <Plus class="w-4 h-4" aria-hidden="true" />
        {{ $t('keyValueListInput.add') }}
      </div>
    </a-button>
  </div>
</template>
