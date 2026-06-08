<template>
  <div
    class="handup-bubble handup-bubble--clickable"
    :style="{ left: bubble.x + 'px', top: bubble.y + 'px' }"
    @click="emit('open-chat', bubble.idx)"
  >
    {{ bubble.text }}
  </div>
</template>

<script setup lang="ts">
import type { HandupBubble } from '../office'

defineProps<{ bubble: HandupBubble }>()
const emit = defineEmits<{ 'open-chat': [idx: number] }>()
</script>
