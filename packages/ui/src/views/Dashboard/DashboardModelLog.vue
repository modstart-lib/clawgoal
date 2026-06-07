<template>
  <div>
    <!-- 工具栏 -->
    <ListerTop :loading="loading" @refresh="loadStats">
      <a-range-picker
        v-model:value="monitorDateRange"
        show-time
        format="YYYY-MM-DD HH:mm"
        :placeholder="[
          $t('config.dashboardStartTime'),
          $t('config.dashboardEndTime'),
        ]"
        class="w-full md:w-80"
        @change="onDateRangeChange"
      />
      <a-select
        v-model:value="quickRange"
        class="w-full md:w-32"
        :placeholder="$t('config.dashboardQuickSelect')"
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
      <template #actions>
        <a-button type="default" @click="globalVisible = true">
          <div class="inline-flex items-center gap-1">
            <BarChart2 class="w-3 h-3" aria-hidden="true" />
            {{ $t('config.dashboardGlobalOverview') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <!-- 汇总统计 -->
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 flex items-center gap-4"
      >
        <div
          class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0"
        >
          <BarChart2 class="w-4 h-4 text-gray-500" />
        </div>
        <div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
            {{ $t('config.dashboardTotalCalls') }}
          </div>
          <div
            class="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none"
          >
            {{ monitorTotals.calls.toLocaleString() }}
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 flex items-center gap-4"
      >
        <div
          class="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0"
        >
          <TrendingUp class="w-4 h-4 text-primary-500" />
        </div>
        <div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
            {{ $t('config.dashboardTotalTokens') }}
          </div>
          <div
            class="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none"
          >
            {{
              formatTokens(
                monitorTotals.inputTokens + monitorTotals.outputTokens
              )
            }}
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-primary-500">{{
              $t('config.dashboardInputTokens', {
                n: formatTokens(monitorTotals.inputTokens),
              })
            }}</span>
            <span class="text-gray-300 dark:text-gray-600 text-xs">·</span>
            <span class="text-xs text-green-500">{{
              $t('config.dashboardOutputTokens', {
                n: formatTokens(monitorTotals.outputTokens),
              })
            }}</span>
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 flex items-center gap-4"
      >
        <div
          class="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0"
        >
          <Play class="w-4 h-4 text-primary-500" />
        </div>
        <div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
            {{ $t('config.dashboardModelCount') }}
          </div>
          <div
            class="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none"
          >
            {{ modelStats.length }}
          </div>
        </div>
      </div>
    </div>

    <!-- 模型卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="model in modelStats"
        :key="model.id"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              :class="getProviderColor(model.provider)"
            >
              {{ model.provider.charAt(0) }}
            </div>
            <div class="min-w-0">
              <div
                class="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate"
              >
                {{ model.name }}
              </div>
              <div class="text-xs text-gray-400 dark:text-gray-500 truncate">
                {{ model.modelId }}
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-400">{{
              $t('config.dashboardCallCount')
            }}</span>
            <span class="font-semibold text-gray-900 dark:text-gray-100">{{
              model.calls.toLocaleString()
            }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-400">{{
              $t('config.dashboardInputToken')
            }}</span>
            <span
              class="font-semibold text-primary-600 dark:text-primary-400"
              >{{ formatTokens(model.inputTokens) }}</span
            >
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-400">{{
              $t('config.dashboardOutputToken')
            }}</span>
            <span class="font-semibold text-green-600 dark:text-green-400">{{
              formatTokens(model.outputTokens)
            }}</span>
          </div>
        </div>

        <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-1 mb-3">
            <div
              class="h-1.5 rounded-full bg-primary-400 transition-all"
              :style="`width: ${((model.inputTokens / maxTokens) * 80).toFixed(1)}%`"
            ></div>
            <div
              class="h-1.5 rounded-full bg-green-400 transition-all"
              :style="`width: ${((model.outputTokens / maxTokens) * 80).toFixed(1)}%`"
            ></div>
          </div>
          <a-button type="default" class="w-full" @click="openDetail(model)">
            <div class="inline-flex items-center gap-1">
              <TrendingUp class="w-3 h-3" aria-hidden="true" />
              {{ $t('config.dashboardViewDetail') }}
            </div>
          </a-button>
        </div>
      </div>
    </div>

    <div
      v-if="!modelStats.length && !loading"
      class="text-center py-12 text-gray-400 dark:text-gray-500"
    >
      {{ $t('config.dashboardNoData') }}
    </div>

    <DashboardModelLogDetailModal
      v-model:open="detailVisible"
      :model="selectedModel"
    />
    <DashboardModelLogGlobalModal
      v-model:open="globalVisible"
      :model-stats="modelStats"
    />
  </div>
</template>

<script setup lang="ts">
import ListerTop from '@/components/ListerTop.vue'
import type { ModelStat } from '@/api/modelLog'
import { getModelStats } from '@/api/modelLog'
import dayjs, { type Dayjs } from 'dayjs'
import BarChart2 from '~icons/lucide/bar-chart-2'
import Play from '~icons/lucide/play'
import TrendingUp from '~icons/lucide/trending-up'
import { computed, onMounted, ref } from 'vue'
import DashboardModelLogDetailModal from './DashboardModelLog/DashboardModelLogDetailModal.vue'
import DashboardModelLogGlobalModal from './DashboardModelLog/DashboardModelLogGlobalModal.vue'

const monitorDateRange = ref<[Dayjs, Dayjs] | null>(null)
const quickRange = ref('today')
const loading = ref(false)

const currentDateRange = computed(() => {
  if (monitorDateRange.value) {
    return {
      startAt: monitorDateRange.value[0].format('YYYY-MM-DD HH:mm:ss'),
      endAt: monitorDateRange.value[1].format('YYYY-MM-DD HH:mm:ss'),
    }
  }
  return {
    startAt: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
    endAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }
})

const modelStats = ref<ModelStat[]>([])

const loadStats = async () => {
  loading.value = true
  try {
    const { startAt, endAt } = currentDateRange.value
    const records = await getModelStats(startAt, endAt)
    modelStats.value = records.map((r, i) => ({
      id: `${r.provider || ''}|${r.model}|${i}`,
      name: r.model,
      provider: r.provider || 'Unknown',
      modelId: r.model,
      calls: r.callCount,
      inputTokens: r.totalPromptTokens,
      outputTokens: r.totalCompletionTokens,
    }))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  monitorDateRange.value = [dayjs().subtract(7, 'day').startOf('day'), dayjs()]
  quickRange.value = '7d'
  loadStats()
})

const maxTokens = computed(() => {
  if (!modelStats.value.length) return 1
  return Math.max(
    ...modelStats.value.map((m) => m.inputTokens + m.outputTokens)
  )
})

const monitorTotals = computed(() => ({
  calls: modelStats.value.reduce((s, m) => s + m.calls, 0),
  inputTokens: modelStats.value.reduce((s, m) => s + m.inputTokens, 0),
  outputTokens: modelStats.value.reduce((s, m) => s + m.outputTokens, 0),
}))

const onQuickRangeChange = (val: string) => {
  const days = val === 'today' ? 0 : val === '7d' ? 7 : val === '30d' ? 30 : 365
  const start =
    days === 0 ? dayjs().startOf('day') : dayjs().subtract(days, 'day')
  monitorDateRange.value = [start, dayjs()]
  loadStats()
}

const onDateRangeChange = () => {
  quickRange.value = ''
  loadStats()
}

const formatTokens = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

const getProviderColor = (provider: string) => {
  switch (provider) {
    case 'OpenAI':
      return 'bg-green-600'
    case 'Anthropic':
      return 'bg-orange-600'
    case 'Google':
      return 'bg-primary-600'
    case 'DeepSeek':
      return 'bg-primary-800'
    case 'Azure':
      return 'bg-primary-500'
    case 'Local':
      return 'bg-gray-600'
    default:
      return 'bg-gray-700'
  }
}

const detailVisible = ref(false)
const selectedModel = ref<ModelStat | null>(null)
const globalVisible = ref(false)

const openDetail = (model: ModelStat) => {
  selectedModel.value = model
  detailVisible.value = true
}
</script>
