<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  text: string
  keyword?: string
}>()

interface TextPart {
  text: string
  highlight: boolean
}

const parts = computed((): TextPart[] => {
  const kw = props.keyword?.trim() ?? ''
  if (!kw || !props.text) return [{ text: props.text ?? '', highlight: false }]
  const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const result: TextPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(props.text)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        text: props.text.slice(lastIndex, match.index),
        highlight: false,
      })
    }
    result.push({ text: match[0], highlight: true })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < props.text.length) {
    result.push({ text: props.text.slice(lastIndex), highlight: false })
  }
  return result
})
</script>

<template>
  <span>
    <template v-for="(part, i) in parts" :key="i">
      <mark
        v-if="part.highlight"
        class="bg-red-100 text-red-600 not-italic px-0"
        >{{ part.text }}</mark
      >
      <span v-else>{{ part.text }}</span>
    </template>
  </span>
</template>
