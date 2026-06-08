<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, Film, Music } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps<{
  filePath: string
  previewUrl: string
}>()

const fileType = computed(() => {
  const ext = props.filePath.split('.').pop()?.toLowerCase() || ''
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return 'video'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext))
    return 'image'
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext)) return 'audio'
  return null
})

const visible = ref(false)
</script>

<template>
  <template v-if="fileType">
    <a-button
      class="inline-flex items-center"
      size="small"
      :title="t('filePreviewButton.previewPrefix') + filePath.split('/').pop()"
      @click="visible = true"
    >
      <Film v-if="fileType === 'video'" class="w-3 h-3" aria-hidden="true" />
      <Eye
        v-else-if="fileType === 'image'"
        class="w-3 h-3"
        aria-hidden="true"
      />
      <Music
        v-else-if="fileType === 'audio'"
        class="w-3 h-3"
        aria-hidden="true"
      />
    </a-button>

    <a-modal
      v-model:open="visible"
      :title="filePath.split('/').pop()"
      :footer="null"
      width="min(860px, 90vw)"
      :body-style="{ padding: '12px' }"
    >
      <div class="flex justify-center">
        <video
          v-if="fileType === 'video'"
          :src="previewUrl"
          controls
          class="max-h-[70vh] max-w-full"
        />
        <img
          v-else-if="fileType === 'image'"
          :src="previewUrl"
          class="max-h-[70vh] max-w-full object-contain"
        />
        <audio
          v-else-if="fileType === 'audio'"
          :src="previewUrl"
          controls
          class="w-full mt-4"
        />
      </div>
    </a-modal>
  </template>
</template>
