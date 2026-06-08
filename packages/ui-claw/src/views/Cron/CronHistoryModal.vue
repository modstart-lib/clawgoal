<script setup lang="ts">
import {
  deleteCronHistory,
  paginateCronHistory,
  type CronHistoryLog,
} from '@/claw/api/cron'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import InlineLogViewer from '@/components/InlineLogViewer.vue'
import ListerTop from '@/components/ListerTop.vue'
import { message, Modal } from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import CircleCheck from '~icons/lucide/circle-check'
import Trash2 from '~icons/lucide/trash-2'
import XCircle from '~icons/lucide/x-circle'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  /** 传入 agentId 时只展示该 agent 的历史；不传则展示全部 */
  agentId?: string
  title?: string
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
}>()

const logs = ref<CronHistoryLog[]>([])
const loading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const dateRange = ref<[Dayjs, Dayjs] | null>(null)

async function loadHistory(showToast = false) {
  loading.value = true
  try {
    const startDate = dateRange.value
      ? dateRange.value[0].format('YYYY-MM-DD')
      : undefined
    const endDate = dateRange.value
      ? dateRange.value[1].format('YYYY-MM-DD')
      : undefined
    const result = await paginateCronHistory({
      page: currentPage.value,
      pageSize: pageSize.value,
      agentId: props.agentId,
      startDate,
      endDate,
    })
    logs.value = result.records
    total.value = result.total
    if (showToast) message.success(t('claw.cron.dataRefreshed'))
  } catch (e: any) {
    message.error(e.message || t('claw.cron.loadFailed'))
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadHistory()
}

function handleDateRangeChange() {
  currentPage.value = 1
  loadHistory()
}

async function handleDelete(record: CronHistoryLog) {
  Modal.confirm({
    title: t('common.confirmDelete'),
    content: t('claw.cron.deleteHistoryConfirm', { name: record.taskName }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    async onOk() {
      try {
        await deleteCronHistory(record.id)
        await loadHistory()
        message.success(t('claw.cron.deleteHistorySuccess'))
      } catch (e: any) {
        message.error(e.message || t('claw.cron.deleteFailed'))
      }
    },
  })
}

const columns = [
  {
    title: t('claw.cron.colStatus'),
    key: 'status',
    width: 64,
    align: 'center' as const,
  },
  {
    title: t('claw.cron.colTaskName'),
    dataIndex: 'taskName',
    key: 'taskName',
    width: 180,
    ellipsis: true,
  },
  {
    title: t('claw.cron.colTime'),
    key: 'time',
    width: 160,
  },
  {
    title: t('claw.cron.colLog'),
    key: 'log',
    ellipsis: true,
  },
  {
    title: t('claw.cron.colActions'),
    key: 'actions',
    width: 64,
    align: 'center' as const,
  },
]

onMounted(() => {
  testActionSet('list.refresh', () => loadHistory(true))
})
onUnmounted(() => {
  testActionUnset('list.refresh')
})

watch(
  () => props.open,
  (val) => {
    if (val) {
      currentPage.value = 1
      dateRange.value = null
      loadHistory()
    }
  }
)
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="title || $t('claw.cron.historyTitle')"
    width="95vw"
    :footer="null"
    @cancel="emit('update:open', false)"
  >
    <div class="mt-2">
      <ListerTop
        :loading="loading"
        :total="total"
        @refresh="() => loadHistory(true)"
      >
        <a-range-picker
          v-model:value="dateRange"
          :allow-clear="true"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          @change="handleDateRangeChange"
        />
      </ListerTop>

      <a-table
        :data-source="logs"
        :columns="columns"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: false,
          onChange: handlePageChange,
        }"
        row-key="id"
        size="small"
        :scroll="{ x: 'max-content', y: 480 }"
      >
        <!-- 状态列 -->
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <CircleCheck
              v-if="record.success"
              class="w-4 h-4 text-green-500 mx-auto"
            />
            <XCircle v-else class="w-4 h-4 text-red-500 mx-auto" />
          </template>

          <!-- 时间列 -->
          <template v-else-if="column.key === 'time'">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              <DatetimeViewer :value="record.time" />
            </span>
          </template>

          <!-- 日志列 -->
          <template v-else-if="column.key === 'log'">
            <InlineLogViewer
              :content="record.result || record.message"
              :logs="record.logs"
              :title="`${record.taskName} · ${t('claw.cron.historyLogDetail')}`"
            />
          </template>

          <!-- 操作列 -->
          <template v-else-if="column.key === 'actions'">
            <a-button
              danger
              :title="$t('common.delete')"
              @click="handleDelete(record)"
            >
              <Trash2 class="w-4 h-4" />
            </a-button>
          </template>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div
            class="text-sm text-gray-400 dark:text-gray-500 py-12 text-center"
          >
            {{ $t('claw.cron.noHistory') }}
          </div>
        </template>
      </a-table>
    </div>
  </a-modal>
</template>
