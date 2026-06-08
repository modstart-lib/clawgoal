<template>
  <div class="py-6 px-1">
    <ListerTop :loading="loading" @refresh="loadData">
      <a-select
        :value="activeRange || undefined"
        class="w-40!"
        @change="setDateRange"
      >
        <a-select-option
          v-for="range in dateRanges"
          :key="range.value"
          :value="range.value"
        >
          {{ range.label }}
        </a-select-option>
      </a-select>
      <a-range-picker
        v-model:value="customRange"
        :placeholder="[t('claw.metric.day'), t('claw.metric.day')]"
        @change="onCustomRange"
      />
      <template #actions>
        <a-button @click="showManageModal = true">
          <div class="inline-flex items-center gap-1">
            <Settings2 class="w-4 h-4" aria-hidden="true" />
            {{ t('claw.metric.manageMetric') }}
          </div>
        </a-button>
        <a-button
          v-if="metricList.length > 0 || loading"
          @click="showBatchInputModal = true"
        >
          <div class="inline-flex items-center gap-1">
            <Upload class="w-4 h-4" aria-hidden="true" />
            {{ t('claw.metric.batchInput') }}
          </div>
        </a-button>
        <a-radio-group
          v-if="metricList.length > 0 || loading"
          v-model:value="viewMode"
          button-style="solid"
        >
          <a-radio-button value="summary">
            <div class="inline-flex items-center gap-1">
              <BarChart2 class="w-4 h-4" aria-hidden="true" />
              {{ t('claw.metric.summary') }}
            </div>
          </a-radio-button>
          <a-radio-button value="table">
            <div class="inline-flex items-center gap-1">
              <Table2 class="w-4 h-4" aria-hidden="true" />
              {{ t('claw.metric.tableView') }}
            </div>
          </a-radio-button>
        </a-radio-group>
      </template>
    </ListerTop>
    <LoadingState :loading="loading">
      <!-- Summary View -->
      <MetricSummary
        v-if="viewMode === 'summary'"
        :metric-list="metricList"
        :metric-items="metricItems"
        :summary-data="summaryData"
        :project-id="projectId"
        :start-day="startDay"
        :end-day="endDay"
        @edit-metric="() => (showManageModal = true)"
        @delete-metric="confirmDeleteMetricByName"
        @input-data="openInputData"
        @refresh="loadData"
      />

      <!-- Table View -->
      <MetricTable
        v-else-if="viewMode === 'table'"
        :metric-list="metricList"
        :metric-items="metricItems"
        @edit-item="openEditDataItem"
        @delete-item="deleteDataItem"
      />
    </LoadingState>

    <!-- ─── Manage Metric Modal ─── -->
    <MetricManageModal
      v-model:open="showManageModal"
      :project-id="projectId"
      @refresh="loadData"
    />

    <!-- ─── Input Data Modal ─── -->
    <a-modal
      v-model:open="showInputDataModal"
      width="min(600px, 90vw)"
      :keyboard="false"
      :mask-closable="false"
      :title="
        editingDataItem ? t('claw.metric.editData') : t('claw.metric.inputData')
      "
      :ok-text="t('common.save')"
      :cancel-text="t('common.cancel')"
      :confirm-loading="dataSaving"
      @ok="saveDataItem"
      @cancel="closeInputDataModal"
    >
      <div class="space-y-4 py-2">
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {{ t('claw.metric.day') }}
            <span class="text-red-500">*</span>
          </div>
          <a-date-picker
            v-model:value="dataForm.day"
            class="wait $BGPIDfull"
            value-format="YYYY-MM-DD"
          />
        </div>
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {{ t('claw.metric.metricTitle') }}
          </div>
          <a-select
            v-model:value="dataForm.name"
            class="wait $BGPIDfull"
            :disabled="!!editingDataItem"
          >
            <a-select-option
              v-for="m in metricList"
              :key="m.name"
              :value="m.name"
            >
              {{ m.title }}
            </a-select-option>
          </a-select>
        </div>
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {{ t('claw.metric.value') }}
            <span class="text-red-500">*</span>
          </div>
          <a-input-number
            v-model:value="dataForm.value"
            class="wait $BGPIDfull"
            :step="0.01"
          />
        </div>
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {{ t('claw.metric.remark') }}
          </div>
          <a-input
            v-model:value="dataForm.remark"
            :placeholder="t('claw.metric.remarkPlaceholder')"
            allow-clear
          />
        </div>
      </div>
    </a-modal>

    <!-- ─── Batch Input Modal ─── -->
    <a-modal
      v-model:open="showBatchInputModal"
      width="min(600px, 90vw)"
      :keyboard="false"
      :mask-closable="false"
      :title="t('claw.metric.batchInput')"
      :ok-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      :confirm-loading="batchSaving"
      @ok="saveBatchInput"
    >
      <div class="py-2 space-y-3">
        <div
          class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 font-mono"
        >
          {{ t('claw.metric.batchInputPlaceholder') }}
        </div>
        <a-textarea
          v-model:value="batchInputText"
          :rows="10"
          :placeholder="t('claw.metric.batchInputPlaceholder')"
          class="!font-mono !text-sm"
        />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import {
  batchUpsertMetricItems,
  deleteMetric,
  deleteMetricItems,
  getMetricSummary,
  listMetric,
  listMetricItems,
  type MetricDataItem,
  type MetricItem,
  type MetricSummaryItem,
  upsertMetricItem,
} from '@/claw/api/metric'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import { message, Modal } from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BarChart2 from '~icons/lucide/bar-chart-2'
import Settings2 from '~icons/lucide/settings-2'
import Table2 from '~icons/lucide/table-2'
import Upload from '~icons/lucide/upload'
import MetricManageModal from './MetricManageModal.vue'
import MetricSummary from './MetricSummary.vue'
import MetricTable from './MetricTable.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t, tm, te } = useI18n()

const props = defineProps<{ projectId: number }>()

const DEFAULT_METRIC_TITLE_ALIASES: Record<string, string[]> = {
  pv: ['pv', 'page views', 'pageview', 'pageviews'],
  uv: ['uv', 'unique visitors', 'unique visitor'],
  income: ['income', 'revenue'],
  refund: ['refund'],
  userCount: ['usercount', 'user count', 'users'],
  dau: ['dau', 'daily active users'],
}

const normalizeTitle = (title: string) => title.trim().toLowerCase()

const resolveMetricTitle = (name: string, title: string) => {
  const key = `metric.defaultTitles.${name}`
  if (!te(key)) return title
  const localizedTitle = t(key)

  const staticAliases = DEFAULT_METRIC_TITLE_ALIASES[name] || []
  const zhAliases = tm(`metric.defaultTitleAliasesZh.${name}`) as string[]
  const allAliases = [
    ...staticAliases,
    ...(Array.isArray(zhAliases) ? zhAliases : []),
  ]
  const normalizedTitle = normalizeTitle(title)
  if (allAliases.some((alias) => normalizeTitle(alias) === normalizedTitle)) {
    return localizedTitle
  }
  return title
}

// ─── Date Range ───────────────────────────────────────────────────────────────
const activeRange = ref('7')
const customRange = ref<[Dayjs, Dayjs] | null>([
  dayjs().subtract(7, 'day'),
  dayjs().subtract(1, 'day'),
])
const startDay = ref(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
const endDay = ref(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))

const dateRanges = computed(() => [
  { value: '7', label: t('claw.metric.last7Days') },
  { value: '30', label: t('claw.metric.last30Days') },
  { value: '90', label: t('claw.metric.last90Days') },
  { value: '365', label: t('claw.metric.last365Days') },
])

const setDateRange = (value: string) => {
  activeRange.value = value
  const end = dayjs().subtract(1, 'day')
  const start = dayjs().subtract(Number(value), 'day')
  endDay.value = end.format('YYYY-MM-DD')
  startDay.value = start.format('YYYY-MM-DD')
  customRange.value = [start, end]
  loadData()
}

const onCustomRange = (dates: [Dayjs, Dayjs] | null) => {
  if (dates) {
    activeRange.value = ''
    startDay.value = dates[0].format('YYYY-MM-DD')
    endDay.value = dates[1].format('YYYY-MM-DD')
    loadData()
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const loading = ref(false)
const viewMode = ref<'summary' | 'table'>('summary')
const metricList = ref<MetricItem[]>([])
const metricItems = ref<MetricDataItem[]>([])
const summaryData = ref<MetricSummaryItem[]>([])

const loadData = async () => {
  loading.value = true
  try {
    const [ml, mi, sd] = await Promise.all([
      listMetric(props.projectId),
      listMetricItems({
        projectId: props.projectId,
        startDay: startDay.value,
        endDay: endDay.value,
      }),
      getMetricSummary({
        projectId: props.projectId,
        startDay: startDay.value,
        endDay: endDay.value,
      }),
    ])
    metricList.value = ml.map((item: MetricItem) => ({
      ...item,
      title: resolveMetricTitle(item.name, item.title),
    }))
    metricItems.value = mi
    summaryData.value = sd.map((item: MetricSummaryItem) => ({
      ...item,
      title: resolveMetricTitle(item.name, item.title),
    }))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.projectId,
  () => {
    metricList.value = []
    metricItems.value = []
    summaryData.value = []
    loadData()
  }
)

// ─── Manage Metric Modal ─────────────────────────────────────────────────────
const showManageModal = ref(false)

// ─── Metric CRUD ──────────────────────────────────────────────────────────────
const confirmDeleteMetricByName = (name: string) => {
  const m = metricList.value.find((m) => m.name === name)
  if (!m) return
  Modal.confirm({
    title: t('claw.metric.deleteMetric'),
    content: t('claw.metric.deleteMetricConfirm'),
    okText: t('common.confirm'),
    cancelText: t('common.cancel'),
    okButtonProps: { danger: true },
    onOk: async () => {
      await deleteMetric(m.id)
      message.success(t('claw.metric.metricDeleted'))
      loadData()
    },
  })
}

// ─── Data Input CRUD ──────────────────────────────────────────────────────────
const showInputDataModal = ref(false)
const editingDataItem = ref<MetricDataItem | null>(null)
const dataSaving = ref(false)
const dataForm = ref({
  day: dayjs().format('YYYY-MM-DD'),
  name: '',
  value: 0,
  remark: '',
})

const openInputData = (m: MetricItem) => {
  editingDataItem.value = null
  dataForm.value = {
    day: dayjs().format('YYYY-MM-DD'),
    name: m.name,
    value: 0,
    remark: '',
  }
  showInputDataModal.value = true
}

const openEditDataItem = (item: MetricDataItem) => {
  editingDataItem.value = item
  dataForm.value = {
    day: item.day,
    name: item.name,
    value: item.value,
    remark: item.remark ?? '',
  }
  showInputDataModal.value = true
}

const closeInputDataModal = () => {
  showInputDataModal.value = false
  editingDataItem.value = null
}

const saveDataItem = async () => {
  const { day, name, value, remark } = dataForm.value
  if (!day) {
    message.warning(t('claw.metric.day') + ' ' + t('claw.metric.nameRequired'))
    return
  }
  if (!name) {
    message.warning(t('claw.metric.nameRequired'))
    return
  }

  dataSaving.value = true
  try {
    await upsertMetricItem({
      projectId: props.projectId,
      day,
      name,
      value: Number(value),
      remark: remark || null,
    })
    message.success(t('claw.metric.dataSaved'))
    closeInputDataModal()
    loadData()
  } finally {
    dataSaving.value = false
  }
}

const deleteDataItem = async (item: MetricDataItem) => {
  await deleteMetricItems({
    projectId: item.projectId,
    day: item.day,
    name: item.name,
  })
  message.success(t('claw.metric.dataDeleted'))
  loadData()
}

// ─── Batch Input ──────────────────────────────────────────────────────────────
const showBatchInputModal = ref(false)
const batchInputText = ref('')
const batchSaving = ref(false)

const saveBatchInput = async () => {
  const lines = batchInputText.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const items: Array<{
    projectId: number
    day: string
    name: string
    value: number
  }> = []

  for (const line of lines) {
    const parts = line.split(',')
    if (parts.length !== 3) {
      message.error(t('claw.metric.batchInputError'))
      return
    }
    const [day, name, valueStr] = parts
    const value = parseFloat(valueStr)
    if (!day || !name || isNaN(value)) {
      message.error(t('claw.metric.batchInputError'))
      return
    }
    items.push({
      projectId: props.projectId,
      day: day.trim(),
      name: name.trim(),
      value,
    })
  }

  if (items.length === 0) {
    message.warning(t('common.noData'))
    return
  }

  batchSaving.value = true
  try {
    await batchUpsertMetricItems(items)
    message.success(t('claw.metric.batchInputSuccess'))
    showBatchInputModal.value = false
    batchInputText.value = ''
    loadData()
  } finally {
    batchSaving.value = false
  }
}

onMounted(() => {
  loadData()
  testActionSet('list.refresh', () => loadData())
  testActionSet('metric.openManage', () => {
    showManageModal.value = true
  })
})

onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('metric.openManage')
})
</script>
