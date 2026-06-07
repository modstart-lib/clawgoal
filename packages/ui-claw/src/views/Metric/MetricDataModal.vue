<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="
      metric
        ? metric.title + ' · ' + t('claw.metric.dataManage')
        : t('claw.metric.dataManage')
    "
    width="95vw"
    :footer="null"
    @cancel="emit('update:open', false)"
  >
    <div class="mt-2">
      <ListerTop :loading="loading" :total="records.length" @refresh="loadData">
        <a-range-picker
          v-model:value="dateRange"
          :placeholder="[t('claw.metric.day'), t('claw.metric.day')]"
          @change="loadData"
        />
      </ListerTop>

      <a-table
        :data-source="records"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :pagination="{
          pageSize: 20,
          showSizeChanger: false,
          hideOnSinglePage: true,
        }"
        :scroll="{ x: 'max-content', y: 480 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button @click="openEdit(record)">
                <div class="inline-flex items-center gap-1">
                  <Pencil class="w-4 h-4" aria-hidden="true" />
                  {{ t('common.edit') }}
                </div>
              </a-button>
              <a-popconfirm
                :title="t('claw.metric.deleteDataConfirm')"
                :ok-text="t('common.confirm')"
                :cancel-text="t('common.cancel')"
                @confirm="handleDelete(record)"
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

        <template #emptyText>
          <div
            class="text-sm text-gray-400 dark:text-gray-500 py-12 text-center"
          >
            {{ t('claw.metric.noData') }}
          </div>
        </template>
      </a-table>
    </div>
  </a-modal>

  <!-- 编辑弹窗 -->
  <a-modal
    v-model:open="showEditModal"
    :keyboard="false"
    :mask-closable="false"
    :title="t('claw.metric.editData')"
    :ok-text="t('common.confirm')"
    :cancel-text="t('common.cancel')"
    :confirm-loading="saving"
    width="min(480px, 90vw)"
    @ok="saveEdit"
    @cancel="showEditModal = false"
  >
    <div class="space-y-4 py-2">
      <div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {{ t('claw.metric.day') }}
        </div>
        <a-date-picker v-model:value="editForm.dayObj" class="w-full" />
      </div>
      <div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {{ t('claw.metric.value') }}
        </div>
        <a-input-number v-model:value="editForm.value" class="w-full" />
      </div>
      <div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {{ t('claw.metric.remark') }}
        </div>
        <a-textarea
          v-model:value="editForm.remark"
          :placeholder="t('claw.metric.remarkPlaceholder')"
          :rows="2"
        />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import {
  deleteMetricItems,
  listMetricItems,
  upsertMetricItem,
  type MetricDataItem,
  type MetricItem,
} from '@/claw/api/metric'
import ListerTop from '@/components/ListerTop.vue'
import { message } from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Pencil from '~icons/lucide/pencil'
import Trash2 from '~icons/lucide/trash-2'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  projectId: number
  metric: MetricItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'refresh'): void
}>()

// ─── Data ─────────────────────────────────────────────────────────────────────
const loading = ref(false)
const records = ref<MetricDataItem[]>([])
const dateRange = ref<[Dayjs, Dayjs] | null>(null)

const loadData = async () => {
  if (!props.metric) return
  loading.value = true
  try {
    records.value = await listMetricItems({
      projectId: props.projectId,
      name: props.metric.name,
      startDay: dateRange.value
        ? dateRange.value[0].format('YYYY-MM-DD')
        : undefined,
      endDay: dateRange.value
        ? dateRange.value[1].format('YYYY-MM-DD')
        : undefined,
    })
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.metric],
  ([open]) => {
    if (open) loadData()
  }
)

// ─── Table columns ─────────────────────────────────────────────────────────────
const columns = [
  {
    title: t('claw.metric.day'),
    dataIndex: 'day',
    key: 'day',
    width: 130,
  },
  {
    title: t('claw.metric.value'),
    dataIndex: 'value',
    key: 'value',
    width: 120,
  },
  {
    title: t('claw.metric.remark'),
    dataIndex: 'remark',
    key: 'remark',
    ellipsis: true,
  },
  { title: t('common.actions'), key: 'actions', width: 160 },
]

// ─── Edit ──────────────────────────────────────────────────────────────────────
const showEditModal = ref(false)
const saving = ref(false)
const editingRecord = ref<MetricDataItem | null>(null)
const editForm = ref({ dayObj: null as Dayjs | null, value: 0, remark: '' })

const openEdit = (record: MetricDataItem) => {
  editingRecord.value = record
  editForm.value = {
    dayObj: dayjs(record.day),
    value: record.value,
    remark: record.remark ?? '',
  }
  showEditModal.value = true
}

const saveEdit = async () => {
  if (!editingRecord.value || !editForm.value.dayObj) return
  saving.value = true
  try {
    await upsertMetricItem({
      projectId: props.projectId,
      day: editForm.value.dayObj.format('YYYY-MM-DD'),
      name: editingRecord.value.name,
      value: Number(editForm.value.value),
      remark: editForm.value.remark || null,
    })
    message.success(t('claw.metric.dataSaved'))
    showEditModal.value = false
    await loadData()
    emit('refresh')
  } finally {
    saving.value = false
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────────
const handleDelete = async (record: MetricDataItem) => {
  await deleteMetricItems({
    projectId: record.projectId,
    day: record.day,
    name: record.name,
  })
  message.success(t('claw.metric.dataDeleted'))
  await loadData()
  emit('refresh')
}

onMounted(() => {
  testActionSet('list.refresh', () => loadData())
})

onUnmounted(() => {
  testActionUnset('list.refresh')
})
</script>
