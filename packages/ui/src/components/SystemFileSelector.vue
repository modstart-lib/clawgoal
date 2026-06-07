<script setup lang="ts">
import { systemApi, type SystemPathItem } from '@/api/system'
import LoadingState from '@/components/LoadingState.vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ChevronRight from '~icons/lucide/chevron-right'
import File from '~icons/lucide/file'
import Folder from '~icons/lucide/folder'
import Home from '~icons/lucide/home'

import TextHighlight from './TextHighlight.vue'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
}>()

watch(
  () => props.open,
  (val) => {
    if (val) handleOpen()
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [path: string]
}>()

const currentPath = ref('')
const parentPath = ref<string | null>(null)
const items = ref<SystemPathItem[]>([])
const loading = ref(false)
const selectedFile = ref('')
const searchText = ref('')

const filteredItems = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  const list = q
    ? items.value.filter((i) => i.name.toLowerCase().includes(q))
    : items.value
  return list.slice().sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
})

const LAST_PATH_KEY = 'systemFileSelectorLastPath'

async function navigate(dirPath?: string) {
  loading.value = true
  selectedFile.value = ''
  searchText.value = ''
  try {
    const result = await systemApi.pathList(dirPath)
    currentPath.value = result.path
    parentPath.value = result.parentPath
    items.value = result.items
    localStorage.setItem(LAST_PATH_KEY, result.path)
  } finally {
    loading.value = false
  }
}

async function handleOpen() {
  const lastPath = localStorage.getItem(LAST_PATH_KEY)
  await navigate(lastPath || undefined)
}

function handleItemClick(item: SystemPathItem) {
  if (item.type === 'dir') {
    navigate(item.path)
  } else {
    selectedFile.value = item.path
  }
}

function handleConfirm() {
  if (!selectedFile.value) return
  emit('select', selectedFile.value)
  emit('update:open', false)
}

function handleCancel() {
  emit('update:open', false)
}

const pathParts = () => {
  if (!currentPath.value) return []
  const sep = currentPath.value.includes('\\') ? '\\' : '/'
  const parts = currentPath.value.split(sep).filter(Boolean)
  return parts.map((name, i) => ({
    name: name || sep,
    path: sep + parts.slice(0, i + 1).join(sep),
  }))
}
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="t('systemFileSelector.title')"
    :confirm-loading="loading"
    :ok-button-props="{ disabled: !selectedFile }"
    :ok-text="t('systemFileSelector.ok')"
    :cancel-text="t('common.cancel')"
    width="95vw"
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="mt-2">
      <!-- 路径面包屑 -->
      <div
        class="flex items-center flex-wrap gap-1 mb-3 px-1 py-1.5 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg text-sm border border-gray-100/50 dark:border-gray-700/50 backdrop-blur-sm"
      >
        <a-button
          type="text"
          class="inline-flex items-center h-6 px-1"
          @click="navigate()"
        >
          <Home class="w-3.5 h-3.5" />
        </a-button>
        <template v-for="(part, i) in pathParts()" :key="part.path">
          <ChevronRight class="w-3 h-3 text-gray-400 shrink-0" />
          <a-button
            type="text"
            class="inline-flex items-center h-6 px-1 text-xs font-mono max-w-30 truncate"
            :title="part.name"
            :disabled="i === pathParts().length - 1"
            @click="navigate(part.path)"
            >{{ part.name }}</a-button
          >
        </template>
      </div>

      <!-- 搜索框 -->
      <a-input-search
        v-model:value="searchText"
        :placeholder="t('systemFileSelector.searchPlaceholder')"
        allow-clear
        class="mb-2"
      />

      <!-- 文件/目录列表 -->
      <div
        class="border border-gray-100/80 dark:border-gray-700/50 rounded-xl overflow-y-auto bg-white/50 dark:bg-gray-900/30 backdrop-blur-md"
        style="height: 300px"
      >
        <LoadingState :loading="loading">
          <!-- 返回上级 -->
          <div
            v-if="parentPath && !searchText"
            class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/80 border-b border-gray-100/50 dark:border-gray-700/50"
            @click="navigate(parentPath)"
          >
            <Folder class="w-4 h-4 text-yellow-500 shrink-0" />
            <span class="text-sm font-mono">..</span>
          </div>
          <!-- 列表 -->
          <template v-for="item in filteredItems" :key="item.path">
            <div
              class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
              :class="[
                selectedFile === item.path
                  ? 'bg-primary-100/80 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 font-medium'
                  : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/80',
              ]"
              @click="handleItemClick(item)"
            >
              <Folder
                v-if="item.type === 'dir'"
                class="w-4 h-4 text-yellow-500 shrink-0"
              />
              <File v-else class="w-4 h-4 text-gray-400 shrink-0" />
              <span class="text-sm font-mono truncate"
                ><TextHighlight :text="item.name" :keyword="searchText"
              /></span>
            </div>
          </template>
          <div
            v-if="filteredItems.length === 0 && !loading"
            class="text-center text-gray-400 py-8 text-sm"
          >
            {{
              searchText
                ? t('systemFileSelector.noMatchFile')
                : t('systemFileSelector.emptyDir')
            }}
          </div>
        </LoadingState>
      </div>

      <!-- 已选文件路径 -->
      <div class="mt-2 text-xs font-mono truncate" :title="selectedFile">
        <span class="text-gray-500">{{
          t('systemFileSelector.selectedPrefix')
        }}</span>
        <span
          :class="
            selectedFile
              ? 'text-primary-600 dark:text-primary-400 font-medium'
              : 'text-gray-400'
          "
        >
          {{ selectedFile || t('systemFileSelector.clickToSelect') }}
        </span>
      </div>
    </div>
  </a-modal>
</template>
