<template>
  <div class="py-6 px-1">
    <ListerTop :loading="loading" :total="total" @refresh="loadWikis">
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="t('claw.project.wikiSearchPlaceholder')"
        allow-clear
        class="w-48"
        @search="handleSearch"
        @change="handleSearchChange"
      />
      <a-button @click="syncHistoryVisible = true">
        <div class="inline-flex items-center gap-1">
          <History class="w-4 h-4" aria-hidden="true" />
          {{ t('claw.project.wikiSyncHistory') }}
        </div>
      </a-button>
      <a-button @click="batchSyncVisible = true">
        <div class="inline-flex items-center gap-1">
          <ListPlus class="w-4 h-4" aria-hidden="true" />
          {{ t('claw.project.wikiBatchSync') }}
        </div>
      </a-button>
      <template #actions>
        <a-button
          v-if="wikis.length > 0 || loading"
          type="primary"
          @click="openAddModal"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ t('claw.project.wikiAdd') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <!-- 加载骨架 -->
    <div v-if="loading" class="grid grid-cols-3 2xl:grid-cols-4 gap-3">
      <div
        v-for="i in 6"
        :key="i"
        class="h-40 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse"
      />
    </div>

    <!-- 知识库列表 -->
    <div
      v-else-if="wikis.length > 0"
      class="grid grid-cols-3 2xl:grid-cols-4 gap-3"
    >
      <div
        v-for="item in wikis"
        :key="item.id"
        class="group relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl transition-all hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-600 overflow-hidden flex flex-col"
      >
        <!-- 状态角标 -->
        <span
          class="absolute top-0 left-0 inline-flex items-center px-2 py-0.5 rounded-tl-xl rounded-br-lg text-xs font-medium border-r border-b"
          :class="statusClass(item.status)"
        >
          <Loader2
            v-if="item.status === 'processing'"
            class="w-3 h-3 mr-1 animate-spin"
            aria-hidden="true"
          />
          {{ t(`claw.project.wikiStatus${capitalize(item.status)}`) }}
        </span>
        <!-- 类型角标（syncUrl 类型） -->
        <span
          v-if="item.type === 'syncUrl'"
          class="absolute top-0 right-0 inline-flex items-center px-2 py-0.5 rounded-tr-xl rounded-bl-lg text-xs font-medium border-l border-b bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-gray-200 dark:border-gray-700"
        >
          <RefreshCw class="w-3 h-3 mr-1" aria-hidden="true" />
          {{ t('claw.project.wikiTypeSyncUrl') }}
        </span>
        <!-- 类型角标（syncPath 类型） -->
        <span
          v-if="item.type === 'syncPath'"
          class="absolute top-0 right-0 inline-flex items-center px-2 py-0.5 rounded-tr-xl rounded-bl-lg text-xs font-medium border-l border-b bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800"
        >
          <FolderSync class="w-3 h-3 mr-1" aria-hidden="true" />
          {{ t('claw.project.wikiTypeSyncPath') }}
        </span>

        <!-- 内容 -->
        <div class="p-3 flex flex-col flex-1 pt-7">
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
            <!-- 同步 URL（syncUrl 类型） -->
            <a
              v-if="item.type === 'syncUrl' && item.syncUrl"
              :href="item.syncUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-2 flex items-center gap-1 text-xs text-primary-500 hover:underline truncate"
              @click.stop
            >
              <RefreshCw class="w-3 h-3 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ item.syncUrl }}</span>
            </a>
            <!-- 来源链接 -->
            <a
              v-if="item.sourceUrl"
              :href="item.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-2 flex items-center gap-1 text-xs text-primary-500 hover:underline truncate"
              @click.stop
            >
              <Link class="w-3 h-3 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ item.sourceUrl }}</span>
            </a>
          </div>

          <!-- 底部：biz + 时间 -->
          <div class="flex items-center mt-3 pr-8">
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
                <a-menu-item
                  v-if="item.type === 'syncUrl' || item.type === 'syncPath'"
                  :disabled="syncingIds.has(item.id)"
                  @click="syncWiki(item)"
                >
                  <div class="flex items-center gap-2">
                    <FolderSync class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('claw.project.wikiSyncNow') }}
                  </div>
                </a-menu-item>
                <a-menu-item @click="openEditModal(item)">
                  <div class="flex items-center gap-2">
                    <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('common.edit') }}
                  </div>
                </a-menu-item>
                <a-menu-item
                  class="!text-red-500"
                  @click="confirmDeleteWiki(item)"
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
        {{ t('claw.project.wikiSearchEmpty') }}
      </p>
      <a-button class="mt-4" @click="clearSearch">{{
        t('claw.project.wikiSearchClear')
      }}</a-button>
    </div>

    <!-- 空状态 -->
    <EmptyState v-else :description="t('claw.project.wikiEmptyDesc')">
      <a-button type="primary" @click="openAddModal">
        <div class="inline-flex items-center gap-1">
          <Plus class="w-4 h-4" aria-hidden="true" />
          {{ t('claw.project.wikiAdd') }}
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
        @change="loadWikis"
      />
    </div>

    <!-- 编辑 / 新增 Modal -->
    <WikiEditModal
      v-model:open="showModal"
      :project-id="projectId"
      :editing-item="editingItem"
      @refresh="handleAfterSave"
    />
    <!-- 同步历史 Modal -->
    <WikiSyncHistoryModal
      v-model:open="syncHistoryVisible"
      :project-id="projectId"
    />
    <!-- 批量同步 Modal -->
    <WikiBatchSyncModal
      v-model:open="batchSyncVisible"
      :project-id="projectId"
      @refresh="handleAfterSave"
    />
  </div>
</template>

<script setup lang="ts">
import {
  deleteWiki,
  paginateWikis,
  triggerWikiSync,
  type Wiki,
} from '@/claw/api/wiki'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import EmptyState from '@/components/EmptyState.vue'
import ListerTop from '@/components/ListerTop.vue'
import TextHighlight from '@/components/TextHighlight.vue'
import { message, Modal } from 'ant-design-vue'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Clock from '~icons/lucide/clock'
import FolderSync from '~icons/lucide/folder-sync'
import History from '~icons/lucide/history'
import Link from '~icons/lucide/link'
import ListPlus from '~icons/lucide/list-plus'
import Loader2 from '~icons/lucide/loader-2'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import RefreshCw from '~icons/lucide/refresh-cw'
import SearchX from '~icons/lucide/search-x'
import Trash2 from '~icons/lucide/trash-2'
import WikiBatchSyncModal from './WikiBatchSyncModal.vue'
import WikiEditModal from './WikiEditModal.vue'
import WikiSyncHistoryModal from './WikiSyncHistoryModal.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

function confirmDeleteWiki(item: Wiki) {
  Modal.confirm({
    title: t('claw.project.wikiDeleteConfirm'),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: () => doDeleteWiki(item),
  })
}

const props = defineProps<{ projectId: number }>()

const wikis = ref<Wiki[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingItem = ref<Wiki | null>(null)
const searchKeyword = ref('')
const syncHistoryVisible = ref(false)
const syncingIds = ref<Set<number>>(new Set())
const batchSyncVisible = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

let searchTimer: ReturnType<typeof setTimeout> | null = null

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function statusClass(status: string) {
  if (status === 'processing')
    return 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-800'
  if (status === 'fail')
    return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800'
  return 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800'
}

const handleSearchChange = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    loadWikis()
  }, 400)
}

const handleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  currentPage.value = 1
  loadWikis()
}

const clearSearch = () => {
  searchKeyword.value = ''
  currentPage.value = 1
  loadWikis()
}

const loadWikis = async () => {
  loading.value = true
  try {
    const result = await paginateWikis(props.projectId, {
      keyword: searchKeyword.value.trim() || undefined,
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    wikis.value = result.records
    total.value = result.total
  } catch {
    message.error(t('claw.project.wikiLoadFailed'))
  } finally {
    loading.value = false
  }
}

const openAddModal = () => {
  editingItem.value = null
  showModal.value = true
}

const openEditModal = async (item: Wiki) => {
  editingItem.value = null
  await nextTick()
  editingItem.value = item
  showModal.value = true
}

const doDeleteWiki = async (item: Wiki) => {
  try {
    await deleteWiki(item.id)
    message.success(t('claw.project.wikiDeleted'))
    await loadWikis()
  } catch {
    message.error(t('claw.project.wikiDeleteFailed'))
  }
}

const syncWiki = async (item: Wiki) => {
  if (syncingIds.value.has(item.id)) return
  syncingIds.value = new Set([...syncingIds.value, item.id])
  try {
    await triggerWikiSync(item.id)
    message.success(t('claw.project.wikiSyncTriggered'))
  } catch {
    message.error(t('claw.project.wikiSyncTriggerFailed'))
  } finally {
    syncingIds.value = new Set(
      [...syncingIds.value].filter((id) => id !== item.id)
    )
  }
}

const handleAfterSave = () => {
  loadWikis()
}

watch(
  () => props.projectId,
  () => {
    currentPage.value = 1
    loadWikis()
  }
)

onMounted(() => {
  loadWikis()
  testActionSet('list.refresh', () => loadWikis())
  testActionSet('list.search', (kw: string) => {
    searchKeyword.value = kw ?? ''
    currentPage.value = 1
    loadWikis()
  })
  testActionSet('list.add', () => openAddModal())
  testActionSet('wiki.openBatchSync', () => {
    batchSyncVisible.value = true
  })
  testActionSet('wiki.openSyncHistory', () => {
    syncHistoryVisible.value = true
  })
})

onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.search')
  testActionUnset('list.add')
  testActionUnset('wiki.openBatchSync')
  testActionUnset('wiki.openSyncHistory')
})
</script>
