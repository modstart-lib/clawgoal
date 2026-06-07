<template>
  <div class="py-6 px-1">
    <ListerTop :loading="loading" :total="total" @refresh="loadNotes">
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="t('claw.project.noteSearchPlaceholder')"
        allow-clear
        class="w-48"
        @search="handleSearch"
        @change="handleSearchChange"
      />
      <LabelSelector
        v-if="noteTypes.length > 0"
        :model-value="selectedType"
        :options="noteTypeOptions"
        :title="t('claw.note.typeFilterTitle')"
        @update:model-value="setTypeFilter"
      />
      <template #actions>
        <a-button
          v-if="notes.length > 0 || loading"
          type="primary"
          @click="openAddModal"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ t('claw.project.noteAdd') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <!-- 加载骨架 -->
    <div v-if="loading" class="grid grid-cols-1 gap-3">
      <div
        v-for="i in 6"
        :key="i"
        class="h-36 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse"
      />
    </div>

    <!-- 笔记列表 -->
    <div v-else-if="notes.length > 0" class="grid grid-cols-1 gap-3">
      <div
        v-for="item in notes"
        :key="item.id"
        class="group relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl transition-all hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-600 overflow-hidden flex flex-col"
      >
        <!-- type 角标 -->
        <span
          v-if="item.type"
          class="absolute top-0 left-0 inline-flex items-center px-2 py-0.5 rounded-tl-xl rounded-br-lg text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-r border-b border-gray-200 dark:border-gray-700"
          >{{ item.type }}</span
        >

        <!-- 内容 -->
        <div class="p-3 flex flex-col flex-1" :class="{ 'pt-7': item.type }">
          <div class="flex-1 min-w-0">
            <!-- 标题 -->
            <h3
              class="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2"
            >
              <TextHighlight :text="item.title" :keyword="searchKeyword" />
            </h3>
            <!-- 内容预览 -->
            <p
              v-if="item.content"
              class="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed line-clamp-3 whitespace-pre-wrap"
            >
              <TextHighlight :text="item.content" :keyword="searchKeyword" />
            </p>
          </div>

          <!-- 底部：biz + 时间 + 查看 -->
          <div class="flex items-center justify-between mt-3 pr-8">
            <div
              class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500"
            >
              <span
                v-if="item.biz"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                >{{ item.biz }}</span
              >
              <div class="flex items-center gap-1">
                <Clock class="w-3 h-3" aria-hidden="true" />
                <span><DatetimeViewer :value="item.createdAt" /></span>
              </div>
            </div>
            <a-button
              type="text"
              class="!p-0 !h-auto text-xs text-primary-500 hover:text-primary-600"
              @click.stop="openViewModal(item)"
            >
              <div class="inline-flex items-center gap-0.5">
                <Eye class="w-3 h-3" aria-hidden="true" />
                {{ t('claw.project.noteView') }}
              </div>
            </a-button>
          </div>
          <!-- 操作下拉 -->
          <a-dropdown :trigger="['hover']" placement="bottomRight">
            <a-button
              type="text"
              class="absolute! bottom-2! right-2! p-1! flex items-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              @click.stop
            >
              <MoreHorizontal
                class="w-4 h-4 text-gray-500"
                aria-hidden="true"
              />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="openEditModal(item)">
                  <div class="flex items-center gap-2">
                    <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('common.edit') }}
                  </div>
                </a-menu-item>
                <a-menu-item
                  v-if="canShare && !item.shareHash"
                  @click="handleShareNote(item)"
                >
                  <div class="flex items-center gap-2">
                    <Share2 class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('claw.project.noteShare') }}
                  </div>
                </a-menu-item>
                <template v-else-if="canShare && item.shareHash">
                  <a-menu-item @click="handleCopyShareLinkNote(item)">
                    <div class="flex items-center gap-2">
                      <Link2 class="w-3.5 h-3.5" aria-hidden="true" />
                      {{ t('claw.project.noteShareLink') }}
                    </div>
                  </a-menu-item>
                  <a-menu-item @click="handleUnshareNote(item)">
                    <div class="flex items-center gap-2">
                      <ShareOff class="w-3.5 h-3.5" aria-hidden="true" />
                      {{ t('claw.project.noteUnshare') }}
                    </div>
                  </a-menu-item>
                </template>
                <a-menu-item
                  class="!text-red-500"
                  @click="confirmDeleteNote(item)"
                >
                  <div class="flex items-center gap-2">
                    <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('common.delete') }}
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
    </div>

    <!-- 搜索无结果 -->
    <div
      v-else-if="searchKeyword"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <SearchX
        class="w-14 h-14 text-gray-200 dark:text-gray-600 mb-4"
        aria-hidden="true"
      />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('claw.project.noteSearchEmpty') }}
      </p>
      <a-button class="mt-4" @click="clearSearch">{{
        t('claw.project.noteSearchClear')
      }}</a-button>
    </div>

    <!-- 空状态 -->
    <EmptyState v-else :description="t('claw.project.noteEmptyDesc')">
      <a-button type="primary" @click="openAddModal">
        <div class="inline-flex items-center gap-1">
          <Plus class="w-4 h-4" aria-hidden="true" />
          {{ t('claw.project.noteAdd') }}
        </div>
      </a-button>
    </EmptyState>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="flex justify-center mt-6">
      <a-pagination
        v-model:current="currentPage"
        :total="total"
        :page-size="pageSize"
        show-less-items
        @change="loadNotes"
      />
    </div>

    <!-- 编辑 / 新增 Modal -->
    <NoteEditModal
      v-model:open="showModal"
      :project-id="project.id"
      :editing-item="editingItem"
      :project-types="noteTypes"
      @refresh="handleAfterSave"
    />

    <!-- 查看 Modal -->
    <NoteViewModal v-model:open="showViewModal" :note="viewingNote" />
  </div>
</template>

<script setup lang="ts">
import type { ProjectItem } from '@/claw/api/project'
import {
  deleteNote,
  paginateNotes,
  listNoteTypes,
  shareNote,
  unshareNote,
  type Note,
} from '@/claw/api/note'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import EmptyState from '@/components/EmptyState.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import ListerTop from '@/components/ListerTop.vue'
import TextHighlight from '@/components/TextHighlight.vue'
import { useAppEnvComputed } from '@/composables/setting'
import { copyText } from '@/utils/utils'
import { message, Modal } from 'ant-design-vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Clock from '~icons/lucide/clock'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import SearchX from '~icons/lucide/search-x'
import Eye from '~icons/lucide/eye'
import Share2 from '~icons/lucide/share-2'
import Link2 from '~icons/lucide/link-2'
import ShareOff from '~icons/lucide/link-2-off'
import Trash2 from '~icons/lucide/trash-2'
import NoteEditModal from './NoteEditModal.vue'
import NoteViewModal from './NoteViewModal.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const { viewMode, siteUrl } = useAppEnvComputed()
const canShare = computed(() => viewMode.value !== 'client')

function confirmDeleteNote(item: Note) {
  Modal.confirm({
    title: t('claw.project.noteDeleteConfirm'),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: () => doDeleteNote(item),
  })
}

const props = defineProps<{ project: ProjectItem }>()
const emit = defineEmits<{ (e: 'refresh'): void }>()

const notes = ref<Note[]>([])
const noteTypes = ref<string[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingItem = ref<Note | null>(null)
const selectedType = ref('')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

let searchTimer: ReturnType<typeof setTimeout> | null = null

const handleSearchChange = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    loadNotes()
  }, 400)
}

const handleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  currentPage.value = 1
  loadNotes()
}

const clearSearch = () => {
  searchKeyword.value = ''
  currentPage.value = 1
  loadNotes()
}

const loadNotes = async () => {
  loading.value = true
  try {
    const [result, types] = await Promise.all([
      paginateNotes(props.project.id, {
        type: selectedType.value || undefined,
        keyword: searchKeyword.value.trim() || undefined,
        page: currentPage.value,
        pageSize: pageSize.value,
      }),
      listNoteTypes(props.project.id),
    ])
    notes.value = result.records
    total.value = result.total
    noteTypes.value = types
  } catch {
    message.error(t('claw.project.noteLoadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadNotes()
  testActionSet('list.refresh', () => loadNotes())
  testActionSet('list.add', () => openAddModal())
})

onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
})

watch(
  () => props.project.id,
  () => {
    currentPage.value = 1
    loadNotes()
  }
)

const setTypeFilter = async (type: string) => {
  selectedType.value = type
  currentPage.value = 1
  await loadNotes()
}

const noteTypeOptions = computed(() => [
  { value: '', label: t('claw.project.noteAllTypes') },
  ...noteTypes.value.map((type) => ({ value: type, label: type })),
])

const openAddModal = () => {
  editingItem.value = null
  showModal.value = true
}

const openEditModal = async (item: Note) => {
  editingItem.value = null
  await nextTick()
  editingItem.value = item
  showModal.value = true
}

const showViewModal = ref(false)
const viewingNote = ref<Note | null>(null)

const openViewModal = (item: Note) => {
  viewingNote.value = item
  showViewModal.value = true
}

const handleAfterSave = async () => {
  await loadNotes()
  emit('refresh')
}

const doDeleteNote = async (item: Note) => {
  try {
    await deleteNote(item.id)
    message.success(t('claw.project.noteDeleted'))
    await loadNotes()
    emit('refresh')
  } catch {
    message.error(t('claw.project.noteDeleteFailed'))
  }
}

const handleShareNote = async (item: Note) => {
  try {
    const hash = await shareNote(item.id)
    const url = `${siteUrl.value}/api/claw/note/share/${item.id}_${hash}`
    await copyText(url, t('claw.project.shareLinkCopied'))
    await loadNotes()
  } catch {
    message.error(t('claw.project.noteShareFailed'))
  }
}

const handleCopyShareLinkNote = (item: Note) => {
  const url = `${siteUrl.value}/claw/note/share/${item.id}_${item.shareHash}`
  window.open(url, '_blank')
}

const handleUnshareNote = async (item: Note) => {
  try {
    await unshareNote(item.id)
    message.success(t('claw.project.noteUnshareSuccess'))
    await loadNotes()
  } catch {
    message.error(t('claw.project.noteUnshareFailed'))
  }
}
</script>
