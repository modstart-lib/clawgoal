<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5"
  >
    <VChart
      v-if="metricItems.length > 0"
      class="!h-80"
      :option="combinedChartOption"
      autoresize
    />
    <div
      v-else
      class="h-80 flex items-center justify-center text-sm text-gray-400"
    >
      {{ t('claw.metric.noData') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { type MetricDataItem, type MetricItem } from '@/claw/api/metric'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
])

const { t } = useI18n()

const props = defineProps<{
  metricList: MetricItem[]
  metricItems: MetricDataItem[]
  startDay: string
  endDay: string
}>()

const generateDateRange = (startDay: string, endDay: string): string[] => {
  const result: string[] = []
  let current = dayjs(startDay)
  const end = dayjs(endDay)
  while (!current.isAfter(end)) {
    result.push(current.format('YYYY-MM-DD'))
    current = current.add(1, 'day')
  }
  return result
}

const combinedChartOption = computed(() => {
  const allDays = generateDateRange(props.startDay, props.endDay)
  const series = props.metricList.map((m) => ({
    name: m.title,
    type: 'line',
    smooth: true,
    symbol: 'none',
    data: allDays.map(
      (d) =>
        props.metricItems.find((i) => i.day === d && i.name === m.name)
          ?.value ?? 0
    ),
  }))
  return {
    grid: { top: 30, bottom: 40, left: 50, right: 20 },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, type: 'scroll' },
    xAxis: { type: 'category', data: allDays, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    series,
  }
})
</script>
