<script setup lang="ts">
import type { DbTable } from '@/api/sqlite'
import LoadingState from '@/components/LoadingState.vue'
import RefreshCw from '~icons/lucide/refresh-cw'

import SquareTerminal from '~icons/lucide/square-terminal'
import Table2 from '~icons/lucide/table-2'
import { computed, ref } from 'vue'

const props = defineProps<{
  tables: DbTable[]
  loading: boolean
  selectedTable: string
}>()

const emit = defineEmits<{
  select: [tableName: string]
  refresh: []
  executeSql: []
}>()

const searchKeyword = ref('')

const filteredTables = computed(() => {
  if (!searchKeyword.value) return props.tables
  const kw = searchKeyword.value.toLowerCase()
  return props.tables.filter((t) => t.name.toLowerCase().includes(kw))
})

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'M'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + 'K'
  return bytes + 'B'
}
</script>

<template>
  <div
    class="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col h-full md:max-h-[calc(100vh-12rem)]"
  >
    <div
      class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 shrink-0"
    >
      <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">{{
        $t('settingSqlite.dataTable')
      }}</span>
      <div class="inline-flex items-center gap-1">
        <a-tooltip :title="$t('settingSqlite.executeSQL')">
          <a-button
            type="text"
            class="inline-flex items-center"
            :aria-label="$t('settingSqlite.executeSQL')"
            @click="emit('executeSql')"
          >
            <SquareTerminal class="w-4 h-4" aria-hidden="true" />
          </a-button>
        </a-tooltip>
        <a-button
          type="text"
          :loading="loading"
          class="inline-flex items-center"
          :aria-label="$t('common.refresh')"
          @click="emit('refresh')"
        >
          <RefreshCw v-if="!loading" class="w-4 h-4" aria-hidden="true" />
        </a-button>
      </div>
    </div>
    <div
      class="px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 shrink-0"
    >
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="$t('settingSqlite.searchTable')"
        allow-clear
      />
    </div>
    <div class="overflow-y-auto flex-1">
      <LoadingState :loading="loading">
        <div
          v-if="filteredTables.length === 0 && !loading"
          class="px-3 py-4 text-sm text-gray-400 text-center"
        >
          {{ $t('settingSqlite.noTable') }}
        </div>
        <div
          v-for="tbl in filteredTables"
          :key="tbl.name"
          class="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/30 last:border-0"
          :class="
            selectedTable === tbl.name
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
              : 'text-gray-700 dark:text-gray-300'
          "
          @click="emit('select', tbl.name)"
        >
          <Table2 class="w-4 h-4 shrink-0" />
          <a-tooltip :title="tbl.name" placement="right">
            <span class="text-sm font-medium flex-1 truncate">{{
              tbl.name
            }}</span>
          </a-tooltip>
          <span class="text-xs text-gray-400 shrink-0">{{ tbl.count }}</span>
          <span
            v-if="tbl.size"
            class="text-xs text-gray-300 dark:text-gray-600 shrink-0"
            >{{ formatSize(tbl.size) }}</span
          >
        </div>
      </LoadingState>
    </div>
  </div>
</template>
