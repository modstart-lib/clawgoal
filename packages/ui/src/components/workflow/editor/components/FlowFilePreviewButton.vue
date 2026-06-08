<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/auth'
import { getApiBase } from '@/api/base'
import FilePreviewButton from '@/components/FilePreviewButton.vue'

const props = defineProps<{ filePath: string }>()

const auth = useAuth()

const previewUrl = computed(
  () =>
    `${getApiBase()}/flow/localFile?token=${encodeURIComponent(auth.token || '')}&path=${encodeURIComponent(props.filePath)}`
)
</script>

<template>
  <FilePreviewButton :file-path="filePath" :preview-url="previewUrl" />
</template>
