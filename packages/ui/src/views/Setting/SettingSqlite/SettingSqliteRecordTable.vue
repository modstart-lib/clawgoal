<script setup lang="ts">
import type { DbColumn } from '@/api/sqlite'
import ListerTop from '@/components/ListerTop.vue'
import { copyText } from '@/utils/utils'
import Edit2 from '~icons/lucide/edit-2'
import Trash2 from '~icons/lucide/trash-2'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  tableName: string
  schema: DbColumn[]
  rows: Record<string, any>[]
  loading: boolean
  total: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  edit: [row: Record<string, any>]
  delete: [row: Record<string, any>]
  refresh: []
}>()

const pkColumn = computed(
  () =>
    props.schema.find((c) => c.pk === 1)?.name ?? props.schema[0]?.name ?? 'id'
)

const tableScroll = computed(() => ({
  x: 'max-content',
  y: 'calc(100dvh - 280px)',
}))

const columns = computed(() => {
  if (!props.schema.length) return []
  return [
    ...props.schema.map((col) => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      ellipsis: true,
      width: Math.max(col.name.length * 14 + 48, 120),
    })),
    { title: t('common.actions'), key: '_actions', width: 200 },
  ]
})

function isBlob(val: any): boolean {
  return val != null && typeof val === 'object' && val.__type === 'blob'
}

function blobDecode(val: {
  __type: 'blob'
  base64: string
  len: number
}): string {
  const len = val.len
  if (len === 0) return '[BLOB 0B]'
  if (len % 4 === 0) {
    const binary = atob(val.base64)
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    const floats = new Float32Array(bytes.buffer)
    const dims = floats.length
    const preview = Array.from(floats.slice(0, 4))
      .map((f) => f.toFixed(4))
      .join(', ')
    return `[Float32×${dims}: ${preview}…]`
  }
  return `[BLOB ${len}B]`
}

function blobFull(val: {
  __type: 'blob'
  base64: string
  len: number
}): string {
  const len = val.len
  if (len % 4 === 0 && len > 0) {
    const binary = atob(val.base64)
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    const floats = new Float32Array(bytes.buffer)
    return `Float32×${floats.length}\n[${Array.from(floats)
      .map((f) => f.toFixed(6))
      .join(', ')}]`
  }
  return `BLOB ${len} bytes`
}

function cellDisplay(val: any): string {
  if (val == null) return 'NULL'
  if (isBlob(val)) return blobDecode(val)
  const s = String(val)
  if (isJsonString(s)) {
    return s.length > 40 ? s.slice(0, 40) + '…' : s
  }
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

function cellTooltip(val: any): string {
  if (val == null) return 'NULL'
  if (isBlob(val)) return blobFull(val)
  return String(val)
}

function isJsonString(s: string): boolean {
  const t = s.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

const jsonPreviewVisible = ref(false)
const jsonPreviewContent = ref('')

const copiedCol = ref('')
function copyColName(name: string) {
  copyText(name, false)
  copiedCol.value = name
  setTimeout(() => {
    copiedCol.value = ''
  }, 1500)
}

function openJsonPreview(val: any) {
  const s = String(val)
  try {
    jsonPreviewContent.value = JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    jsonPreviewContent.value = s
  }
  jsonPreviewVisible.value = true
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <ListerTop :loading="loading" :total="total" @refresh="emit('refresh')">
      <span class="font-semibold">{{ tableName }}</span>
      <span class="text-gray-400 ml-2">{{
        $t('settingSqlite.totalRecords', { total })
      }}</span>
    </ListerTop>

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      :scroll="tableScroll"
      :row-key="(row: Record<string, any>) => row[pkColumn]"
      class="db-record-table"
    >
      <template #headerCell="{ title, column }">
        <a-tooltip
          v-if="column.key !== '_actions'"
          :title="
            copiedCol === String(title) ? t('common.copied') : String(title)
          "
          placement="topLeft"
          :mouse-enter-delay="0.3"
        >
          <span
            class="header-cell-text cursor-pointer select-none"
            @click.stop="copyColName(String(title))"
            >{{ title }}</span
          >
        </a-tooltip>
        <template v-else>{{ title }}</template>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === '_actions'">
          <div class="flex gap-2 flex-wrap">
            <a-button type="default" @click="emit('edit', record)">
              <div class="inline-flex items-center gap-1">
                <Edit2 class="w-4 h-4" aria-hidden="true" />
                {{ $t('common.edit') }}
              </div>
            </a-button>
            <a-popconfirm
              :title="$t('settingSqlite.confirmDeleteRecord')"
              :ok-text="$t('common.delete')"
              :cancel-text="$t('common.cancel')"
              @confirm="emit('delete', record)"
            >
              <a-button type="primary" danger>
                <div class="inline-flex items-center gap-1">
                  <Trash2 class="w-4 h-4" aria-hidden="true" />
                  {{ $t('common.delete') }}
                </div>
              </a-button>
            </a-popconfirm>
          </div>
        </template>
        <template v-else>
          <template
            v-if="
              record[column.dataIndex] != null &&
              typeof record[column.dataIndex] === 'string' &&
              isJsonString(record[column.dataIndex])
            "
          >
            <span
              class="inline-flex items-center gap-1 cursor-pointer group"
              @click="openJsonPreview(record[column.dataIndex])"
            >
              <span
                class="text-xs px-1 py-0.5 rounded bg-primary-50 text-primary-500 dark:bg-primary-900/30 dark:text-primary-400 font-mono shrink-0"
                >JSON</span
              >
              <span
                class="text-sm text-gray-500 truncate group-hover:text-primary-500 transition-colors"
                >{{ cellDisplay(record[column.dataIndex]) }}</span
              >
            </span>
          </template>
          <template v-else>
            <a-tooltip
              :title="cellTooltip(record[column.dataIndex])"
              placement="topLeft"
            >
              <span
                class="text-sm"
                :class="
                  record[column.dataIndex] == null ? 'text-gray-300 italic' : ''
                "
              >
                {{ cellDisplay(record[column.dataIndex]) }}
              </span>
            </a-tooltip>
          </template>
        </template>
      </template>
    </a-table>

    <div class="flex justify-end mt-2">
      <a-pagination
        :current="page"
        :total="total"
        :page-size="pageSize"
        show-quick-jumper
        :show-total="
          (n: number) => $t('settingSqlite.totalRecordsShort', { total: n })
        "
        @change="emit('update:page', $event)"
      />
    </div>

    <a-modal
      v-model:open="jsonPreviewVisible"
      :keyboard="false"
      :mask-closable="false"
      :title="$t('settingSqlite.jsonPreview')"
      :footer="null"
      width="95vw"
    >
      <div class="overflow-auto max-h-[60vh]">
        <pre
          class="text-xs font-mono bg-gray-50 dark:bg-gray-800 rounded p-3 whitespace-pre-wrap break-all leading-5"
          >{{ jsonPreviewContent }}</pre
        >
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.db-record-table :deep(.ant-table-cell) {
  font-size: 13px;
}
.db-record-table :deep(.ant-table-thead > tr > th) {
  height: 48px;
  overflow: hidden;
  white-space: nowrap;
}
.header-cell-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}
</style>
