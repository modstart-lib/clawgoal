<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden"
  >
    <div
      class="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700"
    >
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('common.total', { total: filteredItems.length }) }}
      </span>
      <a-select
        v-model:value="filterName"
        :placeholder="t('common.noData')"
        class="!w-40"
        allow-clear
      >
        <a-select-option value="">{{ t('common.noData') }}</a-select-option>
        <a-select-option v-for="m in metricList" :key="m.name" :value="m.name">
          {{ m.title }}
        </a-select-option>
      </a-select>
    </div>

    <a-table
      :data-source="filteredItems"
      :columns="tableColumns"
      row-key="id"
      :pagination="{ pageSize: 20, showSizeChanger: false }"
      :scroll="{ x: 'max-content' }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'metricTitle'">
          <span
            class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {{ getMetricTitle(record.name) }}
          </span>
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space>
            <a-button @click="emit('editItem', record)">
              <div class="inline-flex items-center gap-1">
                <Pencil class="w-4 h-4" aria-hidden="true" />
                {{ t('common.edit') }}
              </div>
            </a-button>
            <a-popconfirm
              :title="t('claw.metric.deleteDataConfirm')"
              :ok-text="t('common.confirm')"
              :cancel-text="t('common.cancel')"
              @confirm="emit('deleteItem', record)"
            >
              <a-button danger>
                <div class="inline-flex items-center gap-1">
                  <Trash2 class="w-4 h-4" aria-hidden="true" />
                  {{ t('common.delete') }}
                </div>
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { type MetricDataItem, type MetricItem } from '@/claw/api/metric'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Pencil from '~icons/lucide/pencil'
import Trash2 from '~icons/lucide/trash-2'

const { t } = useI18n()

const props = defineProps<{
  metricList: MetricItem[]
  metricItems: MetricDataItem[]
}>()

const emit = defineEmits<{
  (e: 'editItem', item: MetricDataItem): void
  (e: 'deleteItem', item: MetricDataItem): void
}>()

const filterName = ref('')

const tableColumns = computed(() => [
  {
    title: t('claw.metric.day'),
    dataIndex: 'day',
    key: 'day',
    sorter: (a: MetricDataItem, b: MetricDataItem) =>
      a.day.localeCompare(b.day),
  },
  { title: t('claw.metric.metricTitle'), key: 'metricTitle' },
  {
    title: t('claw.metric.value'),
    dataIndex: 'value',
    key: 'value',
    sorter: (a: MetricDataItem, b: MetricDataItem) => a.value - b.value,
  },
  {
    title: t('claw.metric.remark'),
    dataIndex: 'remark',
    key: 'remark',
  },
  { title: t('common.actions'), key: 'actions', width: 120 },
])

const filteredItems = computed(() => {
  if (!filterName.value) return props.metricItems
  return props.metricItems.filter((i) => i.name === filterName.value)
})

const getMetricTitle = (name: string) => {
  return props.metricList.find((m) => m.name === name)?.title ?? name
}
</script>
