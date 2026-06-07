<script setup lang="ts">
import { noticeLogPaginate, type NoticeLogItem } from '@/api/notice.ts'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import ListerTop from '@/components/ListerTop.vue'
import { type Dayjs } from 'dayjs'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
}>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const loading = ref(false)
const records = ref<NoticeLogItem[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const timeRange = ref<[Dayjs, Dayjs] | null>(null)

const columns = computed(() => [
  {
    title: t('settingNotice.logColumnTime'),
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
  },
  {
    title: t('settingNotice.logColumnTitle'),
    dataIndex: 'title',
    key: 'title',
  },
  {
    title: t('settingNotice.logColumnContent'),
    dataIndex: 'content',
    key: 'content',
    ellipsis: true,
  },
  { title: t('settingNotice.logColumnStatus'), key: 'status', width: 90 },
])

watch(
  () => props.open,
  (val) => {
    if (val) {
      page.value = 1
      load()
    }
  }
)

async function load() {
  loading.value = true
  try {
    const result = await noticeLogPaginate({
      page: page.value,
      pageSize: pageSize.value,
      startTime: timeRange.value?.[0]?.format('YYYY-MM-DD HH:mm:ss'),
      endTime: timeRange.value?.[1]?.format('YYYY-MM-DD HH:mm:ss'),
    })
    records.value = result.records
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) {
  page.value = p
  load()
}
function handleFilterSearch() {
  page.value = 1
  load()
}
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('settingNotice.logTitle')"
    :footer="null"
    width="95vw"
    @cancel="emit('update:open', false)"
  >
    <ListerTop :loading="loading" :total="total" @refresh="load">
      <a-range-picker
        v-model:value="timeRange"
        show-time
        format="YYYY-MM-DD HH:mm:ss"
        @change="handleFilterSearch"
      />
    </ListerTop>

    <a-table
      :data-source="records"
      :columns="columns"
      :loading="loading"
      row-key="id"
      :pagination="{
        current: page,
        pageSize,
        total,
        onChange: handlePageChange,
        showTotal: (total: number) => t('settingNotice.logTotal', { total }),
      }"
      :scroll="{ x: 'max-content' }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'success' ? 'green' : 'red'">
            {{
              record.status === 'success'
                ? $t('settingNotice.logStatusSuccess')
                : $t('settingNotice.logStatusFail')
            }}
          </a-tag>
        </template>
        <template v-if="column.key === 'createdAt'">
          <DatetimeViewer :value="record.createdAt" />
        </template>
      </template>
    </a-table>
  </a-modal>
</template>
