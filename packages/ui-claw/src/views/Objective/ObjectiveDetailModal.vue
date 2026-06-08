<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    width="95vw"
    :footer="null"
    @cancel="$emit('update:open', false)"
  >
    <template #title>
      <div class="flex items-center justify-between w-full pr-8">
        <div class="flex items-center gap-2">
          <component :is="iconComp" class="w-5 h-5" :class="iconColor" />
          <span class="text-sm text-gray-400 dark:text-gray-500 shrink-0"
            >{{ t('claw.objective.modalTitlePrefix') }} -
          </span>
          <span class="font-semibold text-gray-900 dark:text-gray-100">{{
            objective?.title
          }}</span>
          <span
            class="ml-1 text-xs px-2 py-0.5 rounded-full font-medium"
            :class="statusBadge"
          >
            {{ statusLabel }}
          </span>
        </div>
        <a-dropdown :trigger="['hover']">
          <a-button type="text" class="flex items-center" @click.stop>
            <MoreHorizontal class="w-4 h-4 text-gray-500" aria-hidden="true" />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item @click="openEdit">
                <div class="flex items-center gap-2">
                  <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ t('common.edit') }}
                </div>
              </a-menu-item>
              <a-menu-item class="!text-red-500" @click="handleDelete">
                <div class="flex items-center gap-2">
                  <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ t('common.delete') }}
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </template>

    <div v-if="objective" class="space-y-5">
      <!-- 描述 -->
      <p
        v-if="objective.description"
        class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed"
      >
        {{ objective.description }}
      </p>

      <!-- 时间 & 结果 -->
      <div
        v-if="
          objective.startAt ||
          objective.endAt ||
          objective.dueAt ||
          objective.result
        "
        class="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500"
      >
        <span v-if="objective.startAt"
          >{{ t('claw.objective.startLabel')
          }}<DatetimeViewer :value="objective.startAt" format="date"
        /></span>
        <span v-if="objective.endAt"
          >{{ t('claw.objective.completedLabel')
          }}<DatetimeViewer :value="objective.endAt" format="date"
        /></span>
        <span v-if="objective.dueAt" class="text-orange-400"
          >{{ t('claw.objective.dueLabel')
          }}<DatetimeViewer :value="objective.dueAt" format="date"
        /></span>
        <span v-if="objective.result" class="text-gray-600 dark:text-gray-300"
          >{{ t('claw.objective.resultViewLabel') }}{{ objective.result }}</span
        >
      </div>

      <!-- 进度概览 -->
      <div class="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
            t('claw.objective.keyResultProgressTitle')
          }}</span>
          <span class="text-sm font-bold text-gray-900 dark:text-gray-100"
            >{{ progressPct }}%</span
          >
        </div>
        <div
          class="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden"
        >
          <div
            class="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-500 transition-all duration-500"
            :style="{ width: progressPct + '%' }"
          ></div>
        </div>
        <div
          class="flex items-center justify-between mt-2 text-xs text-gray-400 dark:text-gray-500"
        >
          <span>{{
            t('claw.objective.doneItemsCount', { count: progressDone })
          }}</span>
          <span>{{
            t('claw.objective.totalItemsCount', { count: progressTotal })
          }}</span>
        </div>
      </div>

      <!-- 关键结果列表 -->
      <div>
        <!-- 标题 -->
        <div
          class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
        >
          <KeyIcon class="w-4 h-4" />
          {{ t('claw.objective.keyResultsTitle') }}
        </div>
        <!-- 工具栏 -->
        <div class="flex items-center gap-3 mb-3">
          <div class="flex items-center gap-2 shrink-0">
            <LabelSelector
              v-model="filterStatus"
              :options="statusFilterOptions"
              :title="t('claw.objective.statusLabel')"
            />
          </div>
          <div class="ml-auto flex items-center gap-2">
            <a-input-search
              v-model:value="searchKeyword"
              :placeholder="t('claw.objective.searchKeyResults')"
              allow-clear
              class="!rounded-lg"
              style="width: 200px"
            />
            <a-button @click="refresh">
              <div class="inline-flex items-center gap-1">
                <RotateCcw class="w-4 h-4" aria-hidden="true" />
                {{ t('common.refresh') }}
              </div>
            </a-button>
            <a-button type="primary" @click="openAddAction">
              <div class="inline-flex items-center gap-1">
                <Plus class="w-4 h-4" aria-hidden="true" />
                {{ t('claw.objective.addKeyResult') }}
              </div>
            </a-button>
          </div>
        </div>

        <!-- Loading state（仅首次无数据时显示） -->
        <div
          v-if="actionsLoading && actions.length === 0"
          class="py-6 text-center text-sm text-gray-400"
        >
          {{ t('common.loading') }}
        </div>

        <!-- Actions grid -->
        <template v-else>
          <div
            :class="actionsLoading ? 'opacity-50 pointer-events-none' : ''"
            class="transition-opacity duration-200"
          >
            <div v-if="filteredActions.length > 0" class="space-y-2">
              <KeyResultCard
                v-for="action in filteredActions"
                :key="action.id"
                :key-result="action"
                :keyword="searchKeyword"
                :objective-title="objective?.title"
                :project-id="objective?.projectId ?? undefined"
                @refresh="refresh"
              />
            </div>
            <div
              v-else
              class="py-8 text-center text-sm text-gray-400 dark:text-gray-500"
            >
              {{
                actions.length > 0 && searchKeyword.trim()
                  ? t('claw.objective.noMatchingKeyResults')
                  : t('claw.objective.noKeyResults')
              }}
            </div>
          </div>
        </template>

        <!-- 分页 -->
        <div v-if="total > pageSize" class="flex justify-center mt-4">
          <a-pagination
            v-model:current="currentPage"
            :total="total"
            :page-size="pageSize"
            :show-size-changer="false"
          />
        </div>
      </div>
    </div>

    <!-- 新增关键结果 Modal -->
    <ObjectiveKeyResultAddModal
      v-model:open="showAddAction"
      :objective-id="objective?.id ?? 0"
      @refresh="refresh"
    />

    <!-- 编辑目标 Modal -->
    <ObjectiveEditModal
      v-model:open="showEditModal"
      :objective="objective"
      @refresh="emit('refresh')"
    />
  </a-modal>
</template>

<script setup lang="ts">
import type { KeyResult } from '@/claw/api/objective'
import { deleteObjective, listKeyResults } from '@/claw/api/objective'
import { OBJECTIVE_STATUS_BADGE, OBJECTIVE_STATUS_LABEL } from './constant'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import { getIconComponent } from '@/components/icons/icons'
import { Modal, message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { testActionSet, testActionUnset } from '@/utils/test'
import CalendarCheck from '~icons/lucide/calendar-check'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import KeyIcon from '~icons/lucide/key'
import List from '~icons/lucide/list'
import Loader2 from '~icons/lucide/loader-2'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import RotateCcw from '~icons/lucide/rotate-ccw'

import Target from '~icons/lucide/target'
import Trash2 from '~icons/lucide/trash-2'
import KeyResultCard from './KeyResultCard.vue'
import ObjectiveEditModal from './ObjectiveEditModal.vue'
import ObjectiveKeyResultAddModal from './ObjectiveKeyResultAddModal.vue'
import type { Objective } from './types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  objective: Objective | null
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'refresh'): void
}>()

const showEditModal = ref(false)

const openEdit = () => {
  showEditModal.value = true
}

const handleDelete = () => {
  if (!props.objective) return
  Modal.confirm({
    title: t('claw.objective.deleteObjectiveTitle'),
    content: t('claw.objective.deleteObjectiveContent'),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    async onOk() {
      try {
        await deleteObjective(props.objective!.id)
        message.success(t('common.deleteSuccess'))
        emit('update:open', false)
        emit('refresh')
      } catch (e: any) {
        message.error(e.message || t('common.deleteFailed'))
      }
    },
  })
}

// ─── Actions ─────────────────────────────────────────────────────────────────

const actions = ref<KeyResult[]>([])
const actionsLoading = ref(false)
const showAddAction = ref(false)
const searchKeyword = ref('')
const filterStatus = ref('all')
const currentPage = ref(1)
const pageSize = 10
const total = ref(0)
const progressTotal = ref(0)
const progressDone = ref(0)

const loadActions = async () => {
  if (!props.objective) return
  actionsLoading.value = true
  try {
    const res = await listKeyResults({
      objectiveId: props.objective.id,
      status: filterStatus.value !== 'all' ? filterStatus.value : undefined,
      page: currentPage.value,
      pageSize,
    })
    actions.value = res.records
    total.value = res.total
  } finally {
    actionsLoading.value = false
  }
}

const loadProgress = async () => {
  if (!props.objective) return
  const [allRes, doneRes] = await Promise.all([
    listKeyResults({ objectiveId: props.objective.id, page: 1, pageSize: 1 }),
    listKeyResults({
      objectiveId: props.objective.id,
      status: 'done',
      page: 1,
      pageSize: 1,
    }),
  ])
  progressTotal.value = allRes.total
  progressDone.value = doneRes.total
}

const refresh = () => {
  loadProgress()
  loadActions()
}

onMounted(() => {
  testActionSet('list.refresh', () => refresh())
  testActionSet('modal.close', () => emit('update:open', false))
})
onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('modal.close')
})

watch(
  () => props.open,
  (val) => {
    if (val) {
      filterStatus.value = 'all'
      currentPage.value = 1
      loadProgress()
      loadActions()
    }
  }
)
watch(
  () => props.objective?.id,
  (id) => {
    if (id && props.open) {
      loadProgress()
      loadActions()
    }
  }
)
watch(filterStatus, () => {
  if (currentPage.value !== 1) {
    currentPage.value = 1
  } else {
    loadActions()
  }
})
watch(currentPage, () => {
  loadActions()
})

const openAddAction = () => {
  showAddAction.value = true
}

// ─── Filtering & Pagination ───────────────────────────────────────────────────

const statusFilterOptions = [
  { value: 'all', label: t('claw.objective.all'), icon: List },
  { value: 'running', label: t('claw.objective.statusRunning'), icon: Loader2 },
  { value: 'done', label: t('claw.objective.statusDone'), icon: CheckCircle2 },
  {
    value: 'canceled',
    label: t('claw.objective.statusCanceled'),
    icon: CalendarCheck,
  },
]

const filteredActions = computed(() => {
  if (!searchKeyword.value.trim()) return actions.value
  const kw = searchKeyword.value.trim()
  const idMatch = kw.match(/^#(\d+)$/)
  if (idMatch) {
    return actions.value.filter((a: KeyResult) => a.id === Number(idMatch[1]))
  }
  const kwLower = kw.toLowerCase()
  return actions.value.filter((a: KeyResult) =>
    (a.title + ' ' + a.detail).toLowerCase().includes(kwLower)
  )
})

// ─── Progress ─────────────────────────────────────────────────────────────────

const progressPct = computed(() =>
  progressTotal.value === 0
    ? 0
    : Math.round((progressDone.value / progressTotal.value) * 100)
)

// ─── Status helpers ───────────────────────────────────────────────────────────

const statusLabel = computed(
  () =>
    OBJECTIVE_STATUS_LABEL[props.objective?.status || 'active'] ||
    OBJECTIVE_STATUS_LABEL.active
)
const statusBadge = computed(
  () =>
    OBJECTIVE_STATUS_BADGE[props.objective?.status || 'active'] ||
    OBJECTIVE_STATUS_BADGE.active
)

const iconComp = computed(() => {
  const icon = props.objective?.icon
  if (!icon) return Target
  const name = icon.charAt(0).toUpperCase() + icon.slice(1)
  return getIconComponent(name) || Target
})
const iconColor = computed(() => {
  const m: Record<string, string> = {
    pending: 'text-gray-400',
    active: 'text-primary-500',
    paused: 'text-amber-500',
    completed: 'text-green-500',
    failed: 'text-red-400',
  }
  return m[props.objective?.status || 'active'] || 'text-primary-500'
})
</script>
