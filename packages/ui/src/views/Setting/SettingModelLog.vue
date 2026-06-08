<script setup lang="ts">
import {
  getModelLogBizValues,
  getModelLogs,
  type ModelLogRecord,
} from '@/api/modelLog'
import ListerTop from '@/components/ListerTop.vue'
import { systemWs } from '@/utils/system'
import { message } from 'ant-design-vue'
import { type Dayjs } from 'dayjs'
import { Search } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingModelLogCard from './SettingModelLog/SettingModelLogCard.vue'

const { t } = useI18n()

const bizOptions = ref<string[]>([])
const filterBiz = ref<string>('')
const filterBizId = ref('')
const filterTime = ref<[Dayjs, Dayjs] | null>(null)

const loading = ref(false)
const records = ref<ModelLogRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

async function load() {
  loading.value = true
  try {
    let startAt = undefined
    let endAt = undefined
    if (filterTime.value && filterTime.value.length === 2) {
      startAt = filterTime.value[0].format('YYYY-MM-DD HH:mm:ss')
      endAt = filterTime.value[1].format('YYYY-MM-DD HH:mm:ss')
    }
    const res = await getModelLogs({
      page: page.value,
      pageSize: pageSize.value,
      biz: filterBiz.value || undefined,
      bizId: filterBizId.value || undefined,
      startAt,
      endAt,
    })
    records.value = res.records
    total.value = res.total
  } catch {
    message.error(t('settingModelLog.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function loadBizOptions() {
  try {
    bizOptions.value = await getModelLogBizValues()
  } catch {
    // ignore
  }
}

function onSearch() {
  page.value = 1
  load()
}

function onPageChange(p: number, ps: number) {
  page.value = p
  pageSize.value = ps
  load()
}

// WebSocket 自动刷新：新日志创建时，若在第一页则刷新
const modelLogHandler = () => {
  if (page.value === 1) {
    load()
  }
}

onMounted(() => {
  loadBizOptions()
  load()
  systemWs.onThrottle('system:modelLog:created', modelLogHandler, 2000)
})

onUnmounted(() => {
  systemWs.offThrottle('system:modelLog:created', modelLogHandler)
})
</script>

<template>
  <div>
    <!-- 筛选栏 -->
    <ListerTop :loading="loading" :total="total" @refresh="onSearch">
      <a-select
        v-model:value="filterBiz"
        :placeholder="$t('settingModelLog.allBiz')"
        allow-clear
        class="w-full md:w-40"
      >
        <a-select-option value="">{{
          $t('settingModelLog.all')
        }}</a-select-option>
        <a-select-option v-for="biz in bizOptions" :key="biz" :value="biz">{{
          biz
        }}</a-select-option>
      </a-select>
      <a-input
        v-model:value="filterBizId"
        placeholder="BizId"
        allow-clear
        class="w-full md:w-48"
        @press-enter="onSearch"
      />
      <a-range-picker
        v-model:value="filterTime"
        show-time
        format="YYYY-MM-DD HH:mm:ss"
        class="w-full md:w-auto"
      />
      <a-button type="primary" @click="onSearch">
        <div class="inline-flex items-center gap-1">
          <Search class="w-4 h-4" aria-hidden="true" />
          {{ $t('settingModelLog.search') }}
        </div>
      </a-button>
    </ListerTop>

    <!-- 卡片列表 -->
    <a-spin :spinning="loading">
      <div class="flex flex-col gap-4">
        <SettingModelLogCard
          v-for="record in records"
          :key="record.id"
          :record="record"
        />
      </div>

      <!-- 分页 -->
      <div
        v-if="total > 0"
        class="mt-6 flex justify-end bg-white p-3 rounded-lg border border-gray-100"
      >
        <a-pagination
          v-model:current="page"
          v-model:page-size="pageSize"
          :total="total"
          :show-size-changer="true"
          :show-total="
            (total: number) => $t('settingModelLog.total', { total })
          "
          @change="onPageChange"
        />
      </div>
      <div v-else-if="!loading" class="text-center py-10 text-gray-400">
        {{ $t('settingModelLog.noData') }}
      </div>
    </a-spin>
  </div>
</template>
