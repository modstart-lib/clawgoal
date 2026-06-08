<template>
  <a-modal
    :keyboard="false"
    :mask-closable="true"
    :open="open"
    :title="note?.title"
    width="min(800px, 90vw)"
    :footer="null"
    @cancel="$emit('update:open', false)"
  >
    <div v-if="note" class="space-y-3">
      <!-- 类型标签 -->
      <div v-if="note.type" class="flex items-center gap-2">
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
        >
          {{ note.type }}
        </span>
        <span class="text-xs text-gray-400 dark:text-gray-500">
          <DatetimeViewer :value="note.createdAt" />
        </span>
      </div>
      <div v-else class="text-xs text-gray-400 dark:text-gray-500">
        <DatetimeViewer :value="note.createdAt" />
      </div>

      <!-- 内容 -->
      <div
        v-if="note.content"
        class="border-t border-gray-100 dark:border-gray-700 pt-3"
      >
        <MarkdownViewer :content="note.content" />
      </div>
      <div
        v-else
        class="text-sm text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-700 pt-3"
      >
        {{ $t('claw.project.noteNoContent') }}
      </div>

      <!-- Meta 信息 -->
      <div
        v-if="note.meta"
        class="border-t border-gray-100 dark:border-gray-700 pt-3"
      >
        <div class="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">
          {{ $t('claw.event.metaTitle') }}
        </div>
        <MetaViewer :meta="note.meta" />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { Note } from '@/claw/api/note'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MetaViewer from '@/components/MetaViewer.vue'

defineProps<{
  open: boolean
  note: Note | null
}>()

defineEmits<{
  (e: 'update:open', value: boolean): void
}>()
</script>
