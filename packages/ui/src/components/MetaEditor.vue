<template>
  <div>
    <!-- Display mode: key-value pairs or placeholder (click to edit) -->
    <div class="cursor-pointer" @click="open = true">
      <div v-if="entries.length > 0" class="space-y-1.5">
        <div
          v-for="entry in entries"
          :key="entry.key"
          class="flex items-start gap-2 text-sm"
        >
          <span
            class="font-medium text-gray-500 dark:text-gray-400 shrink-0 min-w-[80px] pt-px"
            >{{ entry.key }}</span
          >
          <span class="text-gray-700 dark:text-gray-300 break-all">{{
            entry.value
          }}</span>
        </div>
      </div>
      <!-- Placeholder for empty -->
      <div
        v-else
        class="text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        {{ placeholder || '{}' }}
      </div>
    </div>

    <!-- Edit modal -->
    <a-modal
      :open="open"
      width="min(640px, 90vw)"
      :keyboard="false"
      :mask-closable="false"
      :title="$t('common.edit')"
      :confirm-loading="false"
      @ok="confirmEdit"
      @cancel="cancelEdit"
      @update:open="open = $event"
    >
      <div class="py-2">
        <CodeEditor
          v-model="editText"
          language="json"
          height="320px"
          placeholder="{}"
        />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import CodeEditor from './CodeEditor.vue'

const props = defineProps<{
  modelValue?: Record<string, unknown> | null
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown> | null]
}>()

const open = ref(false)
const editText = ref('')

const entries = computed<Array<{ key: string; value: unknown }>>(() => {
  if (!props.modelValue) return []
  return Object.entries(props.modelValue).map(([key, value]) => ({
    key,
    value,
  }))
})

function confirmEdit() {
  const trimmed = editText.value.trim()
  if (!trimmed) {
    emit('update:modelValue', null)
    open.value = false
    return
  }
  try {
    const obj = JSON.parse(trimmed)
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return
    }
    emit('update:modelValue', obj as Record<string, unknown>)
    open.value = false
  } catch {
    // invalid JSON, prevent modal from closing (keep open for editing)
  }
}

function cancelEdit() {
  open.value = false
}
</script>
