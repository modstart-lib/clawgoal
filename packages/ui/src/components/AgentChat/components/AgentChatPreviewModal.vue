<template>
  <PreviewModal v-model:visible="isVisible" :preview="preview" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PreviewModal from './PreviewModal.vue'
import type { FilePreview } from '../types'

const props = defineProps<{
  visible: boolean
  preview: FilePreview | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})
</script>
