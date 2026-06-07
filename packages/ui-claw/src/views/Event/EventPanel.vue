<template>
  <div class="py-6 px-1">
    <ListerTop :loading="loading" :total="totalCount" @refresh="handleRefresh">
      <!-- 搜索 -->
      <a-input
        v-model:value="searchKeyword"
        :placeholder="t('claw.event.searchPlaceholder')"
        allow-clear
        class="w-44"
        @change="onKeywordChange"
      />
      <LabelSelector
        v-if="eventTypes.length > 0"
        :model-value="selectedType"
        :options="eventTypeOptions"
        :title="t('claw.event.typeFilterTitle')"
        @update:model-value="setTypeFilter"
      />
      <template #actions>
        <a-button
          v-if="events.length > 0 || loading"
          type="primary"
          @click="showAddModal = true"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ t('claw.project.addEvent') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <!-- 加载骨架 -->
    <div v-if="loading" class="space-y-2">
      <div
        v-for="i in 3"
        :key="i"
        class="h-20 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse"
      />
    </div>

    <!-- 事件列表 -->
    <div v-else-if="events.length > 0" class="space-y-2">
      <EventCard
        v-for="item in events"
        :key="item.id"
        :item="item"
        :can-share="canShare"
        @view="openView"
        @edit="editItem"
        @delete="confirmDeleteEvent"
        @share="handleShare"
        @unshare="handleUnshare"
        @copy-share-link="handleCopyShareLink"
      />
    </div>

    <!-- 空状态 -->
    <EmptyState v-else :description="t('claw.project.eventEmptyDesc')">
      <a-button type="primary" @click="showAddModal = true">
        <div class="inline-flex items-center gap-1">
          <Plus class="w-4 h-4" aria-hidden="true" />
          {{ t('claw.project.addEvent') }}
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

    <!-- 新增 / 编辑事件 Modal -->
    <EventEditModal
      v-model:open="showAddModal"
      :project="project"
      :editing-item="editingItem"
      :project-types="eventTypes"
      @refresh="handleAfterSave"
      @update:open="
        (val) => {
          if (!val) resetForm()
        }
      "
    />

    <!-- 查看事件 Modal -->
    <EventViewModal v-model:open="viewVisible" :item="viewingItem" />
  </div>
</template>

<script setup lang="ts">
import {
  deleteEvent,
  listEvents,
  listEventTypes,
  shareEvent,
  unshareEvent,
  type ProjectEvent,
  type ProjectItem,
} from '@/claw/api/project'
import EmptyState from '@/components/EmptyState.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import ListerTop from '@/components/ListerTop.vue'
import { useAppEnvComputed } from '@/composables/setting'
import { copyText } from '@/utils/utils'
import { message, Modal } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Plus from '~icons/lucide/plus'
import EventCard from './EventCard.vue'
import EventEditModal from './EventEditModal.vue'
import EventViewModal from './EventViewModal.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()
const { viewMode, siteUrl } = useAppEnvComputed()
const canShare = computed(() => viewMode.value !== 'client')

function confirmDeleteEvent(item: ProjectEvent) {
  Modal.confirm({
    title: t('claw.project.deleteEventConfirm'),
    okText: t('claw.project.eventDeleteOk'),
    okType: 'danger',
    cancelText: t('claw.project.eventDeleteCancel'),
    onOk: () => deleteItem(item),
  })
}

const props = defineProps<{ project: ProjectItem | null }>()
const emit = defineEmits<{ (e: 'refresh'): void }>()

// ─── State ───────────────────────────────────────────────────────────────────

const events = ref<ProjectEvent[]>([])
const totalCount = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const selectedType = ref('')
const searchKeyword = ref('')
const eventTypes = ref<string[]>([])

// ─── Load data ───────────────────────────────────────────────────────────────

const loadTypes = async () => {
  if (!props.project?.id) return
  try {
    eventTypes.value = await listEventTypes(props.project.id)
  } catch {
    // ignore
  }
}

const loadEvents = async () => {
  if (!props.project?.id) return
  loading.value = true
  try {
    const result = await listEvents(props.project.id, {
      page: currentPage.value,
      pageSize: pageSize.value,
      type: selectedType.value || undefined,
      keyword: searchKeyword.value.trim() || undefined,
    })
    events.value = result.records
    totalCount.value = result.total
  } catch {
    message.error(t('claw.project.eventLoadFailed'))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.project?.id,
  (id) => {
    if (id) {
      currentPage.value = 1
      selectedType.value = ''
      loadTypes()
      loadEvents()
    }
  },
  { immediate: true }
)

// ─── Filters & pagination ────────────────────────────────────────────────────

const setTypeFilter = (type: string) => {
  selectedType.value = type
  currentPage.value = 1
  loadEvents()
}

let keywordTimer: ReturnType<typeof setTimeout> | null = null
const onKeywordChange = () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    currentPage.value = 1
    loadEvents()
  }, 300)
}

const eventTypeOptions = computed(() => [
  { value: '', label: t('claw.project.eventAllTypes') },
  ...eventTypes.value.map((type) => ({ value: type, label: type })),
])

const onPageChange = (page: number) => {
  currentPage.value = page
  loadEvents()
}

const handleRefresh = () => {
  loadTypes()
  loadEvents()
  emit('refresh')
}

// ─── 事件 CRUD ────────────────────────────────────────────────────

const showAddModal = ref(false)
const editingItem = ref<ProjectEvent | null>(null)
const viewVisible = ref(false)
const viewingItem = ref<ProjectEvent | null>(null)

const resetForm = () => {
  showAddModal.value = false
  editingItem.value = null
}

const editItem = (item: ProjectEvent) => {
  editingItem.value = item
  showAddModal.value = true
}

const openView = (item: ProjectEvent) => {
  viewingItem.value = item
  viewVisible.value = true
}

const handleAfterSave = () => {
  loadTypes()
  loadEvents()
  emit('refresh')
}

const deleteItem = async (item: ProjectEvent) => {
  try {
    await deleteEvent(item.id)
    message.success(t('claw.project.deleted'))
    if (events.value.length === 1 && currentPage.value > 1) {
      currentPage.value -= 1
    }
    loadTypes()
    loadEvents()
    emit('refresh')
  } catch {
    message.error(t('claw.project.deleteFailed'))
  }
}

const handleShare = async (item: ProjectEvent) => {
  try {
    const hash = await shareEvent(item.id)
    const url = `${siteUrl.value}/api/claw/event/share/${item.id}_${hash}`
    await copyText(url, t('claw.project.shareLinkCopied'))
    loadEvents()
  } catch {
    message.error(t('claw.event.shareFailed'))
  }
}

const handleCopyShareLink = async (item: ProjectEvent) => {
  const url = `${siteUrl.value}/claw/event/share/${item.id}_${item.shareHash}`
  window.open(url, '_blank')
}

const handleUnshare = async (item: ProjectEvent) => {
  try {
    await unshareEvent(item.id)
    message.success(t('claw.event.unshareSuccess'))
    loadEvents()
  } catch {
    message.error(t('claw.event.unshareFailed'))
  }
}

onMounted(() => {
  testActionSet('list.refresh', () => handleRefresh())
  testActionSet('list.add', () => {
    showAddModal.value = true
  })
})

onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
})
</script>
