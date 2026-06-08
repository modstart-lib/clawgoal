<script setup lang="ts">
import type { DbColumn } from '@/api/sqlite'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  open: boolean
  row: Record<string, any>
  schema: DbColumn[]
  saving: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:row': [value: Record<string, any>]
  save: []
}>()

function isBlobValue(val: any): boolean {
  return val != null && typeof val === 'object' && val.__type === 'blob'
}

function blobLabel(val: any): string {
  const len: number = val?.len ?? 0
  if (len % 4 === 0 && len > 0)
    return `[Float32×${len / 4}${t('settingSqlite.binaryField')}]`
  return `[BLOB ${len}B${t('settingSqlite.binaryField')}]`
}
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('settingSqlite.editRecord')"
    width="95vw"
    :confirm-loading="saving"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
    @ok="emit('save')"
    @update:open="emit('update:open', $event)"
  >
    <a-form layout="vertical" class="max-h-[70vh] overflow-y-auto pr-1">
      <a-form-item v-for="col in schema" :key="col.name" :label="col.name">
        <template v-if="isBlobValue(row[col.name])">
          <div
            class="font-mono text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 select-none"
          >
            {{ blobLabel(row[col.name]) }}
          </div>
        </template>
        <template v-else-if="/text|blob|clob|char|json/i.test(col.type)">
          <a-textarea
            :value="row[col.name]"
            :disabled="col.pk === 1"
            :auto-size="{ minRows: 3, maxRows: 10 }"
            class="font-mono text-sm"
            @change="
              emit('update:row', {
                ...row,
                [col.name]: ($event.target as HTMLTextAreaElement).value,
              })
            "
          />
        </template>
        <template v-else>
          <a-input
            :value="row[col.name]"
            :disabled="col.pk === 1"
            class="font-mono text-sm"
            @change="
              emit('update:row', {
                ...row,
                [col.name]: ($event.target as HTMLInputElement).value,
              })
            "
          />
        </template>
        <div v-if="col.pk === 1" class="text-xs text-gray-400 mt-0.5">
          {{ $t('settingSqlite.primaryKey') }}
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
