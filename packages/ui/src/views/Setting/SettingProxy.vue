<template>
  <div>
    <LoadingState :loading="loading">
      <ListerTop
        :loading="loading"
        :total="proxies.length"
        @refresh="loadConfig"
      >
        <template #actions>
          <a-button type="primary" @click="openAdd">
            <div class="inline-flex items-center gap-1">
              <Plus class="w-4 h-4" aria-hidden="true" />
              {{ $t('config.proxyAddNew') }}
            </div>
          </a-button>
        </template>
      </ListerTop>

      <!-- Proxy Table -->
      <div
        class="rounded-xl border border-gray-100/80 dark:border-gray-700/50 bg-surface/50 dark:bg-panel/30 backdrop-blur-md overflow-hidden"
      >
        <a-table
          :data-source="proxies"
          :columns="columns"
          :pagination="false"
          row-key="name"
          :locale="{ emptyText: $t('config.proxyNoData') }"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'type'">
              <a-tag :color="record.type === 'socks5' ? 'purple' : 'blue'">
                {{ record.type === 'socks5' ? 'SOCKS5' : 'HTTP' }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'info'">
              <div class="flex flex-col gap-1 py-1">
                <div class="flex items-center gap-1.5">
                  <Globe
                    class="w-3.5 h-3.5 text-primary shrink-0"
                    aria-hidden="true"
                  />
                  <span
                    class="text-xs font-mono text-gray-600 dark:text-gray-300"
                  >
                    {{ record.host }}:{{ record.port }}
                  </span>
                </div>
                <div v-if="record.username" class="flex items-center gap-1.5">
                  <User
                    class="w-3.5 h-3.5 text-gray-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{
                    record.username
                  }}</span>
                </div>
              </div>
            </template>

            <template v-else-if="column.key === 'url'">
              <span
                class="text-xs font-mono text-gray-500 dark:text-gray-400 break-all"
              >
                {{ proxyUrl(record) || '—' }}
              </span>
            </template>

            <template v-else-if="column.key === 'actions'">
              <div class="flex gap-2 flex-wrap">
                <a-button type="default" @click="openTest(record)">
                  <div class="inline-flex items-center gap-1">
                    <Wifi class="w-4 h-4" aria-hidden="true" />
                    {{ $t('config.proxyTest') }}
                  </div>
                </a-button>
                <a-button type="default" @click="openEdit(index)">
                  <div class="inline-flex items-center gap-1">
                    <Edit class="w-4 h-4" aria-hidden="true" />
                    {{ $t('common.edit') }}
                  </div>
                </a-button>
                <a-popconfirm
                  :title="$t('config.proxyDeleteConfirm')"
                  :ok-text="$t('common.yes')"
                  :cancel-text="$t('common.cancel')"
                  @confirm="removeProxy(index)"
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
      </div>
    </LoadingState>

    <!-- Test Modal -->
    <SettingProxyTestModal
      v-model:open="testModalVisible"
      :proxy="testingProxy"
    />

    <!-- Edit Modal -->
    <SettingProxyEditModal
      v-model:open="modalVisible"
      :initial-data="editingData"
      @submit="onModalSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Edit from '~icons/lucide/edit'
import Globe from '~icons/lucide/globe'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import User from '~icons/lucide/user'
import Wifi from '~icons/lucide/wifi'
import {
  getProxyConfigs,
  saveProxyConfigs,
  type ProxyConfig,
} from '../../api/config'
import SettingProxyEditModal from './SettingProxy/SettingProxyEditModal.vue'
import SettingProxyTestModal from './SettingProxy/SettingProxyTestModal.vue'

const { t } = useI18n()

const loading = ref(false)
const proxies = ref<ProxyConfig[]>([])

const modalVisible = ref(false)
const editingData = ref<ProxyConfig | null>(null)
const editingIndex = ref(-1)

const testModalVisible = ref(false)
const testingProxy = ref<ProxyConfig | null>(null)

const columns = [
  { title: t('config.proxyName'), dataIndex: 'name', key: 'name', width: 140 },
  { title: t('config.proxyType'), dataIndex: 'type', key: 'type', width: 100 },
  { title: t('config.proxyHost'), key: 'info' },
  { title: t('config.proxy'), key: 'url' },
  { title: t('config.actions'), key: 'actions', width: 220 },
]

function proxyUrl(p: ProxyConfig): string {
  if (!p.host || !p.port) return ''
  const proto = p.type === 'socks5' ? 'socks5' : 'http'
  const auth = p.username ? `${p.username}:***@` : ''
  return `${proto}://${auth}${p.host}:${p.port}`
}

function openTest(proxy: ProxyConfig) {
  testingProxy.value = proxy
  testModalVisible.value = true
}

function openAdd() {
  editingIndex.value = -1
  editingData.value = null
  modalVisible.value = true
}

function openEdit(idx: number) {
  editingIndex.value = idx
  editingData.value = { ...proxies.value[idx] }
  modalVisible.value = true
}

async function onModalSubmit(entry: ProxyConfig) {
  if (editingIndex.value === -1) {
    proxies.value.push(entry)
  } else {
    proxies.value[editingIndex.value] = entry
  }
  await doSave()
}

async function removeProxy(idx: number) {
  proxies.value.splice(idx, 1)
  await doSave()
}

async function loadConfig() {
  loading.value = true
  try {
    proxies.value = await getProxyConfigs()
  } catch {
    message.error(t('config.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function doSave() {
  try {
    await saveProxyConfigs(proxies.value)
    message.success(t('config.saveSuccess'))
  } catch {
    message.error(t('config.saveFailed'))
  }
}

onMounted(loadConfig)
</script>
