<script setup lang="ts">
import {
  deleteFile,
  getFilesTree,
  readFile,
  renameFile,
  writeFile,
  type FileNode,
} from '@/api/file.ts'
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Edit2 from '~icons/lucide/edit-2'
import File from '~icons/lucide/file'
import FilePlus from '~icons/lucide/file-plus'
import Folder from '~icons/lucide/folder'
import FolderOpen from '~icons/lucide/folder-open'
import Home from '~icons/lucide/home'
import PenLine from '~icons/lucide/pen-line'
import RefreshCw from '~icons/lucide/refresh-cw'
import Trash2 from '~icons/lucide/trash-2'
import DataFileAddModal from './SettingFile/SettingFileAddModal.vue'
import DataFileEditModal from './SettingFile/SettingFileEditModal.vue'
import DataFileRenameModal from './SettingFile/SettingFileRenameModal.vue'

const { t } = useI18n()

const rootNodes = ref<FileNode[]>([])
const loading = ref(false)

const pathSegments = ref<string[]>([])

const editVisible = ref(false)
const editPath = ref('')
const editContent = ref('')
const editSaving = ref(false)

const renameVisible = ref(false)
const renameSrcPath = ref('')
const renameNewName = ref('')
const renameLoading = ref(false)

const addFileVisible = ref(false)
const addFilePath = ref('')
const addFileContent = ref('')
const addFileSaving = ref(false)

function formatSize(bytes?: number): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function isTextFile(name: string): boolean {
  const textExts = [
    '.txt',
    '.md',
    '.json',
    '.yaml',
    '.yml',
    '.log',
    '.csv',
    '.toml',
    '.ini',
    '.cfg',
    '.conf',
    '.sh',
    '.js',
    '.ts',
    '.py',
    '.sql',
    '.xml',
    '.html',
    '.css',
  ]
  const lower = name.toLowerCase()
  return textExts.some((ext) => lower.endsWith(ext))
}

function getFileIconColor(name: string): string {
  const lower = name.toLowerCase()
  if (['.json', '.yaml', '.yml', '.toml'].some((e) => lower.endsWith(e)))
    return 'text-orange-400'
  if (['.md', '.txt'].some((e) => lower.endsWith(e))) return 'text-primary-400'
  if (['.js', '.ts'].some((e) => lower.endsWith(e))) return 'text-yellow-400'
  if (['.py'].some((e) => lower.endsWith(e))) return 'text-green-400'
  if (['.log'].some((e) => lower.endsWith(e))) return 'text-gray-400'
  if (['.sql'].some((e) => lower.endsWith(e))) return 'text-primary-500'
  if (['.sh'].some((e) => lower.endsWith(e))) return 'text-red-400'
  if (['.csv'].some((e) => lower.endsWith(e))) return 'text-teal-400'
  return 'text-gray-400'
}

const currentNodes = computed<FileNode[]>(() => {
  let nodes = rootNodes.value
  for (const seg of pathSegments.value) {
    const dir = nodes.find((n) => n.name === seg && n.type === 'dir')
    if (!dir?.children) return []
    nodes = dir.children
  }
  const dirs = nodes
    .filter((n) => n.type === 'dir')
    .sort((a, b) => a.name.localeCompare(b.name))
  const files = nodes
    .filter((n) => n.type === 'file')
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...dirs, ...files]
})

async function loadTree(showToast = false) {
  loading.value = true
  try {
    rootNodes.value = await getFilesTree()
    if (showToast) message.success(t('settingFile.loadSuccess'))
  } catch (e: any) {
    message.error(e?.message || t('settingFile.loadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(loadTree)

function enterDir(node: FileNode) {
  pathSegments.value = [...pathSegments.value, node.name]
}

function navigateTo(index: number) {
  pathSegments.value = index < 0 ? [] : pathSegments.value.slice(0, index + 1)
}

async function openEdit(node: FileNode) {
  editPath.value = node.path
  editContent.value = ''
  editVisible.value = true
  try {
    editContent.value = await readFile(node.path)
  } catch (e: any) {
    message.error(e?.message || t('settingFile.readFailed'))
    editVisible.value = false
  }
}

async function saveEdit() {
  editSaving.value = true
  try {
    await writeFile(editPath.value, editContent.value)
    message.success(t('settingFile.saveSuccess'))
    editVisible.value = false
  } catch (e: any) {
    message.error(e?.message || t('settingFile.saveFailed'))
  } finally {
    editSaving.value = false
  }
}

function openRename(node: FileNode) {
  renameSrcPath.value = node.path
  renameNewName.value = node.name
  renameVisible.value = true
}

async function doRename() {
  renameLoading.value = true
  try {
    const dir = renameSrcPath.value.includes('/')
      ? renameSrcPath.value.substring(0, renameSrcPath.value.lastIndexOf('/'))
      : ''
    const newPath = dir ? `${dir}/${renameNewName.value}` : renameNewName.value
    await renameFile(renameSrcPath.value, newPath)
    message.success(t('settingFile.renameSuccess'))
    renameVisible.value = false
    await loadTree()
  } catch (e: any) {
    message.error(e?.message || t('settingFile.renameFailed'))
  } finally {
    renameLoading.value = false
  }
}

async function doDelete(node: FileNode) {
  try {
    await deleteFile(node.path)
    message.success(t('settingFile.deleteSuccess'))
    await loadTree()
  } catch (e: any) {
    message.error(e?.message || t('settingFile.deleteFailed'))
  }
}

function openCreateFile() {
  const prefix =
    pathSegments.value.length > 0 ? pathSegments.value.join('/') + '/' : ''
  addFilePath.value = prefix
  addFileContent.value = ''
  addFileVisible.value = true
}

async function doCreateFile() {
  if (!addFilePath.value.trim()) {
    message.warning(t('settingFile.pathRequired'))
    return
  }
  addFileSaving.value = true
  try {
    await writeFile(addFilePath.value.trim(), addFileContent.value)
    message.success(t('settingFile.addSuccess'))
    addFileVisible.value = false
    await loadTree()
  } catch (e: any) {
    message.error(e?.message || t('settingFile.addFailed'))
  } finally {
    addFileSaving.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-1 text-sm flex-wrap">
        <a-button
          type="text"
          class="!px-0 flex items-center gap-1"
          @click="navigateTo(-1)"
        >
          <Home class="w-3.5 h-3.5" aria-hidden="true" />
          <span>data</span>
        </a-button>
        <template v-for="(seg, idx) in pathSegments" :key="idx">
          <span class="text-gray-400">/</span>
          <a-button
            type="text"
            class="!px-0"
            :class="
              idx === pathSegments.length - 1
                ? '!text-gray-800 dark:!text-gray-100 font-medium cursor-default pointer-events-none'
                : ''
            "
            @click="navigateTo(idx)"
            >{{ seg }}</a-button
          >
        </template>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <a-button type="default" @click="openCreateFile">
          <div class="inline-flex items-center gap-1">
            <FilePlus class="w-4 h-4" aria-hidden="true" />
            {{ $t('settingFile.newFile') }}
          </div>
        </a-button>
        <a-button
          type="default"
          :loading="loading"
          @click="() => loadTree(true)"
        >
          <div class="inline-flex items-center gap-1">
            <RefreshCw class="w-4 h-4" aria-hidden="true" />
            {{ $t('common.refresh') }}
          </div>
        </a-button>
      </div>
    </div>

    <LoadingState :loading="loading">
      <div
        v-if="currentNodes.length === 0 && !loading"
        class="text-center py-16 text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg"
      >
        {{ $t('settingFile.noFiles') }}
      </div>
      <div
        v-else
        class="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden"
      >
        <div
          v-for="(node, idx) in currentNodes"
          :key="node.path"
          class="group flex items-center gap-2 px-3 h-10 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none cursor-default"
          :class="
            idx !== currentNodes.length - 1
              ? 'border-b border-gray-100 dark:border-gray-700'
              : ''
          "
        >
          <Folder
            v-if="node.type === 'dir'"
            class="w-4 h-4 shrink-0 text-yellow-400"
          />
          <File
            v-else
            :class="['w-4 h-4 shrink-0', getFileIconColor(node.name)]"
          />

          <span
            class="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate"
            :class="
              node.type === 'dir' ? 'cursor-pointer hover:text-primary-500' : ''
            "
            @click="node.type === 'dir' ? enterDir(node) : undefined"
          >
            {{ node.name
            }}<span
              v-if="node.type === 'file' && node.size != null"
              class="text-xs text-gray-400 ml-1"
              >({{ formatSize(node.size) }})</span
            >
          </span>

          <div
            class="invisible group-hover:visible flex items-center gap-1 shrink-0"
          >
            <a-button
              v-if="node.type === 'dir'"
              type="default"
              @click.stop="enterDir(node)"
            >
              <div class="inline-flex items-center gap-1">
                <FolderOpen class="w-4 h-4" aria-hidden="true" />
                {{ $t('settingFile.open') }}
              </div>
            </a-button>
            <a-button
              v-if="node.type === 'file' && isTextFile(node.name)"
              type="default"
              @click.stop="openEdit(node)"
            >
              <div class="inline-flex items-center gap-1">
                <Edit2 class="w-4 h-4" aria-hidden="true" />
                {{ $t('common.edit') }}
              </div>
            </a-button>
            <a-button type="default" @click.stop="openRename(node)">
              <div class="inline-flex items-center gap-1">
                <PenLine class="w-4 h-4" aria-hidden="true" />
                {{ $t('settingFile.rename') }}
              </div>
            </a-button>
            <a-popconfirm
              :title="`${$t('settingFile.confirmDelete')} &quot;${node.name}&quot;?`"
              :ok-text="$t('common.delete')"
              :cancel-text="$t('common.cancel')"
              @confirm="doDelete(node)"
            >
              <a-button type="primary" danger @click.stop>
                <div class="inline-flex items-center gap-1">
                  <Trash2 class="w-4 h-4" aria-hidden="true" />
                  {{ $t('common.delete') }}
                </div>
              </a-button>
            </a-popconfirm>
          </div>
        </div>
      </div>
    </LoadingState>

    <DataFileEditModal
      v-model:open="editVisible"
      :file-path="editPath"
      :content="editContent"
      :saving="editSaving"
      @update:content="editContent = $event"
      @save="saveEdit"
    />

    <DataFileRenameModal
      v-model:open="renameVisible"
      :new-name="renameNewName"
      :loading="renameLoading"
      @update:new-name="renameNewName = $event"
      @confirm="doRename"
    />

    <DataFileAddModal
      v-model:open="addFileVisible"
      :file-path="addFilePath"
      :content="addFileContent"
      :saving="addFileSaving"
      @update:file-path="addFilePath = $event"
      @update:content="addFileContent = $event"
      @create="doCreateFile"
    />
  </div>
</template>
