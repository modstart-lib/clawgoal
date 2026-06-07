<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('config.dashboardDetailTitle', { model: model?.name || '' })"
    :footer="null"
    width="95vw"
    @cancel="emit('update:open', false)"
  >
    <div class="py-2">
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <a-range-picker
          v-model:value="modalDateRange"
          show-time
          format="YYYY-MM-DD HH:mm"
          :placeholder="[
            $t('config.dashboardStartTime'),
            $t('config.dashboardEndTime'),
          ]"
          class="w-80"
          @change="refreshChart"
        />
        <a-divider type="vertical" class="mx-1!" />
        <a-select
          v-model:value="modalQuickRange"
          class="w-32"
          @change="onQuickRangeChange"
        >
          <a-select-option value="today">{{
            $t('config.dashboardToday')
          }}</a-select-option>
          <a-select-option value="7d">{{
            $t('config.dashboardLast7d')
          }}</a-select-option>
          <a-select-option value="30d">{{
            $t('config.dashboardLast30d')
          }}</a-select-option>
          <a-select-option value="1y">{{
            $t('config.dashboardLastYear')
          }}</a-select-option>
        </a-select>
        <a-divider type="vertical" class="mx-1!" />
        <a-radio-group v-model:value="modalGranularity" @change="refreshChart">
          <a-radio-button value="day">{{
            $t('config.dashboardByDay')
          }}</a-radio-button>
          <a-radio-button value="hour">{{
            $t('config.dashboardByHour')
          }}</a-radio-button>
        </a-radio-group>
        <div class="ml-auto flex items-center gap-4 text-xs">
          <span class="text-gray-500">{{
            $t('config.dashboardCallsStat', {
              n: model?.calls.toLocaleString(),
            })
          }}</span>
          <span class="text-gray-500">{{
            $t('config.dashboardInputStat', {
              n: formatTokens(model?.inputTokens || 0),
            })
          }}</span>
          <span class="text-gray-500">{{
            $t('config.dashboardOutputStat', {
              n: formatTokens(model?.outputTokens || 0),
            })
          }}</span>
        </div>
      </div>
      <div class="h-72 w-full bg-gray-50 rounded-lg p-2">
        <v-chart class="chart" :option="chartOption" autoresize />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type {
  ModelDailyStatRecord,
  ModelHourlyStatRecord,
  ModelStat,
} from '@/api/modelLog'
import { getModelDailyStats, getModelHourlyStats } from '@/api/modelLog'
import dayjs, { type Dayjs } from 'dayjs'
import { BarChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VChart from 'vue-echarts'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
])

const props = defineProps<{
  open: boolean
  model: ModelStat | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t } = useI18n()

const modalDateRange = ref<[Dayjs, Dayjs] | null>(null)
const modalQuickRange = ref('7d')
const modalGranularity = ref<'day' | 'hour'>('day')
const chartOption = ref({})

watch(
  () => props.open,
  async (val) => {
    if (val) {
      modalDateRange.value = [
        dayjs().subtract(7, 'day').startOf('day'),
        dayjs(),
      ]
      modalQuickRange.value = '7d'
      modalGranularity.value = 'day'
      await refreshChart()
    }
  }
)

const onQuickRangeChange = (val: string) => {
  const days = val === 'today' ? 0 : val === '7d' ? 7 : val === '30d' ? 30 : 365
  const start =
    days === 0 ? dayjs().startOf('day') : dayjs().subtract(days, 'day')
  modalDateRange.value = [start, dayjs()]
  refreshChart()
}

const refreshChart = async () => {
  if (!props.model) return
  const start = modalDateRange.value?.[0] || dayjs().startOf('day')
  const end = modalDateRange.value?.[1] || dayjs()
  const params = {
    startAt: start.format('YYYY-MM-DD HH:mm:ss'),
    endAt: end.format('YYYY-MM-DD HH:mm:ss'),
    provider: props.model.provider,
    model: props.model.modelId,
  }
  if (modalGranularity.value === 'hour') {
    const records = await getModelHourlyStats(params)
    chartOption.value = buildChartFromHourly(start, end, records)
  } else {
    const records = await getModelDailyStats(params)
    chartOption.value = buildChartFromDaily(start, end, records)
  }
}

const formatTokens = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

const buildDateLabels = (start: Dayjs, end: Dayjs) => {
  const days = Math.max(end.diff(start, 'day') + 1, 1)
  return Array.from({ length: days }, (_, i) => {
    const d = start.add(i, 'day')
    return d.month() + 1 + '/' + d.date()
  })
}

const buildDateKeys = (start: Dayjs, end: Dayjs) => {
  const days = Math.max(end.diff(start, 'day') + 1, 1)
  return Array.from({ length: days }, (_, i) =>
    start.add(i, 'day').format('YYYY-MM-DD')
  )
}

const buildHourLabels = (start: Dayjs, end: Dayjs) => {
  const hours = Math.max(end.diff(start, 'hour') + 1, 1)
  return Array.from({ length: hours }, (_, i) => {
    const d = start.add(i, 'hour')
    return `${d.month() + 1}/${d.date()} ${d.format('HH')}:00`
  })
}

const buildHourKeys = (start: Dayjs, end: Dayjs) => {
  const hours = Math.max(end.diff(start, 'hour') + 1, 1)
  return Array.from({ length: hours }, (_, i) =>
    start.add(i, 'hour').format('YYYY-MM-DD HH:00')
  )
}

const buildChartFromDaily = (
  start: Dayjs,
  end: Dayjs,
  records: ModelDailyStatRecord[]
) => {
  const labels = buildDateLabels(start, end)
  const dateKeys = buildDateKeys(start, end)
  const byDate: Record<
    string,
    { input: number; output: number; calls: number }
  > = {}
  for (const r of records) {
    if (!byDate[r.date]) byDate[r.date] = { input: 0, output: 0, calls: 0 }
    byDate[r.date].input += r.totalPromptTokens
    byDate[r.date].output += r.totalCompletionTokens
    byDate[r.date].calls += r.callCount
  }
  return buildChartOption(
    labels,
    dateKeys.map((d) => byDate[d]?.input || 0),
    dateKeys.map((d) => byDate[d]?.output || 0),
    dateKeys.map((d) => byDate[d]?.calls || 0)
  )
}

const buildChartFromHourly = (
  start: Dayjs,
  end: Dayjs,
  records: ModelHourlyStatRecord[]
) => {
  const labels = buildHourLabels(start, end)
  const hourKeys = buildHourKeys(start, end)
  const byHour: Record<
    string,
    { input: number; output: number; calls: number }
  > = {}
  for (const r of records) {
    const key = dayjs(r.hour).format('YYYY-MM-DD HH:00')
    if (!byHour[key]) byHour[key] = { input: 0, output: 0, calls: 0 }
    byHour[key].input += r.totalPromptTokens
    byHour[key].output += r.totalCompletionTokens
    byHour[key].calls += r.callCount
  }
  return buildChartOption(
    labels,
    hourKeys.map((h) => byHour[h]?.input || 0),
    hourKeys.map((h) => byHour[h]?.output || 0),
    hourKeys.map((h) => byHour[h]?.calls || 0)
  )
}

const buildChartOption = (
  labels: string[],
  inputTokens: number[],
  outputTokens: number[],
  calls: number[]
) => ({
  backgroundColor: 'transparent',
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: {
    data: [
      t('config.dashboardChartLegendInput'),
      t('config.dashboardChartLegendOutput'),
      t('config.dashboardChartLegendCalls'),
    ],
    bottom: 0,
    textStyle: { color: '#374151' },
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '22%',
    top: '5%',
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    data: labels,
    axisLine: { lineStyle: { color: '#d1d5db' } },
    axisLabel: { color: '#6b7280', fontSize: 11 },
  },
  yAxis: [
    {
      type: 'value',
      name: 'Tokens',
      position: 'left',
      axisLine: { show: true, lineStyle: { color: '#6366f1' } },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
      nameTextStyle: { color: '#6b7280' },
      axisLabel: {
        color: '#6b7280',
        formatter: (v: number) => formatTokens(v),
      },
    },
    {
      type: 'value',
      name: t('config.dashboardChartYAxisTimes'),
      position: 'right',
      axisLine: { show: true, lineStyle: { color: '#10b981' } },
      splitLine: { show: false },
      nameTextStyle: { color: '#6b7280' },
      axisLabel: { color: '#6b7280' },
    },
  ],
  dataZoom: [
    { type: 'inside', start: 0, end: 100 },
    {
      type: 'slider',
      start: 0,
      end: 100,
      height: 20,
      bottom: 0,
      borderColor: '#e5e7eb',
      fillerColor: 'rgba(99,102,241,0.1)',
      handleStyle: { color: '#6366f1' },
    },
  ],
  series: [
    {
      name: t('config.dashboardChartLegendInput'),
      type: 'bar',
      stack: 'tokens',
      data: inputTokens,
      itemStyle: { color: '#6366f1' },
    },
    {
      name: t('config.dashboardChartLegendOutput'),
      type: 'bar',
      stack: 'tokens',
      data: outputTokens,
      itemStyle: { color: '#818cf8' },
    },
    {
      name: t('config.dashboardChartLegendCalls'),
      type: 'line',
      yAxisIndex: 1,
      data: calls,
      itemStyle: { color: '#10b981' },
      smooth: true,
      symbolSize: 6,
    },
  ],
})
</script>

<style scoped>
.chart {
  height: 100%;
  width: 100%;
}
</style>
