<template>
  <a-modal
    :keyboard="false"
    :mask-closable="true"
    :open="open"
    :title="item?.title"
    width="min(600px, 90vw)"
    :footer="null"
    @cancel="$emit('update:open', false)"
  >
    <div v-if="item" class="space-y-3 py-1">
      <!-- 类型 -->
      <div v-if="item.type" class="flex items-center gap-2">
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
          >{{ item.type }}</span
        >
      </div>

      <!-- 描述 -->
      <div
        v-if="item.description"
        class="border-t border-gray-100 dark:border-gray-700 pt-3"
      >
        <MarkdownViewer :content="item.description" />
      </div>

      <!-- 事件日期 -->
      <div
        v-if="item.day"
        class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
      >
        <span
          class="font-medium text-gray-500 dark:text-gray-400 w-14 shrink-0"
          >{{ $t('claw.event.dateLabel') }}</span
        >
        <span>{{ item.day }}</span>
      </div>

      <!-- Meta 信息 -->
      <div
        v-if="item.meta"
        class="border-t border-gray-100 dark:border-gray-700 pt-3"
      >
        <div class="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">
          {{ $t('claw.event.metaTitle') }}
        </div>
        <MetaViewer :meta="item.meta" />
      </div>

      <!-- 时间信息 -->
      <div
        class="border-t border-gray-100 dark:border-gray-700 pt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400 dark:text-gray-500"
      >
        <span
          >{{ $t('claw.event.createLabel')
          }}<DatetimeViewer :value="item.createdAt"
        /></span>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { ProjectEvent } from '@/claw/api/project'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MetaViewer from '@/components/MetaViewer.vue'

defineProps<{
  open: boolean
  item: ProjectEvent | null
}>()

defineEmits<{
  (e: 'update:open', value: boolean): void
}>()
</script>
