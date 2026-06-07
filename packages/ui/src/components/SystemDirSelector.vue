<script setup lang="ts">
import { systemApi, type SystemPathItem } from '@/api/system'
import LoadingState from '@/components/LoadingState.vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ChevronRight from '~icons/lucide/chevron-right'
import Folder from '~icons/lucide/folder'
import FolderOpen from '~icons/lucide/folder-open'
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
const searchText = ref('')

const filteredDirs = computed(() => {
  const dirs = items.value.filter((i) => i.type === 'dir')
  const q = searchText.value.trim().toLowerCase()
  const list = q ? dirs.filter((i) => i.name.toLowerCase().includes(q)) : dirs
  return list.slice().sort((a, b) => a.name.localeCompare(b.name))
})

const LAST_PATH_KEY = 'systemDirSelectorLastPath'

async function navigate(dirPath?: string) {
  loading.value = true
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

function handleConfirm() {
  emit('select', currentPath.value)
  emit('update:open', false)
}

function handleCancel() {
  emit('update:open', false)
}

function handleItemClick(item: SystemPathItem) {
  if (item.type === 'dir') {
    navigate(item.path)
  }
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
    :title="t('systemDirSelector.title')"
    :confirm-loading="loading"
    :ok-text="t('systemDirSelector.ok')"
    :cancel-text="t('common.cancel')"
    width="95vw"
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="mt-2">
      <!-- 路径面包屑 -->
      <div
        class="flex items-center flex-wrap gap-1 mb-3 px-1 py-1.5 bg-primary/5 dark:bg-primary/10 rounded-lg text-sm border border-primary/10 backdrop-blur-sm"
      >
        <a-button
          type="text"
          class="inline-flex items-center h-6 px-1 text-primary hover:bg-primary/10"
          @click="navigate()"
        >
          <Home class="w-3.5 h-3.5" />
        </a-button>
        <template v-for="(part, i) in pathParts()" :key="part.path">
          <ChevronRight class="w-3 h-3 text-primary/40 shrink-0" />
          <a-button
            type="text"
            class="inline-flex items-center h-6 px-1 text-xs font-mono max-w-30 truncate text-primary hover:bg-primary/10"
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
        :placeholder="t('systemDirSelector.searchPlaceholder')"
        allow-clear
        class="mb-2"
      />

      <!-- 文件/目录列表 -->
      <div
        class="border border-primary/20 rounded-xl overflow-y-auto bg-white/50 dark:bg-gray-900/30 backdrop-blur-md"
        style="height: 300px"
      >
        <LoadingState :loading="loading">
          <!-- 返回上级 -->
          <div
            v-if="parentPath && !searchText"
            class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 border-b border-primary/10"
            @click="navigate(parentPath)"
          >
            <FolderOpen class="w-4 h-4 text-primary shrink-0" />
            <span class="text-sm font-mono">..</span>
          </div>
          <!-- 目录列表（只显示目录） -->
          <template v-for="item in filteredDirs" :key="item.path">
            <div
              class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
              @click="handleItemClick(item)"
            >
              <Folder class="w-4 h-4 text-primary shrink-0" />
              <span class="text-sm font-mono truncate"
                ><TextHighlight :text="item.name" :keyword="searchText"
              /></span>
            </div>
          </template>
          <div
            v-if="filteredDirs.length === 0 && !loading"
            class="text-center text-primary/40 py-8 text-sm"
          >
            {{
              searchText
                ? t('systemDirSelector.noMatchDir')
                : t('systemDirSelector.noSubDir')
            }}
          </div>
        </LoadingState>
      </div>

      <!-- 当前选中路径 -->
      <div
        class="mt-2 text-xs text-primary/60 font-mono truncate"
        :title="currentPath"
      >
        {{ t('systemFileSelector.selectedPrefix')
        }}{{ currentPath || t('common.loading') }}
      </div>
    </div>
  </a-modal>
</template>
