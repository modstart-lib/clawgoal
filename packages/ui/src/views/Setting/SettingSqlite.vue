<script setup lang="ts">
import {
  deleteRow,
  getTableRows,
  getTableSchema,
  listDatabases,
  listTables,
  updateRow,
  type DbColumn,
  type DbFile,
  type DbRowsResult,
  type DbTable,
} from '@/api/sqlite.ts'
import { message } from 'ant-design-vue'
import Database from '~icons/lucide/database'
import Table2 from '~icons/lucide/table-2'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingSqliteDbList from './SettingSqlite/SettingSqliteDbList.vue'
import SettingSqliteEditModal from './SettingSqlite/SettingSqliteEditModal.vue'
import SettingSqliteExecuteModal from './SettingSqlite/SettingSqliteExecuteModal.vue'
import SettingSqliteRecordTable from './SettingSqlite/SettingSqliteRecordTable.vue'
import SettingSqliteTableList from './SettingSqlite/SettingSqliteTableList.vue'

const { t } = useI18n()

const dbList = ref<DbFile[]>([])
const dbLoading = ref(false)

const selectedDb = ref<DbFile | null>(null)
const tables = ref<DbTable[]>([])
const tablesLoading = ref(false)

const selectedTable = ref<string>('')
const schema = ref<DbColumn[]>([])
const rowsResult = ref<DbRowsResult | null>(null)
const rowsLoading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

const editVisible = ref(false)
const editRow = ref<Record<string, any>>({})
const editSaving = ref(false)

const executeVisible = ref(false)

const pkColumn = computed(
  () =>
    schema.value.find((c) => c.pk === 1)?.name ?? schema.value[0]?.name ?? 'id'
)
const rows = computed(() => rowsResult.value?.rows ?? [])
const total = computed(() => rowsResult.value?.total ?? 0)

async function loadDbs() {
  dbLoading.value = true
  try {
    dbList.value = await listDatabases()
    if (dbList.value.length && !selectedDb.value) {
      await selectDb(dbList.value[0])
    } else if (selectedDb.value) {
      await loadTables()
    }
  } catch (e: any) {
    message.error(e?.message || t('settingSqlite.loadDbFailed'))
  } finally {
    dbLoading.value = false
  }
}

async function selectDb(db: DbFile) {
  selectedDb.value = db
  selectedTable.value = ''
  schema.value = []
  rowsResult.value = null
  await loadTables()
}

async function loadTables() {
  if (!selectedDb.value) return
  tablesLoading.value = true
  try {
    tables.value = await listTables(selectedDb.value.path)
    if (tables.value.length) {
      await selectTable(tables.value[0].name)
    }
  } catch (e: any) {
    message.error(e?.message || t('settingSqlite.loadTableFailed'))
  } finally {
    tablesLoading.value = false
  }
}

async function selectTable(tableName: string) {
  if (!selectedDb.value) return
  selectedTable.value = tableName
  currentPage.value = 1
  rowsResult.value = null
  schema.value = []
  try {
    schema.value = await getTableSchema(selectedDb.value.path, tableName)
  } catch {}
  await loadRows()
}

async function loadRows() {
  if (!selectedDb.value || !selectedTable.value) return
  rowsLoading.value = true
  try {
    rowsResult.value = await getTableRows(
      selectedDb.value.path,
      selectedTable.value,
      currentPage.value,
      pageSize.value
    )
  } catch (e: any) {
    message.error(e?.message || t('settingSqlite.loadDataFailed'))
  } finally {
    rowsLoading.value = false
  }
}

watch(currentPage, loadRows)
onMounted(loadDbs)

function openEdit(row: Record<string, any>) {
  editRow.value = { ...row }
  editVisible.value = true
}

async function saveEdit() {
  if (!selectedDb.value || !selectedTable.value) return
  editSaving.value = true
  try {
    const pk = pkColumn.value
    const pkVal = editRow.value[pk]
    await updateRow(
      selectedDb.value.path,
      selectedTable.value,
      pk,
      pkVal,
      editRow.value
    )
    message.success(t('settingSqlite.saveSuccess'))
    editVisible.value = false
    await loadRows()
  } catch (e: any) {
    message.error(e?.message || t('settingSqlite.saveFailed'))
  } finally {
    editSaving.value = false
  }
}

async function doDeleteRow(row: Record<string, any>) {
  if (!selectedDb.value || !selectedTable.value) return
  try {
    const pk = pkColumn.value
    await deleteRow(selectedDb.value.path, selectedTable.value, pk, row[pk])
    message.success(t('settingSqlite.deleted'))
    await loadRows()
  } catch (e: any) {
    message.error(e?.message || t('settingSqlite.deleteFailed'))
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 min-h-125">
    <div class="flex items-center gap-2">
      <SettingSqliteDbList
        :db-list="dbList"
        :loading="dbLoading"
        :selected-path="selectedDb?.path ?? ''"
        @select="selectDb"
        @refresh="loadDbs"
      />
    </div>

    <div class="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
      <div class="w-full md:w-64 md:shrink-0 flex flex-col">
        <SettingSqliteTableList
          v-if="selectedDb"
          :tables="tables"
          :loading="tablesLoading"
          :selected-table="selectedTable"
          @select="selectTable"
          @refresh="loadTables"
          @execute-sql="executeVisible = true"
        />
        <div
          v-else
          class="flex-1 flex items-center justify-center text-gray-400 border border-gray-100 dark:border-gray-700 rounded-lg"
        >
          <div class="text-center px-3">
            <Database class="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p class="text-xs">{{ $t('settingSqlite.selectDb') }}</p>
          </div>
        </div>
      </div>

      <div class="flex-1 min-w-0 flex flex-col">
        <div
          v-if="!selectedDb"
          class="flex-1 flex items-center justify-center text-gray-400"
        >
          <div class="text-center">
            <Database class="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p class="text-sm">{{ $t('settingSqlite.selectDb') }}</p>
          </div>
        </div>
        <div
          v-else-if="!selectedTable"
          class="flex-1 flex items-center justify-center text-gray-400"
        >
          <div class="text-center">
            <Table2 class="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p class="text-sm">{{ $t('settingSqlite.selectTable') }}</p>
          </div>
        </div>
        <SettingSqliteRecordTable
          v-else
          :table-name="selectedTable"
          :schema="schema"
          :rows="rows"
          :loading="rowsLoading"
          :total="total"
          :page="currentPage"
          :page-size="pageSize"
          @update:page="currentPage = $event"
          @edit="openEdit"
          @delete="doDeleteRow"
          @refresh="loadRows"
        />
      </div>
    </div>
  </div>

  <SettingSqliteEditModal
    v-model:open="editVisible"
    :row="editRow"
    :schema="schema"
    :saving="editSaving"
    @update:row="editRow = $event"
    @save="saveEdit"
  />

  <SettingSqliteExecuteModal
    v-model:open="executeVisible"
    :db-path="selectedDb?.path ?? ''"
    :tables="tables"
    :selected-table="selectedTable"
    :schema="schema"
  />
</template>
