<script setup lang="ts">
import {
  type DbColumn,
  type DbExecuteResult,
  type DbTable,
  executeSQL,
} from '@/api/sqlite'
import ModelGenerateButton from '@/components/ModelGenerateButton.vue'
import { message } from 'ant-design-vue'
import Play from '~icons/lucide/play'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  dbPath: string
  tables?: DbTable[]
  selectedTable?: string
  schema?: DbColumn[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const sql = ref('')
const running = ref(false)
const result = ref<DbExecuteResult | null>(null)
const execError = ref('')

watch(
  () => props.open,
  (val) => {
    if (val) {
      result.value = null
      execError.value = ''
    }
  }
)

async function runSQL() {
  if (!sql.value.trim()) {
    message.warning(t('settingSqlite.sqlRequired'))
    return
  }
  running.value = true
  result.value = null
  execError.value = ''
  try {
    result.value = await executeSQL(props.dbPath, sql.value.trim())
    if (result.value.rows !== null) {
      message.success(
        t('settingSqlite.sqlQuerySuccess', { count: result.value.rows.length })
      )
    } else {
      message.success(
        t('settingSqlite.sqlExecuteSuccess', {
          count: result.value.affected ?? 0,
        })
      )
    }
  } catch (e: any) {
    execError.value =
      e?.response?.data?.message || e?.message || t('settingSqlite.sqlFailed')
  } finally {
    running.value = false
  }
}

const columns = computed(() => {
  if (!result.value?.rows?.length) return []
  return Object.keys(result.value.rows[0]).map((k) => ({
    title: k,
    dataIndex: k,
    key: k,
    ellipsis: true,
  }))
})

const tableData = computed(() =>
  (result.value?.rows ?? []).map((r, i) => ({ ...r, __key: i }))
)

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    runSQL()
  }
}

const sqlSystemPrompt = computed(() => {
  const parts: string[] = []
  if (props.selectedTable && props.schema?.length) {
    const cols = props.schema.map(
      (c) =>
        `${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ''}${c.pk ? ' PRIMARY KEY' : ''}`
    )
    parts.push(`Table "${props.selectedTable}":\n  ${cols.join('\n  ')}`)
  }
  const otherTables = (props.tables ?? []).filter(
    (t) => t.name !== props.selectedTable
  )
  if (otherTables.length) {
    parts.push(
      'Other tables: ' + otherTables.map((t) => `"${t.name}"`).join(', ')
    )
  }
  const schemaSection = parts.length
    ? `\n\nThe database has the following tables and columns:\n${parts.join('\n\n')}`
    : ''
  return `You are a SQLite SQL expert. The user will describe what they want to query or modify in a database.
Generate a clean, correct SQLite SQL statement based on their description.
Respond with ONLY the raw SQL statement — no explanations, no markdown, no code fences.
Do not include any text other than the SQL itself.${schemaSection}`
})

function handleSQLGenerated(content: string) {
  sql.value = content.trim()
}
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('settingSqlite.executeSQL')"
    width="95vw"
    :footer="null"
    @update:open="emit('update:open', $event)"
  >
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-2">
        <a-textarea
          v-model:value="sql"
          :placeholder="$t('settingSqlite.sqlPlaceholder')"
          :auto-size="{ minRows: 4, maxRows: 12 }"
          class="font-mono text-sm"
          @keydown="handleKeydown"
        />
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <ModelGenerateButton
              :text="$t('settingSqlite.aiGenerateSql')"
              :system-prompt="sqlSystemPrompt"
              :title="$t('settingSqlite.aiGenerateSqlTitle')"
              :placeholder="$t('settingSqlite.aiGenerateSqlPlaceholder')"
              @generate="handleSQLGenerated"
            />
            <span class="text-xs text-gray-400">{{
              $t('settingSqlite.sqlHint')
            }}</span>
          </div>
          <a-button
            type="primary"
            :loading="running"
            class="inline-flex items-center gap-1"
            @click="runSQL"
          >
            <Play class="w-4 h-4" />
            {{ $t('settingSqlite.run') }}
          </a-button>
        </div>
      </div>

      <a-alert
        v-if="execError"
        type="error"
        :message="execError"
        show-icon
        class="font-mono text-xs"
      />

      <a-alert
        v-else-if="result && result.rows === null"
        type="success"
        :message="
          $t('settingSqlite.sqlExecuteSuccess', { count: result.affected ?? 0 })
        "
        show-icon
      />

      <template v-if="result?.rows !== null && result?.rows !== undefined">
        <div class="text-xs text-gray-500 mb-1">
          {{ $t('settingSqlite.sqlRows', { count: result.rows.length }) }}
        </div>
        <a-table
          :columns="columns"
          :data-source="tableData"
          :row-key="(_record: any, index: number) => index"
          size="small"
          :scroll="{ x: true, y: 400 }"
          :pagination="{ pageSize: 50, showSizeChanger: false }"
        >
          <template #bodyCell="{ text }">
            <span class="font-mono text-xs whitespace-pre-wrap break-all">{{
              text
            }}</span>
          </template>
        </a-table>
      </template>
    </div>
  </a-modal>
</template>
