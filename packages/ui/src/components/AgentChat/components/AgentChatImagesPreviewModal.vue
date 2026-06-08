<template>
  <a-modal
    v-model:open="isOpen"
    :keyboard="false"
    :mask-closable="false"
    :footer="null"
    width="95vw"
    centered
    wrap-class-name="backdrop-blur-sm"
  >
    <div class="p-1">
      <img
        v-if="image"
        :src="image.url"
        :alt="image.name"
        class="w-full h-auto rounded-lg shadow-lg"
      />
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  visible: boolean
  image: { url: string; name: string } | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const isOpen = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})
</script>
