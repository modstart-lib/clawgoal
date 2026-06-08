<script setup lang="ts">
import type { DbFile } from '@/api/sqlite'
import Database from '~icons/lucide/database'
import RefreshCw from '~icons/lucide/refresh-cw'

const props = defineProps<{
  dbList: DbFile[]
  loading: boolean
  selectedPath: string
}>()

const emit = defineEmits<{
  select: [db: DbFile]
  refresh: []
}>()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function handleChange(path: string) {
  const db = props.dbList.find((d) => d.path === path)
  if (db) emit('select', db)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Database class="w-4 h-4 text-gray-500 shrink-0" />
    <a-select
      class="flex-1 min-w-0"
      :value="selectedPath || undefined"
      :loading="loading"
      :placeholder="$t('settingSqlite.noDb')"
      @change="handleChange"
    >
      <a-select-option v-for="db in dbList" :key="db.path" :value="db.path">
        <span class="text-sm font-mono">{{ db.path }}</span>
        <span class="ml-2 text-sm text-gray-400">{{
          formatSize(db.size)
        }}</span>
      </a-select-option>
    </a-select>
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
</template>
