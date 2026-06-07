<script setup lang="ts">
import { systemApi, type SystemStats } from '@/api/system'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'
import Box from '~icons/lucide/box'
import Clock from '~icons/lucide/clock'
import Cpu from '~icons/lucide/cpu'
import HardDrive from '~icons/lucide/hard-drive'
import Loader2 from '~icons/lucide/loader-2'
import MemoryStick from '~icons/lucide/memory-stick'
import RefreshCw from '~icons/lucide/refresh-cw'
import RotateCw from '~icons/lucide/rotate-cw'

const { t } = useI18n()

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
])

const MAX_HISTORY = 60

interface HistoryPoint {
  time: string
  cpu: number
  mem: number
  rss: number
}

const stats = ref<SystemStats | null>(null)
const loading = ref(false)
const history = ref<HistoryPoint[]>([])
let timer: ReturnType<typeof setInterval> | null = null

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

function nowLabel(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

async function fetchStats() {
  loading.value = true
  try {
    stats.value = await systemApi.getStats()
    const s = stats.value
    if (s) {
      history.value.push({
        time: nowLabel(),
        cpu: s.cpu.usage,
        mem: s.memory.usagePercent,
        rss: Math.round(s.process.rss / 1024 / 1024),
      })
      if (history.value.length > MAX_HISTORY) {
        history.value = history.value.slice(history.value.length - MAX_HISTORY)
      }
    }
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

const chartOption = computed(() => {
  if (history.value.length < 2) return null
  const xData = history.value.map((p) => p.time)
  const colorPrimary = cssVar('--token-primary-600') || '#00b279'
  const colorSuccess = cssVar('--token-success') || '#52c41a'
  const colorPrimaryHover = cssVar('--token-primary-700') || '#009965'
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        return (
          params[0].name +
          '<br>' +
          params
            .map(
              (p) =>
                `${p.marker}${p.seriesName}: <b>${p.value}</b>${p.seriesIndex < 2 ? '%' : ' MB'}`
            )
            .join('<br>')
        )
      },
    },
    legend: {
      data: ['CPU', t('osMonitor.memory'), t('osMonitor.processMemory')],
      bottom: 0,
      textStyle: { fontSize: 12 },
    },
    grid: { left: 48, right: 56, top: 12, bottom: 36 },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: {
        fontSize: 10,
        interval: Math.floor(history.value.length / 8),
      },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
      },
      {
        type: 'value',
        min: 0,
        axisLabel: { fontSize: 10, formatter: '{value}M' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'CPU',
        type: 'line',
        yAxisIndex: 0,
        data: history.value.map((p) => p.cpu),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: colorPrimary, width: 2 },
        areaStyle: { color: colorPrimary + '14' },
      },
      {
        name: t('osMonitor.memory'),
        type: 'line',
        yAxisIndex: 0,
        data: history.value.map((p) => p.mem),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: colorSuccess, width: 2 },
        areaStyle: { color: colorSuccess + '14' },
      },
      {
        name: t('osMonitor.processMemory'),
        type: 'line',
        yAxisIndex: 1,
        data: history.value.map((p) => p.rss),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: colorPrimaryHover, width: 2, type: 'dashed' },
      },
    ],
  }
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function shortCpuModel(model: string): string {
  return model
    .replace(/\(R\)|\(TM\)|CPU|Processor/gi, '')
    .trim()
    .replace(/\s{2,}/g, ' ')
}

function cpuColor(pct: number): string {
  if (pct >= 90) return 'var(--color-error)'
  if (pct >= 70) return 'var(--color-warning)'
  return 'var(--color-primary)'
}

function memoryColor(pct: number): string {
  if (pct >= 90) return 'var(--color-error)'
  if (pct >= 70) return 'var(--color-warning)'
  return 'var(--color-primary)'
}

function diskColor(pct: number): string {
  if (pct >= 90) return 'var(--color-error)'
  if (pct >= 70) return 'var(--color-warning)'
  return 'var(--color-primary)'
}

function processMemItems(proc: SystemStats['process']) {
  const rss = proc.rss || 1
  return [
    {
      label: t('osMonitor.jsHeap'),
      value: proc.heapUsed,
      pct: Math.round((proc.heapUsed / rss) * 100),
      color: 'var(--color-primary-hover)',
    },
    {
      label: t('osMonitor.heapLimit'),
      value: proc.heapTotal,
      pct: Math.round((proc.heapTotal / rss) * 100),
      color: 'var(--color-primary)',
    },
    {
      label: t('osMonitor.external'),
      value: proc.external,
      pct: Math.round((proc.external / rss) * 100),
      color: 'var(--color-success)',
    },
    {
      label: t('osMonitor.buffers'),
      value: proc.arrayBuffers,
      pct: Math.round((proc.arrayBuffers / rss) * 100),
      color: 'var(--color-accent)',
    },
  ]
}

onMounted(() => {
  fetchStats()
  timer = setInterval(fetchStats, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div>
    <!-- 工具栏 -->
    <div class="flex items-center justify-between mb-3">
      <div
        class="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        <span>{{ $t('osMonitor.autoRefresh') }}</span>
      </div>
      <a-button type="default" :loading="loading" @click="fetchStats">
        <div class="inline-flex items-center gap-1">
          <RotateCw v-if="!loading" class="w-4 h-4" aria-hidden="true" />
          {{ $t('osMonitor.refresh') }}
        </div>
      </a-button>
    </div>

    <div v-if="!stats && loading" class="flex flex-col gap-3 py-4">
      <div class="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />
        <span>{{ t('common.loading') }}</span>
      </div>
      <a-skeleton active :paragraph="{ rows: 4 }" />
    </div>

    <template v-else-if="stats">
      <!-- 主要指标卡片 -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <!-- CPU 使用率 -->
        <div
          class="relative overflow-hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-xl p-4 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-gray-900/40 transition-all duration-300 group hover:border-primary/40 dark:hover:border-primary/30"
        >
          <div
            class="absolute -right-3 -bottom-3 opacity-[0.03] dark:opacity-5 group-hover:opacity-10 transition-all duration-500 pointer-events-none transform group-hover:scale-110 group-hover:-rotate-12"
          >
            <Cpu class="w-24 h-24 text-primary" />
          </div>
          <div class="flex items-center gap-2 mb-3 relative z-10">
            <div
              class="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
            >
              <Cpu class="w-5 h-5 text-primary" />
            </div>
            <div class="text-sm font-medium text-gray-600 dark:text-gray-300">
              CPU
            </div>
          </div>
          <div
            class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-all duration-300 group-hover:text-primary relative z-10 truncate"
          >
            {{ stats.cpu.usage
            }}<span
              class="text-base font-normal text-gray-400 group-hover:text-primary/50 dark:group-hover:text-primary/50 ml-0.5"
              >%</span
            >
          </div>
          <a-progress
            :percent="stats.cpu.usage"
            :stroke-color="cpuColor(stats.cpu.usage)"
            :show-info="false"
            size="small"
            class="relative z-10"
          />
          <div
            class="text-xs text-gray-400 mt-2 truncate relative z-10"
            :title="`${stats.cpu.count} ${$t('osMonitor.cpuCores')} · ${shortCpuModel(stats.cpu.model)}`"
          >
            {{ stats.cpu.count }} {{ $t('osMonitor.cpuCores') }} ·
            {{ shortCpuModel(stats.cpu.model) }}
          </div>
        </div>

        <!-- 系统内存 -->
        <div
          class="relative overflow-hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-xl p-4 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-gray-900/40 transition-all duration-300 group hover:border-primary/40 dark:hover:border-primary/30"
        >
          <div
            class="absolute -right-3 -bottom-3 opacity-[0.03] dark:opacity-5 group-hover:opacity-10 transition-all duration-500 pointer-events-none transform group-hover:scale-110 group-hover:-rotate-12"
          >
            <MemoryStick class="w-24 h-24 text-primary" />
          </div>
          <div class="flex items-center gap-2 mb-3 relative z-10">
            <div
              class="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
            >
              <MemoryStick class="w-5 h-5 text-primary" />
            </div>
            <div class="text-sm font-medium text-gray-600 dark:text-gray-300">
              {{ $t('osMonitor.memory') }}
            </div>
          </div>
          <div
            class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-all duration-300 group-hover:text-primary relative z-10 truncate"
          >
            {{ stats.memory.usagePercent
            }}<span
              class="text-base font-normal text-gray-400 group-hover:text-primary/50 dark:group-hover:text-primary/50 ml-0.5"
              >%</span
            >
          </div>
          <a-progress
            :percent="stats.memory.usagePercent"
            :stroke-color="memoryColor(stats.memory.usagePercent)"
            :show-info="false"
            size="small"
            class="relative z-10"
          />
          <div class="text-xs text-gray-400 mt-2 truncate relative z-10">
            {{ formatBytes(stats.memory.used) }} /
            {{ formatBytes(stats.memory.total) }}
          </div>
        </div>

        <!-- 进程内存 -->
        <div
          class="relative overflow-hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-xl p-4 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-gray-900/40 transition-all duration-300 group hover:border-primary/40 dark:hover:border-primary/30"
        >
          <div
            class="absolute -right-3 -bottom-3 opacity-[0.03] dark:opacity-5 group-hover:opacity-10 transition-all duration-500 pointer-events-none transform group-hover:scale-110 group-hover:-rotate-12"
          >
            <Box class="w-24 h-24 text-primary" />
          </div>
          <div class="flex items-center gap-2 mb-3 relative z-10">
            <div
              class="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
            >
              <Box class="w-5 h-5 text-primary" />
            </div>
            <div class="text-sm font-medium text-gray-600 dark:text-gray-300">
              {{ $t('osMonitor.processMemory') }}
            </div>
          </div>
          <div
            class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 transition-all duration-300 group-hover:text-primary relative z-10 truncate"
          >
            {{ formatBytes(stats.process.rss) }}
          </div>
          <div class="space-y-2 relative z-10">
            <div
              v-for="item in processMemItems(stats.process)"
              :key="item.label"
              class="flex items-center gap-2 group/prop"
            >
              <span class="text-xs text-gray-400 w-16 shrink-0 truncate">{{
                item.label
              }}</span>
              <div
                class="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden"
              >
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :style="{
                    width: item.pct + '%',
                    backgroundColor: item.color,
                  }"
                />
              </div>
              <span
                class="text-[11px] font-medium text-gray-600 dark:text-gray-300 w-14 text-right shrink-0 transition-colors group-hover/prop:text-gray-900 dark:group-hover/prop:text-gray-100"
                >{{ formatBytes(item.value) }}</span
              >
            </div>
          </div>
        </div>

        <!-- 磁盘使用 -->
        <div
          class="relative overflow-hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-xl p-4 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-gray-900/40 transition-all duration-300 group hover:border-primary/40 dark:hover:border-primary/30"
        >
          <div
            class="absolute -right-3 -bottom-3 opacity-[0.03] dark:opacity-5 group-hover:opacity-10 transition-all duration-500 pointer-events-none transform group-hover:scale-110 group-hover:-rotate-12"
          >
            <HardDrive class="w-24 h-24 text-primary" />
          </div>
          <div class="flex items-center gap-2 mb-3 relative z-10">
            <div
              class="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
            >
              <HardDrive class="w-5 h-5 text-primary" />
            </div>
            <div class="text-sm font-medium text-gray-600 dark:text-gray-300">
              {{ $t('osMonitor.disk') }}
            </div>
          </div>
          <div
            class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-all duration-300 group-hover:text-primary relative z-10 truncate"
          >
            {{ stats.disk.usagePercent
            }}<span
              class="text-base font-normal text-gray-400 group-hover:text-primary/50 dark:group-hover:text-primary/50 ml-0.5"
              >%</span
            >
          </div>
          <a-progress
            :percent="stats.disk.usagePercent"
            :stroke-color="diskColor(stats.disk.usagePercent)"
            :show-info="false"
            size="small"
            class="relative z-10"
          />
          <div class="text-xs text-gray-400 mt-2 truncate relative z-10">
            {{ formatBytes(stats.disk.used) }} /
            {{ formatBytes(stats.disk.total) }}
          </div>
        </div>

        <!-- 运行时间 -->
        <div
          class="relative overflow-hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-xl p-4 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-gray-900/40 transition-all duration-300 group hover:border-primary/40 dark:hover:border-primary/30"
        >
          <div
            class="absolute -right-3 -bottom-3 opacity-[0.03] dark:opacity-5 group-hover:opacity-10 transition-all duration-500 pointer-events-none transform group-hover:scale-110 group-hover:-rotate-12"
          >
            <Clock class="w-24 h-24 text-primary" />
          </div>
          <div class="flex items-center gap-2 mb-3 relative z-10">
            <div
              class="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
            >
              <Clock class="w-5 h-5 text-primary" />
            </div>
            <div class="text-sm font-medium text-gray-600 dark:text-gray-300">
              {{ $t('osMonitor.uptime') }}
            </div>
          </div>
          <div
            class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-all duration-300 group-hover:text-primary relative z-10 truncate"
          >
            {{ formatUptime(stats.uptime) }}
          </div>
          <div
            class="text-xs font-medium px-2.5 py-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg inline-block text-gray-500 dark:text-gray-400 mt-3 truncate relative z-10"
          >
            {{ stats.platform }} • {{ stats.arch }}
          </div>
        </div>
      </div>

      <!-- 实时运行曲线 -->
      <div
        class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-xl p-5"
      >
        <div
          class="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4"
        >
          {{ $t('osMonitor.realtimeChart') }}
        </div>
        <div v-if="chartOption" class="w-full">
          <VChart
            :option="chartOption"
            style="height: 240px; width: 100%"
            autoresize
          />
        </div>
        <div
          v-else
          class="flex flex-col items-center justify-center h-48 text-gray-400 gap-3"
        >
          <Loader2 class="w-6 h-6 animate-spin text-primary" />
          <span class="text-xs font-medium">{{
            $t('osMonitor.collecting')
          }}</span>
        </div>
      </div>
    </template>

    <div v-else-if="!loading" class="text-center py-12 text-gray-400">
      {{ $t('osMonitor.loadFailed') }}
    </div>
  </div>
</template>
