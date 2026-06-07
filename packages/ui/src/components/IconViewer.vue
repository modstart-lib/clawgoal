<template>
  <component
    :is="iconComponent"
    v-if="iconComponent"
    class="text-primary transition-colors duration-200"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getIconComponent } from './icons/icons'

const props = defineProps<{
  name?: string | null
}>()

const iconComponent = computed(() => {
  if (!props.name) return null
  return getIconComponent(props.name)
})
</script>
