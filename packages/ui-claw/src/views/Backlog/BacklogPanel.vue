<template>
  <div class="py-6 px-1">
    <ListerTop :loading="loading" :total="totalCount" @refresh="loadItems">
      <!-- 搜索 -->
      <a-input-search
        v-model:value="searchText"
        :placeholder="t('claw.backlog.searchPlaceholder')"
        allow-clear
        class="w-44"
        @search="
          () => {
            currentPage = 1
            loadItems()
          }
        "
        @change="onKeywordChange"
      />
      <!-- 状态筛选 -->
      <LabelSelector
        :model-value="filterStatus"
        :options="statusOptions"
        :title="t('claw.backlog.statusFilterTitle')"
        @update:model-value="setFilter"
      />
      <!-- 优先级筛选 -->
      <LabelSelector
        v-model="filterPriorityModel"
        :options="priorityOptions"
        :title="t('claw.backlog.priorityFilterTitle')"
      />
      <!-- 类型筛选 -->
      <LabelSelector
        v-if="backlogTypes.length > 0"
        v-model="filterTypeModel"
        :options="typeFilterOptions"
        :title="t('claw.backlog.typeFilterTitle')"
      />
      <!-- 排序方式 -->
      <LabelSelector
        v-model="sortByModel"
        :options="sortByOptions"
        :title="t('claw.backlog.sortFilterTitle')"
      />
      <template #actions>
        <a-button
          v-if="items.length > 0 || loading"
          type="primary"
          @click="openAdd"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ t('claw.backlog.addBtn') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <!-- 骨架 -->
    <div v-if="loading" class="space-y-2">
      <div
        v-for="i in 4"
        :key="i"
        class="h-14 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse"
      />
    </div>

    <!-- 需求池列表 -->
    <div v-else-if="items.length > 0" class="space-y-2">
      <BacklogCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        @view="openView"
        @edit="openEdit"
        @saved="onItemSaved"
        @deleted="onItemDeleted"
      />
    </div>

    <!-- 空状态 -->
    <EmptyState v-else :description="t('claw.backlog.emptyDesc')">
      <a-button type="primary" @click="openAdd">
        <div class="inline-flex items-center gap-1">
          <Plus class="w-4 h-4" aria-hidden="true" />
          {{ t('claw.backlog.addBtn') }}
        </div>
      </a-button>
    </EmptyState>

    <!-- 分页 -->
    <div v-if="totalCount > pageSize" class="flex justify-center mt-6">
      <a-pagination
        v-model:current="currentPage"
        :total="totalCount"
        :page-size="pageSize"
        :show-size-changer="false"
        size="small"
        @change="onPageChange"
      />
    </div>

    <!-- 新增/修改弹窗 -->
    <BacklogModal
      v-model:open="modalVisible"
      :project-id="project?.id ?? 0"
      :item="editingItem"
      :backlog-types="backlogTypes"
      @saved="onModalSaved"
    />

    <!-- 查看弹窗 -->
    <BacklogViewModal v-model:open="viewVisible" :item="viewingItem" />
  </div>
</template>

<script setup lang="ts">
import type { ProjectItem } from '@/claw/api/project'
import type {
  BacklogPriority,
  BacklogStatus,
  BacklogItem,
} from '@/claw/api/backlog'
import { listBacklogTypes, paginateBacklog } from '@/claw/api/backlog'

import EmptyState from '@/components/EmptyState.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import ListerTop from '@/components/ListerTop.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Archive from '~icons/lucide/archive'
import ArrowDownUp from '~icons/lucide/arrow-down-up'
import Check from '~icons/lucide/check'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import Clock from '~icons/lucide/clock'
import List from '~icons/lucide/list'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import BacklogCard from './BacklogCard.vue'
import BacklogModal from './BacklogModal.vue'
import BacklogViewModal from './BacklogViewModal.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{ project: ProjectItem | null }>()

// ─── State ───────────────────────────────────────────────────────────────────

const items = ref<BacklogItem[]>([])
const backlogTypes = ref<string[]>([])
const loading = ref(false)
const filterStatus = ref<'all' | BacklogStatus>('all')
const filterType = ref<string | undefined>(undefined)
const filterPriority = ref<BacklogPriority | undefined>(undefined)
const sortBy = ref<'status' | 'priority'>('status')
const searchText = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalCount = ref(0)
const modalVisible = ref(false)
const editingItem = ref<BacklogItem | null>(null)
const viewVisible = ref(false)
const viewingItem = ref<BacklogItem | null>(null)

// ─── Filter Options ────────────────────────────────────────────────────────────

const statusOptions = computed(() => [
  { value: 'all', label: t('claw.backlog.allStatus'), icon: List },
  { value: 'pending', label: t('claw.backlog.statusPending'), icon: Clock },
  {
    value: 'active',
    label: t('claw.backlog.statusActive'),
    icon: CheckCircle2,
  },
  { value: 'pool', label: t('claw.backlog.statusPool'), icon: Archive },
  { value: 'dropped', label: t('claw.backlog.statusDropped'), icon: Trash2 },
  { value: 'done', label: t('claw.backlog.statusDone'), icon: Check },
])

const priorityOptions = computed(() => [
  { value: '', label: t('claw.backlog.allPriority') },
  { value: 'high', label: t('claw.backlog.priorityHigh') },
  { value: 'medium', label: t('claw.backlog.priorityMedium') },
  { value: 'low', label: t('claw.backlog.priorityLow') },
])

const typeFilterOptions = computed(() => [
  { value: '', label: t('claw.backlog.allType') },
  ...backlogTypes.value.map((t) => ({ value: t, label: t })),
])

const sortByOptions = computed(() => [
  { value: 'status', label: t('claw.backlog.sortByStatus'), icon: ArrowDownUp },
  {
    value: 'priority',
    label: t('claw.backlog.sortByPriority'),
    icon: ArrowDownUp,
  },
])

const filterPriorityModel = computed({
  get: () => filterPriority.value ?? '',
  set: (v: string) => {
    filterPriority.value = v === '' ? undefined : (v as BacklogPriority)
    currentPage.value = 1
    loadItems()
  },
})

const filterTypeModel = computed({
  get: () => filterType.value ?? '',
  set: (v: string) => {
    filterType.value = v === '' ? undefined : v
    currentPage.value = 1
    loadItems()
  },
})

const sortByModel = computed({
  get: () => sortBy.value,
  set: (v: string) => {
    sortBy.value = v as 'status' | 'priority'
    currentPage.value = 1
    loadItems()
  },
})

const setFilter = (status: string) => {
  filterStatus.value = status as 'all' | BacklogStatus
  currentPage.value = 1
  loadItems()
}

// ─── Keyword Debounce ─────────────────────────────────────────────────────────

let keywordTimer: ReturnType<typeof setTimeout> | null = null
const onKeywordChange = () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    currentPage.value = 1
    loadItems()
  }, 300)
}

const onPageChange = (page: number) => {
  currentPage.value = page
  loadItems()
}

// ─── Load ─────────────────────────────────────────────────────────────────────

const loadTypes = async () => {
  if (!props.project?.id) return
  try {
    backlogTypes.value = await listBacklogTypes(props.project.id)
  } catch {
    /* ignore */
  }
}

const loadItems = async () => {
  if (!props.project?.id) return
  loading.value = true
  try {
    const result = await paginateBacklog(props.project.id, {
      page: currentPage.value,
      pageSize: pageSize.value,
      status: filterStatus.value === 'all' ? undefined : filterStatus.value,
      priority: filterPriority.value,
      type: filterType.value,
      keyword: searchText.value.trim() || undefined,
      sortBy: sortBy.value,
    })
    items.value = result.records
    totalCount.value = result.total
  } catch {
    message.error(t('claw.backlog.loadFailed'))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.project?.id,
  (id) => {
    if (id) {
      currentPage.value = 1
      loadTypes()
      loadItems()
    }
  },
  { immediate: true }
)

// ─── Modal ────────────────────────────────────────────────────────────────────

const openAdd = () => {
  editingItem.value = null
  modalVisible.value = true
}

const openEdit = (item: BacklogItem) => {
  editingItem.value = item
  modalVisible.value = true
}

const onModalSaved = () => {
  loadTypes()
  loadItems()
}

const onItemSaved = (updated: BacklogItem) => {
  const idx = items.value.findIndex((i) => i.id === updated.id)
  if (idx !== -1) items.value[idx] = updated
}

const onItemDeleted = (_id: number) => {
  if (items.value.length === 1 && currentPage.value > 1) {
    currentPage.value -= 1
  }
  loadTypes()
  loadItems()
}

function openView(item: BacklogItem) {
  viewingItem.value = item
  viewVisible.value = true
}

onMounted(() => {
  testActionSet('list.refresh', () => loadItems())
  testActionSet('list.search', (kw: string) => {
    searchText.value = kw ?? ''
    currentPage.value = 1
    loadItems()
  })
  testActionSet('list.add', () => openAdd())
})

onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.search')
  testActionUnset('list.add')
})
</script>
