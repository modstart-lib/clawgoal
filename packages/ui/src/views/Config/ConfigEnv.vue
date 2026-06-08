<template>
  <div>
    <LoadingState :loading="loading">
      <ListerTop :loading="loading" :total="envs.length" @refresh="loadEnvs">
        <template #actions>
          <a-button @click="openPathConfig">
            <div class="inline-flex items-center gap-1">
              <FolderOpen class="w-4 h-4" aria-hidden="true" />
              {{ $t('config.shellPath') }}
            </div>
          </a-button>
          <a-button
            v-if="envs.length > 0 || loading"
            type="primary"
            @click="openAdd"
          >
            <div class="inline-flex items-center gap-1">
              <Plus class="w-4 h-4" aria-hidden="true" />
              {{ $t('config.envAddNew') }}
            </div>
          </a-button>
        </template>
      </ListerTop>

      <div
        class="rounded-xl border border-gray-100/80 dark:border-gray-700/50 bg-surface/50 dark:bg-panel/30 backdrop-blur-md overflow-hidden"
      >
        <a-table
          :data-source="envs"
          :columns="columns"
          :pagination="false"
          row-key="name"
          :locale="{ emptyText: ' ' }"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <span class="font-mono text-sm">{{ record.name }}</span>
            </template>

            <template v-else-if="column.key === 'value'">
              <span
                v-if="visibleNames.has(record.name)"
                class="font-mono text-sm break-all"
              >
                {{ record.value }}
              </span>
              <span
                v-else
                class="font-mono text-sm text-gray-400 tracking-widest select-none"
              >
                ••••••••
              </span>
              <a-button
                type="text"
                class="ml-1 inline-flex items-center"
                @click="toggleVisible(record.name)"
              >
                <Eye
                  v-if="!visibleNames.has(record.name)"
                  class="w-4 h-4"
                  aria-hidden="true"
                />
                <EyeOff v-else class="w-4 h-4" aria-hidden="true" />
              </a-button>
            </template>

            <template v-else-if="column.key === 'actions'">
              <div class="flex gap-2 flex-wrap">
                <a-button type="default" @click="openEdit(record)">
                  <div class="inline-flex items-center gap-1">
                    <Edit class="w-4 h-4" aria-hidden="true" />
                    {{ $t('common.edit') }}
                  </div>
                </a-button>
                <a-popconfirm
                  :title="$t('config.envDeleteConfirm')"
                  :ok-text="$t('common.yes')"
                  :cancel-text="$t('common.cancel')"
                  @confirm="handleDelete(record.name)"
                >
                  <a-button type="primary" danger>
                    <div class="inline-flex items-center gap-1">
                      <Trash2 class="w-4 h-4" aria-hidden="true" />
                      {{ $t('common.delete') }}
                    </div>
                  </a-button>
                </a-popconfirm>
              </div>
            </template>
          </template>
        </a-table>

        <EmptyState v-if="!loading && envs.length === 0">
          <a-button type="primary" @click="openAdd">
            <div class="inline-flex items-center gap-1">
              <Plus class="w-4 h-4" aria-hidden="true" />
              {{ $t('config.envAddNew') }}
            </div>
          </a-button>
        </EmptyState>
      </div>
    </LoadingState>

    <ConfigEnvModal
      v-model:open="modalVisible"
      :editing-name="editingName"
      :editing-value="editingValue"
      :existing-names="envs.map((e) => e.name)"
      @saved="loadEnvs"
    />

    <ConfigEnvPath v-model:open="pathModalVisible" />
  </div>
</template>

<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import { testActionSet, testActionUnset } from '@/utils/test'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Edit from '~icons/lucide/edit'
import Eye from '~icons/lucide/eye'
import EyeOff from '~icons/lucide/eye-off'
import FolderOpen from '~icons/lucide/folder-open'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import {
  userParamEnvDelete,
  userParamEnvList,
  type EnvItem,
} from '../../api/userParam'
import ConfigEnvModal from './ConfigEnvModal.vue'
import ConfigEnvPath from './ConfigEnvPath.vue'

const { t } = useI18n()

const loading = ref(false)
const envs = ref<EnvItem[]>([])
const visibleNames = ref(new Set<string>())

const modalVisible = ref(false)
const editingName = ref<string | null>(null)
const editingValue = ref('')

const pathModalVisible = ref(false)

const columns = [
  { title: t('config.envName'), key: 'name', dataIndex: 'name', width: 280 },
  { title: t('config.envValue'), key: 'value', dataIndex: 'value' },
  { title: t('config.envActions'), key: 'actions', width: 200 },
]

async function loadEnvs() {
  loading.value = true
  try {
    envs.value = await userParamEnvList()
  } catch {
    message.error(t('config.envLoadFailed'))
  } finally {
    loading.value = false
  }
}

function toggleVisible(name: string) {
  if (visibleNames.value.has(name)) {
    visibleNames.value.delete(name)
  } else {
    visibleNames.value.add(name)
  }
}

function openAdd() {
  editingName.value = null
  editingValue.value = ''
  modalVisible.value = true
}

function openEdit(record: EnvItem) {
  editingName.value = record.name
  editingValue.value = record.value
  modalVisible.value = true
}

async function handleDelete(name: string) {
  try {
    await userParamEnvDelete(name)
    message.success(t('config.envDeleteSuccess'))
    visibleNames.value.delete(name)
    await loadEnvs()
  } catch {
    message.error(t('config.envDeleteFailed'))
  }
}

function openPathConfig() {
  pathModalVisible.value = true
}

onMounted(() => {
  loadEnvs()
  testActionSet('list.refresh', () => loadEnvs())
  testActionSet('list.add', () => openAdd())
})
onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
})
</script>
