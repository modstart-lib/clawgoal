<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="t('claw.metric.manageMetric')"
    :footer="null"
    width="min(600px, 90vw)"
    @cancel="emit('update:open', false)"
  >
    <LoadingState :loading="loading">
      <div class="py-2">
        <!-- Metric List -->
        <div class="space-y-2 min-h-[60px]">
          <div
            v-if="list.length === 0 && !loading"
            class="py-8 text-center text-sm text-gray-400"
          >
            {{ t('claw.metric.noData') }}
          </div>
          <div
            v-for="(item, index) in list"
            :key="item.id"
            class="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <!-- Sort Arrows -->
            <div class="flex flex-col gap-0.5 shrink-0">
              <a-button
                type="text"
                :disabled="index === 0 || sorting"
                class="!p-0.5 !min-w-0 !h-5 text-gray-400 hover:!text-primary-500 disabled:opacity-30"
                @click="moveUp(index)"
              >
                <ChevronUp class="w-3.5 h-3.5" />
              </a-button>
              <a-button
                type="text"
                :disabled="index === list.length - 1 || sorting"
                class="!p-0.5 !min-w-0 !h-5 text-gray-400 hover:!text-primary-500 disabled:opacity-30"
                @click="moveDown(index)"
              >
                <ChevronDown class="w-3.5 h-3.5" />
              </a-button>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <div
                  class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                >
                  {{ item.title }}
                </div>
                <span
                  class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0"
                  >{{
                    item.summaryMode === 'avg'
                      ? t('claw.metric.summaryModeAvg')
                      : item.summaryMode === 'latest'
                        ? t('claw.metric.summaryModeLatest')
                        : t('claw.metric.summaryModeSum')
                  }}</span
                >
              </div>
              <div class="text-xs text-gray-400 dark:text-gray-500">
                {{ item.name }}
              </div>
              <div
                v-if="item.remark"
                class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5 italic"
              >
                {{ item.remark }}
              </div>
            </div>

            <!-- Sort Badge -->
            <span
              class="text-xs text-gray-400 dark:text-gray-500 w-6 text-center"
              >{{ item.sort }}</span
            >

            <!-- Actions -->
            <a-tooltip :title="t('common.edit')">
              <a-button
                type="text"
                class="!p-1 !min-w-0 text-gray-400 hover:!text-primary-500"
                @click="openEdit(item)"
              >
                <Pencil class="w-4 h-4" />
              </a-button>
            </a-tooltip>
            <a-tooltip :title="t('common.delete')">
              <a-button
                type="text"
                class="!p-1 !min-w-0 text-gray-400 hover:!text-red-500"
                @click="confirmDelete(item)"
              >
                <Trash2 class="w-4 h-4" />
              </a-button>
            </a-tooltip>
          </div>
        </div>

        <!-- Add Button -->
        <div class="mt-4">
          <a-button block @click="openAdd">
            <div class="inline-flex items-center gap-1">
              <Plus class="w-4 h-4" aria-hidden="true" />
              {{ t('claw.metric.addMetric') }}
            </div>
          </a-button>
        </div>
      </div>
    </LoadingState>
  </a-modal>

  <!-- ─── Add / Edit Form Modal ─── -->
  <a-modal
    v-model:open="showForm"
    :keyboard="false"
    :mask-closable="false"
    :title="
      editingItem ? t('claw.metric.editMetric') : t('claw.metric.addMetric')
    "
    :ok-text="t('common.confirm')"
    :cancel-text="t('common.cancel')"
    :confirm-loading="saving"
    @ok="saveForm"
    @cancel="closeForm"
  >
    <div class="space-y-4 py-2">
      <div v-if="!editingItem">
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {{ t('claw.metric.metricName') }}
          <span class="text-red-500">*</span>
        </div>
        <a-input
          v-model:value="form.name"
          :placeholder="t('claw.metric.metricNamePlaceholder')"
        />
      </div>
      <div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {{ t('claw.metric.metricTitle') }}
          <span class="text-red-500">*</span>
        </div>
        <a-input
          v-model:value="form.title"
          :placeholder="t('claw.metric.metricTitlePlaceholder')"
        />
      </div>
      <div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {{ t('claw.metric.metricSort') }}
        </div>
        <a-input-number v-model:value="form.sort" class="w-full" :min="0" />
      </div>
      <div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {{ t('claw.metric.summaryMode') }}
        </div>
        <a-radio-group v-model:value="form.summaryMode" button-style="solid">
          <a-radio-button value="sum">{{
            t('claw.metric.summaryModeSum')
          }}</a-radio-button>
          <a-radio-button value="avg">{{
            t('claw.metric.summaryModeAvg')
          }}</a-radio-button>
          <a-radio-button value="latest">{{
            t('claw.metric.summaryModeLatest')
          }}</a-radio-button>
        </a-radio-group>
      </div>
      <div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {{ t('claw.metric.remark') }}
        </div>
        <a-textarea
          v-model:value="form.remark"
          :placeholder="t('claw.metric.metricRemarkPlaceholder')"
          :rows="2"
          :maxlength="500"
          show-count
        />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import {
  addMetric,
  deleteMetric,
  editMetric,
  listMetric,
  type MetricItem,
} from '@/claw/api/metric'
import LoadingState from '@/components/LoadingState.vue'
import { message, Modal } from 'ant-design-vue'
import ChevronDown from '~icons/lucide/chevron-down'
import ChevronUp from '~icons/lucide/chevron-up'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  projectId: number
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'refresh'): void
}>()

// ─── List ──────────────────────────────────────────────────────────────────────
const loading = ref(false)
const list = ref<MetricItem[]>([])

const loadList = async () => {
  loading.value = true
  try {
    list.value = await listMetric(props.projectId)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) loadList()
  }
)

// ─── Sort ──────────────────────────────────────────────────────────────────────
const sorting = ref(false)

const swapSort = async (indexA: number, indexB: number) => {
  sorting.value = true
  try {
    const a = list.value[indexA]
    const b = list.value[indexB]
    const sortA = a.sort
    const sortB = b.sort
    // If same sort value, use index-based values
    const newSortA = sortA !== sortB ? sortB : indexB
    const newSortB = sortA !== sortB ? sortA : indexA
    await Promise.all([
      editMetric(a.id, { sort: newSortA }),
      editMetric(b.id, { sort: newSortB }),
    ])
    await loadList()
    emit('refresh')
  } finally {
    sorting.value = false
  }
}

const moveUp = (index: number) => swapSort(index, index - 1)
const moveDown = (index: number) => swapSort(index, index + 1)

// ─── Add / Edit Form ───────────────────────────────────────────────────────────
const showForm = ref(false)
const saving = ref(false)
const editingItem = ref<MetricItem | null>(null)
const form = ref({
  name: '',
  title: '',
  sort: 0,
  remark: '',
  summaryMode: 'sum',
})

const openAdd = () => {
  editingItem.value = null
  const maxSort =
    list.value.length > 0
      ? Math.max(...list.value.map((m: MetricItem) => m.sort ?? 0)) + 1
      : 0
  form.value = {
    name: '',
    title: '',
    sort: maxSort,
    remark: '',
    summaryMode: 'sum',
  }
  showForm.value = true
}

const openEdit = (item: MetricItem) => {
  editingItem.value = item
  form.value = {
    name: item.name,
    title: item.title,
    sort: item.sort,
    remark: item.remark ?? '',
    summaryMode: item.summaryMode ?? 'sum',
  }
  showForm.value = true
}

const closeForm = () => {
  showForm.value = false
  editingItem.value = null
}

const saveForm = async () => {
  const { name, title, sort, remark, summaryMode } = form.value
  if (!title.trim()) {
    message.warning(t('claw.metric.titleRequired'))
    return
  }
  if (!editingItem.value && !name.trim()) {
    message.warning(t('claw.metric.nameRequired'))
    return
  }
  if (!editingItem.value && !/^[a-zA-Z0-9_]+$/.test(name)) {
    message.warning(t('claw.metric.nameFormat'))
    return
  }

  saving.value = true
  try {
    if (editingItem.value) {
      await editMetric(editingItem.value.id, {
        title: title.trim(),
        sort,
        remark: remark.trim() || null,
        summaryMode,
      })
      message.success(t('claw.metric.metricUpdated'))
    } else {
      await addMetric({
        projectId: props.projectId,
        name: name.trim(),
        title: title.trim(),
        sort,
        remark: remark.trim() || undefined,
        summaryMode,
      })
      message.success(t('claw.metric.metricAdded'))
    }
    closeForm()
    await loadList()
    emit('refresh')
  } finally {
    saving.value = false
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────────
const confirmDelete = (item: MetricItem) => {
  Modal.confirm({
    title: t('claw.metric.deleteMetric'),
    content: t('claw.metric.deleteMetricConfirm'),
    okText: t('common.confirm'),
    cancelText: t('common.cancel'),
    okButtonProps: { danger: true },
    onOk: async () => {
      await deleteMetric(item.id)
      message.success(t('claw.metric.metricDeleted'))
      await loadList()
      emit('refresh')
    },
  })
}

onMounted(() => {
  testActionSet('list.refresh', () => loadList())
  testActionSet('list.add', () => openAdd())
})

onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
})
</script>
