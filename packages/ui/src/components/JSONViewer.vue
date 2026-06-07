<script setup lang="ts">
import { useTheme } from '@/composables/theme.ts'
import { computed } from 'vue'
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/vue3-json-viewer.css'

const props = withDefaults(
  defineProps<{
    value: string | object | null | undefined
    maxHeight?: string
    size?: 'default' | 'small'
  }>(),
  {
    maxHeight: '80vh',
    size: 'default',
  }
)

const { isDark } = useTheme()
const isEmpty = computed(
  () =>
    props.value === null ||
    props.value === undefined ||
    (typeof props.value === 'string' && !props.value.trim())
)

const parsed = computed(() => {
  if (isEmpty.value) return null
  if (typeof props.value === 'string') {
    try {
      return JSON.parse(props.value)
    } catch {
      return props.value
    }
  }
  return props.value
})
</script>

<template>
  <div
    class="json-viewer-wrap"
    :class="{ 'json-viewer-small': size === 'small', 'is-dark': isDark }"
    :style="{ maxHeight, overflowY: 'auto' }"
  >
    <span v-if="isEmpty" class="text-gray-400 italic text-xs">-</span>
    <JsonViewer
      v-else
      :value="parsed"
      :theme="isDark ? 'dark' : 'light'"
      :expand-depth="2"
      boxed
    />
  </div>
</template>

<style scoped>
.json-viewer-wrap {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}
.json-viewer-wrap.is-dark {
  border-color: #374151;
}

.json-viewer-wrap :deep(.jv-container.jv-light) {
  background: transparent;
  border: none;
  box-shadow: none;
}
.json-viewer-wrap :deep(.jv-container.jv-dark) {
  background: transparent;
  border: none;
  box-shadow: none;
}
.json-viewer-wrap :deep(.jv-container .jv-code) {
  padding: 6px 8px;
}
.json-viewer-wrap.json-viewer-small :deep(.jv-container) {
  font-size: 10px;
}
.json-viewer-wrap.json-viewer-small :deep(.jv-container .jv-code) {
  padding: 4px 6px;
}
</style>
