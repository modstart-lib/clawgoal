<script setup lang="ts">
import { ZoomIn, ZoomOut, Maximize2, Plus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{ zoomLevel: number; viewOnly?: boolean }>()
const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  'reset-zoom': []
  'fit-view': []
  'add-node': []
}>()
</script>

<template>
  <div
    class="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg z-[1000] p-2 flex items-center gap-2"
  >
    <template v-if="!viewOnly">
      <a-button
        size="small"
        class="inline-flex items-center gap-1"
        @click="emit('add-node')"
      >
        <Plus class="w-4 h-4" aria-hidden="true" />{{
          t('workflowEditor.addNode')
        }}
      </a-button>
      <div class="w-px h-5 bg-gray-200" />
    </template>
    <a-button
      size="small"
      class="inline-flex items-center"
      @click="emit('zoom-out')"
    >
      <ZoomOut class="w-4 h-4" aria-hidden="true" />
    </a-button>
    <div
      class="px-2 text-xs text-gray-600 cursor-pointer select-none"
      @click="emit('reset-zoom')"
    >
      {{ Math.round(zoomLevel * 100) }}%
    </div>
    <a-button
      size="small"
      class="inline-flex items-center"
      @click="emit('zoom-in')"
    >
      <ZoomIn class="w-4 h-4" aria-hidden="true" />
    </a-button>
    <a-button
      size="small"
      class="inline-flex items-center ml-1"
      @click="emit('fit-view')"
    >
      <Maximize2 class="w-4 h-4" aria-hidden="true" />
    </a-button>
  </div>
</template>
