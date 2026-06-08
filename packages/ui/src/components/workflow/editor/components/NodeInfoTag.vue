<script setup lang="ts">
import { ref } from 'vue'
import { Info } from 'lucide-vue-next'

export interface NodeInfoDetail {
  label: string
  value: string
  mono?: boolean
}

const { summary, details = undefined } = defineProps<{
  summary: string
  details?: NodeInfoDetail[]
}>()

const open = ref(false)
</script>

<template>
  <div
    v-if="summary"
    class="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-50 border border-gray-100 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"
    @click.stop="details?.length ? (open = true) : undefined"
  >
    <span class="text-xs text-gray-500 truncate flex-1 min-w-0">{{
      summary
    }}</span>
    <Info
      v-if="details?.length"
      class="w-3 h-3 text-gray-400 shrink-0"
      aria-hidden="true"
    />
  </div>

  <a-modal
    v-if="details?.length"
    v-model:open="open"
    :footer="null"
    :width="'min(680px, 92vw)'"
    :title="summary"
    @click.stop
  >
    <div class="space-y-3 py-1">
      <div
        v-for="item in details"
        :key="item.label"
        class="flex flex-col gap-1"
      >
        <div class="text-xs font-medium text-gray-500">{{ item.label }}</div>
        <div
          :class="[
            'text-sm text-gray-800 whitespace-pre-wrap rounded px-2 py-1.5',
            item.mono
              ? 'bg-gray-50 border border-gray-100 font-mono text-xs leading-relaxed'
              : '',
          ]"
        >
          {{ item.value }}
        </div>
      </div>
    </div>
  </a-modal>
</template>
