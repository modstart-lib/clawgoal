<template>
  <div>
    <ListerTop :loading="loading" :total="pagination.total" @refresh="load">
      <template #actions>
        <a-button @click="openApiDoc">
          <div class="inline-flex items-center gap-1">
            <BookOpen class="w-4 h-4" aria-hidden="true" />
            {{ t('setting.apiTokenDocs') }}
          </div>
        </a-button>
        <a-button type="primary" @click="openAdd">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ t('setting.apiTokenAdd') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <div
      class="rounded-xl border border-gray-100/80 dark:border-gray-700/50 bg-surface/50 dark:bg-panel/30 backdrop-blur-md overflow-hidden"
    >
      <a-table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: handlePageChange,
          showTotal: showPaginationTotal,
        }"
        :scroll="{ x: 'max-content' }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'token'">
            <div class="flex items-center gap-2">
              <span
                class="font-mono text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs"
              >
                {{ record.token }}
              </span>
              <a-button
                class="inline-flex items-center"
                @click="copyToken(record.token)"
              >
                <Copy class="w-4 h-4" aria-hidden="true" />
              </a-button>
            </div>
          </template>
          <template v-else-if="column.key === 'permissions'">
            <div class="flex flex-wrap gap-1">
              <a-tag
                v-for="perm in record.permissions.split(',').filter(Boolean)"
                :key="perm"
                >{{ perm }}</a-tag
              >
              <span v-if="!record.permissions" class="text-gray-400 text-xs"
                >—</span
              >
            </div>
          </template>
          <template v-else-if="column.key === 'expire'">
            <span
              :class="
                isExpired(record.expire)
                  ? 'text-error'
                  : 'text-gray-600 dark:text-gray-400'
              "
            >
              <DatetimeViewer :value="record.expire" />
            </span>
          </template>
          <template v-else-if="column.key === 'lastUseTime'">
            <span class="text-gray-500 dark:text-gray-400 text-xs">
              <DatetimeViewer :value="record.lastUseTime" fallback="—" />
            </span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button @click="openEdit(record)">
                <div class="inline-flex items-center gap-1">
                  <Pencil class="w-4 h-4" aria-hidden="true" />
                  {{ t('common.edit') }}
                </div>
              </a-button>
              <a-button @click="handleRegenerate(record)">
                <div class="inline-flex items-center gap-1">
                  <RefreshCw class="w-4 h-4" aria-hidden="true" />
                  {{ t('setting.apiTokenRegenerate') }}
                </div>
              </a-button>
              <a-popconfirm
                :title="t('setting.apiTokenDeleteConfirm')"
                @confirm="handleDelete(record.id)"
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
      </a-table>
    </div>

    <SettingApiTokenModal
      v-model:open="modalVisible"
      :record="editingRecord"
      @saved="load"
    />
  </div>
</template>

<script setup lang="ts">
import ListerTop from '@/components/ListerTop.vue'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Copy from '~icons/lucide/copy'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import RefreshCw from '~icons/lucide/refresh-cw'
import Trash2 from '~icons/lucide/trash-2'
import BookOpen from '~icons/lucide/book-open'
import {
  deleteApiToken,
  paginateApiTokens,
  regenerateApiToken,
  type ApiTokenRecord,
} from '../../api/apiToken'
import { copyText, openUrl } from '../../utils/utils'
import SettingApiTokenModal from './SettingApiToken/SettingApiTokenModal.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const loading = ref(false)
const records = ref<ApiTokenRecord[]>([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const { t } = useI18n()

function showPaginationTotal(total: number) {
  return t('common.total', { total })
}

const modalVisible = ref(false)
const editingRecord = ref<ApiTokenRecord | null>(null)

const columns = computed(() => [
  {
    title: t('setting.apiTokenColTitle'),
    dataIndex: 'title',
    key: 'title',
    ellipsis: true,
  },
  { title: 'Token', key: 'token', ellipsis: true },
  {
    title: t('setting.apiTokenColUserId'),
    dataIndex: 'userId',
    key: 'userId',
    width: 100,
  },
  { title: t('setting.apiTokenColPermissions'), key: 'permissions' },
  { title: t('setting.apiTokenColExpire'), key: 'expire', width: 180 },
  { title: t('setting.apiTokenColLastUsed'), key: 'lastUseTime', width: 180 },
  { title: t('setting.apiTokenColActions'), key: 'action', width: 220 },
])

async function load() {
  loading.value = true
  try {
    const result = await paginateApiTokens(pagination.page, pagination.pageSize)
    records.value = result.records
    pagination.total = result.total
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number, pageSize: number) {
  pagination.page = page
  pagination.pageSize = pageSize
  load()
}

function openAdd() {
  editingRecord.value = null
  modalVisible.value = true
}

function openEdit(record: ApiTokenRecord) {
  editingRecord.value = record
  modalVisible.value = true
}

async function handleDelete(id: number) {
  await deleteApiToken(id)
  message.success(t('setting.apiTokenDeleteSuccess'))
  load()
}

async function handleRegenerate(record: ApiTokenRecord) {
  await regenerateApiToken(record.id)
  message.success(t('setting.apiTokenResetDone'))
  load()
}

async function copyToken(token: string) {
  await copyText(token, false)
  message.success(t('setting.apiTokenCopied'))
}

function openApiDoc() {
  openUrl('/api/apiDoc')
}

function isExpired(dateStr: string) {
  return new Date(dateStr) < new Date()
}

onMounted(() => {
  load()
})

onMounted(() => {
  testActionSet('setting.apiToken.add', () => openAdd())
  testActionSet('list.refresh', () => load())
})
onUnmounted(() => {
  testActionUnset('setting.apiToken.add')
  testActionUnset('list.refresh')
})
</script>
