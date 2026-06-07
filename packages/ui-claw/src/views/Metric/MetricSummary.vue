<template>
  <div>
    <EmptyState
      v-if="metricList.length === 0"
      :description="t('claw.metric.noData')"
    />
    <template v-else>
      <!-- Summary Cards -->
      <div
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6"
      >
        <div
          v-for="item in summaryData"
          :key="item.name"
          class="group relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
        >
          <!-- 顶部：标题 + 统计模式 -->
          <div
            class="px-4 pt-4 pb-1 shrink-0 flex items-center justify-between gap-1"
          >
            <span
              class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate"
              >{{ item.title }}</span
            >
            <span
              class="text-xs text-gray-400 dark:text-gray-500 shrink-0 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded"
              >{{
                getMetricMode(item.name) === 'avg'
                  ? t('claw.metric.summaryModeAvg')
                  : getMetricMode(item.name) === 'latest'
                    ? t('claw.metric.summaryModeLatest')
                    : t('claw.metric.summaryModeSum')
              }}</span
            >
          </div>
          <!-- 中间：数字 + 统计 -->
          <div class="flex-1 px-4 pb-2">
            <div
              class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1"
            >
              {{
                formatNumber(
                  getMetricMode(item.name) === 'avg'
                    ? item.avg
                    : getMetricMode(item.name) === 'latest'
                      ? item.latest
                      : item.sum
                )
              }}
            </div>
            <div
              class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500"
            >
              <span v-if="getMetricMode(item.name) === 'avg'">
                {{ t('claw.metric.sum') }}: {{ formatNumber(item.sum) }}
              </span>
              <span v-else-if="getMetricMode(item.name) === 'latest'">
                {{ t('claw.metric.average') }}:
                {{ formatNumber(item.avg) }}
              </span>
              <span v-else>
                {{ t('claw.metric.average') }}:
                {{ formatNumber(item.avg) }}
              </span>
              <span>{{ t('claw.metric.days') }}: {{ item.count }}</span>
            </div>
          </div>
          <!-- 底部：最新数据 + 下拉占位 -->
          <div class="px-4 pb-3 pt-1 flex items-end pr-10 min-h-8 shrink-0">
            <div
              v-if="item.latestDay"
              class="text-xs text-gray-400 dark:text-gray-500"
            >
              {{ t('claw.metric.latest') }}:
              {{ formatNumber(item.latest) }}
              <span class="ml-1 opacity-60">{{ item.latestDay }}</span>
            </div>
          </div>
          <!-- 更多操作 -->
          <a-dropdown :trigger="['hover']" placement="bottomRight">
            <a-button
              type="text"
              class="absolute! bottom-2! right-2! p-1! flex items-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              @click.stop
            >
              <MoreHorizontal
                class="w-4 h-4 text-gray-500"
                aria-hidden="true"
              />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="emit('editMetric', item.name)">
                  <div class="flex items-center gap-2">
                    <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('common.edit') }}
                  </div>
                </a-menu-item>
                <a-menu-item
                  class="!text-red-500"
                  @click="emit('deleteMetric', item.name)"
                >
                  <div class="flex items-center gap-2">
                    <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('common.delete') }}
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>

      <!-- Mini Chart per metric -->
      <div class="space-y-4">
        <div
          v-for="m in metricList"
          :key="m.name"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <span
              class="font-semibold text-gray-800 dark:text-gray-200 text-sm"
              >{{ m.title }}</span
            >
            <div class="flex items-center gap-2">
              <a-button @click="emit('inputData', m)">
                <div class="inline-flex items-center gap-1">
                  <Plus class="w-4 h-4" aria-hidden="true" />
                  {{ t('claw.metric.inputData') }}
                </div>
              </a-button>
              <a-button @click="openDataManage(m)">
                <div class="inline-flex items-center gap-1">
                  <Database class="w-4 h-4" aria-hidden="true" />
                  {{ t('claw.metric.dataManage') }}
                </div>
              </a-button>
            </div>
          </div>
          <VChart
            class="!h-32"
            :option="buildMiniChartOption(m.name)"
            autoresize
          />
        </div>
      </div>
    </template>
  </div>

  <!-- 数据管理弹窗 -->
  <MetricDataModal
    v-model:open="showDataManageModal"
    :project-id="projectId"
    :metric="dataManageMetric"
    @refresh="emit('refresh')"
  />
</template>

<script setup lang="ts">
import {
  type MetricDataItem,
  type MetricItem,
  type MetricSummaryItem,
} from '@/claw/api/metric'
import EmptyState from '@/components/EmptyState.vue'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'
import Database from '~icons/lucide/database'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import { ref } from 'vue'
import dayjs from 'dayjs'
import MetricDataModal from './MetricDataModal.vue'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const { t } = useI18n()

const props = defineProps<{
  metricList: MetricItem[]
  metricItems: MetricDataItem[]
  summaryData: MetricSummaryItem[]
  projectId: number
  startDay: string
  endDay: string
}>()

const emit = defineEmits<{
  (e: 'editMetric', name: string): void
  (e: 'deleteMetric', name: string): void
  (e: 'inputData', metric: MetricItem): void
  (e: 'refresh'): void
}>()

const getMetricMode = (name: string) =>
  props.metricList.find((m) => m.name === name)?.summaryMode ?? 'sum'

const showDataManageModal = ref(false)
const dataManageMetric = ref<MetricItem | null>(null)
const openDataManage = (m: MetricItem) => {
  dataManageMetric.value = m
  showDataManageModal.value = true
}

const buildMiniChartOption = (name: string) => {
  const items = props.metricItems.filter((i) => i.name === name)
  const days: string[] = []
  let current = dayjs(props.startDay)
  const end = dayjs(props.endDay)
  while (!current.isAfter(end)) {
    days.push(current.format('YYYY-MM-DD'))
    current = current.add(1, 'day')
  }
  const values = days.map((d) => items.find((i) => i.day === d)?.value ?? 0)
  return {
    grid: { top: 4, bottom: 20, left: 40, right: 10 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: days, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 2 },
      },
    ],
  }
}

const formatNumber = (v: number) => {
  if (v === 0) return '0'
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(2) + 'w'
  if (Number.isInteger(v)) return v.toString()
  return v.toFixed(2)
}
</script>
