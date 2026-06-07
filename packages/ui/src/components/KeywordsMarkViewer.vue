<template>
  <span v-if="!keywords" v-bind="$attrs">{{ text }}</span>
  <span v-else v-bind="$attrs">
    <template v-for="(part, index) in parts" :key="index">
      <mark v-if="part.highlight" class="bg-red-50 text-red-600">{{
        part.text
      }}</mark>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * KeywordsMarkViewer — inline text component with keyword highlight support.
 *
 * @prop {string} text     - The full text to display.
 * @prop {string} keywords - Space/comma-separated keywords to highlight (case-insensitive).
 */
const props = defineProps<{
  text?: string | null
  keywords?: string | null
}>()

interface Part {
  text: string
  highlight: boolean
}

const parts = computed<Part[]>(() => {
  const raw = props.text ?? ''
  const kw = props.keywords?.trim()
  if (!kw || !raw) return [{ text: raw, highlight: false }]

  // Split keywords by whitespace or comma, filter empty strings
  const tokens = kw
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean)

  if (tokens.length === 0) return [{ text: raw, highlight: false }]

  // Build a single regex that matches any keyword (case-insensitive)
  const escaped = tokens.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')

  const result: Part[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        text: raw.slice(lastIndex, match.index),
        highlight: false,
      })
    }
    result.push({ text: match[0], highlight: true })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < raw.length) {
    result.push({ text: raw.slice(lastIndex), highlight: false })
  }

  return result
})
</script>
