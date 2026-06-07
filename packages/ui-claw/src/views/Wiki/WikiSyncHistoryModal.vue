<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="t('claw.project.wikiSyncHistory')"
    :footer="null"
    width="95vw"
    @cancel="emit('update:open', false)"
    @update:open="emit('update:open', $event)"
  >
    <div class="py-2">
      <div v-if="loading" class="flex justify-center py-10">
        <Loader2
          class="w-5 h-5 animate-spin text-gray-400"
          aria-hidden="true"
        />
      </div>
      <div
        v-else-if="logs.length === 0"
        class="text-center py-10 text-gray-400"
      >
        {{ t('claw.project.wikiSyncNoRecords') }}
      </div>
      <div v-else>
        <div class="space-y-2 max-h-[55vh] overflow-y-auto">
          <div
            v-for="log in logs"
            :key="log.id"
            class="border border-gray-100 dark:border-gray-700 rounded-lg p-3"
          >
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="statusClass(log.status)"
                  >{{ statusLabel(log.status) }}</span
                >
                <span
                  class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs"
                  >{{ log.url }}</span
                >
              </div>
              <span
                class="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2"
                ><DatetimeViewer :value="log.createdAt"
              /></span>
            </div>
            <div
              v-if="log.statusRemark"
              class="text-xs text-red-500 dark:text-red-400 mt-1"
            >
              {{ log.statusRemark }}
            </div>
          </div>
        </div>
        <div class="flex justify-end mt-4">
          <a-pagination
            v-model:current="currentPage"
            :total="total"
            :page-size="pageSize"
            size="small"
            show-less-items
            @change="handlePageChange"
          />
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { listAllWikiSyncLogs, type WikiSyncLog } from '@/claw/api/wiki'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import Loader2 from '~icons/lucide/loader-2'

const props = defineProps<{ open: boolean; projectId: number }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t } = useI18n()
const logs = ref<WikiSyncLog[]>([])
const loading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20

async function loadLogs(page = 1) {
  loading.value = true
  try {
    const result = await listAllWikiSyncLogs(props.projectId, {
      page,
      pageSize,
    })
    logs.value = result.records
    total.value = result.total
    currentPage.value = result.page
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  async (val) => {
    if (!val) return
    currentPage.value = 1
    await loadLogs(1)
  }
)

function handlePageChange(page: number) {
  loadLogs(page)
}

onMounted(() => {
  testActionSet('list.refresh', () => loadLogs(currentPage.value))
})

onUnmounted(() => {
  testActionUnset('list.refresh')
})

function statusClass(status: string) {
  if (status === 'success')
    return 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
  if (status === 'fail')
    return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
  return 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
}

function statusLabel(status: string) {
  if (status === 'success') return t('claw.project.wikiSyncStatusSuccess')
  if (status === 'fail') return t('claw.project.wikiSyncStatusFail')
  return t('claw.project.wikiSyncStatusProcessing')
}
</script>
