<template>
  <a-modal
    :keyboard="false"
    :mask-closable="true"
    :open="open"
    :title="item?.title"
    width="min(700px, 90vw)"
    :footer="null"
    @cancel="$emit('update:open', false)"
  >
    <div v-if="item" class="space-y-3 py-1">
      <!-- 状态 + 优先级 + 类型 -->
      <div class="flex flex-wrap items-center gap-2">
        <a-tag :color="STATUS_CONFIG[item.status]?.tagColor">
          {{ STATUS_CONFIG[item.status]?.label }}
        </a-tag>
        <a-tag
          v-if="item.priority !== 'medium'"
          :color="PRIORITY_CONFIG[item.priority]?.tagColor"
        >
          {{ PRIORITY_CONFIG[item.priority]?.label }}
        </a-tag>
        <span
          v-if="item.type"
          class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
        >
          {{ item.type }}
        </span>
      </div>

      <!-- 来源 -->
      <div
        v-if="item.source"
        class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
      >
        <span
          class="font-medium text-gray-500 dark:text-gray-400 w-14 shrink-0"
          >{{ t('claw.backlog.viewSourceLabel') }}</span
        >
        <span>{{ item.source }}</span>
      </div>

      <!-- 截止时间 -->
      <div
        v-if="item.dueAt"
        class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
      >
        <span
          class="font-medium text-gray-500 dark:text-gray-400 w-14 shrink-0"
          >{{ t('claw.backlog.dueDateLabel2') }}</span
        >
        <DatetimeViewer :value="item.dueAt" format="date" />
      </div>

      <!-- 废弃原因 -->
      <div
        v-if="item.reason && item.status === 'dropped'"
        class="flex items-start gap-2 text-sm"
      >
        <span
          class="font-medium text-gray-500 dark:text-gray-400 w-14 shrink-0 pt-0.5"
          >{{ t('claw.backlog.reasonLabel') }}</span
        >
        <span class="text-red-500 dark:text-red-400">{{ item.reason }}</span>
      </div>

      <!-- 详细描述 -->
      <div
        v-if="item.detail"
        class="border-t border-gray-100 dark:border-gray-700 pt-3"
      >
        <div
          class="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1.5"
        >
          {{ t('claw.backlog.detailTitle') }}
        </div>
        <div
          class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap"
        >
          {{ item.detail }}
        </div>
      </div>

      <!-- 时间信息 -->
      <div
        class="border-t border-gray-100 dark:border-gray-700 pt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400 dark:text-gray-500"
      >
        <span
          >{{ t('claw.backlog.createLabel')
          }}<DatetimeViewer :value="item.createdAt"
        /></span>
        <span v-if="item.activeAt"
          >{{ t('claw.backlog.activeLabel')
          }}<DatetimeViewer :value="item.activeAt"
        /></span>
        <span v-if="item.doneAt"
          >{{ t('claw.backlog.doneLabel')
          }}<DatetimeViewer :value="item.doneAt"
        /></span>
      </div>

      <!-- Meta 信息 -->
      <div
        v-if="item.meta"
        class="border-t border-gray-100 dark:border-gray-700 pt-3"
      >
        <div class="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">
          {{ t('claw.backlog.metaTitle') }}
        </div>
        <MetaViewer :meta="item.meta" />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { BacklogItem } from '@/claw/api/backlog'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import MetaViewer from '@/components/MetaViewer.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  open: boolean
  item: BacklogItem | null
}>()

defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const STATUS_CONFIG: Record<string, { label: string; tagColor: string }> = {
  pending: { label: t('claw.backlog.statusPending'), tagColor: 'default' },
  active: { label: t('claw.backlog.statusActive'), tagColor: 'blue' },
  pool: { label: t('claw.backlog.statusPool'), tagColor: 'orange' },
  dropped: { label: t('claw.backlog.statusDropped'), tagColor: 'red' },
  done: { label: t('claw.backlog.statusDone'), tagColor: 'green' },
}

const PRIORITY_CONFIG: Record<string, { label: string; tagColor: string }> = {
  high: { label: t('claw.backlog.priorityHigh'), tagColor: 'red' },
  medium: { label: t('claw.backlog.priorityMedium'), tagColor: 'orange' },
  low: { label: t('claw.backlog.priorityLow'), tagColor: 'default' },
}
</script>
