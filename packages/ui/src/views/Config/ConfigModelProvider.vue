<template>
  <div>
    <LoadingState :loading="loading">
      <ListerTop
        :loading="loading"
        :total="customProviders.length"
        @refresh="load"
      >
        <template #actions>
          <a-button
            v-if="customProviders.length > 0 || loading || !!builtinProvider"
            type="primary"
            @click="openAdd"
          >
            <div class="inline-flex items-center gap-1">
              <Plus class="w-4 h-4" aria-hidden="true" />
              {{ $t('config.addProvider') }}
            </div>
          </a-button>
        </template>
      </ListerTop>

      <!-- 内置提供商横条 -->

      <!-- 自定义提供商表格 -->
      <div
        v-if="customProviders.length > 0 || loading"
        class="rounded-xl border border-gray-100/80 dark:border-gray-700/50 bg-surface/50 dark:bg-panel/30 backdrop-blur-md overflow-hidden"
      >
        <a-table
          :data-source="customProviders"
          :columns="columns"
          :pagination="false"
          row-key="name"
          :locale="{ emptyText: $t('config.builtinNoCustomProviders') }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'name'">
              <span class="font-medium text-sm">{{ record.name }}</span>
            </template>
            <template v-else-if="column.key === 'provider'">
              <div class="flex items-center gap-1.5">
                <ModelIcon
                  :provider="record.provider"
                  :size="18"
                  class="shrink-0"
                />
                <a-tag :color="providerColor(record.provider)" class="!m-0">
                  {{ providerLabel(record.provider) }}
                </a-tag>
              </div>
            </template>
            <template v-else-if="column.key === 'info'">
              <div class="flex flex-col gap-1.5 py-1">
                <div class="flex items-center gap-1.5">
                  <Globe
                    class="w-3.5 h-3.5 text-primary shrink-0"
                    aria-hidden="true"
                  />
                  <span
                    class="text-xs font-mono text-gray-500 dark:text-gray-400 truncate"
                  >
                    {{
                      record.apiBase || defaultApiBase(record.provider) || '—'
                    }}
                  </span>
                </div>
                <div class="flex items-start gap-1.5">
                  <Layers
                    class="w-3.5 h-3.5 text-accent shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div class="flex flex-wrap gap-1">
                    <template
                      v-if="
                        record.models.filter((m: any) => m.name.trim()).length
                      "
                    >
                      <a-tag
                        v-for="m in record.models.filter((m: any) =>
                          m.name.trim()
                        )"
                        :key="m.name"
                        :color="
                          record.models[0]?.name === m.name ? 'blue' : 'default'
                        "
                        class="!text-xs !m-0 !leading-5 cursor-pointer select-none"
                        @click="setModelAsDefault(index, m.name)"
                      >
                        {{ m.name }}
                      </a-tag>
                    </template>
                    <span v-else class="text-xs text-gray-400">—</span>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <a-tooltip
                    :title="
                      record.isDefault
                        ? $t('config.providerDefaultLabel')
                        : $t('config.providerIsDefault')
                    "
                  >
                    <div
                      class="flex items-center gap-1 cursor-pointer select-none"
                      @click="setCustomAsDefault(index)"
                    >
                      <Star
                        :class="
                          record.isDefault
                            ? 'w-3.5 h-3.5 shrink-0 text-warning fill-warning'
                            : 'w-3.5 h-3.5 shrink-0 text-gray-300 dark:text-gray-600 hover:text-warning'
                        "
                        aria-hidden="true"
                      />
                      <span
                        v-if="record.isDefault"
                        class="text-xs text-warning font-medium"
                      >
                        {{ $t('config.providerDefaultLabel') }}
                      </span>
                    </div>
                  </a-tooltip>
                  <div v-if="record.proxyName" class="flex items-center gap-1">
                    <ProxyViewer :proxy-name="record.proxyName" />
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="flex gap-2 flex-wrap">
                <a-button
                  type="default"
                  :loading="testingIndex === index"
                  :class="testResultClass(record.name)"
                  @click="doTestProvider(index, record.name)"
                >
                  <div class="inline-flex items-center gap-1">
                    <CheckCircle
                      v-if="
                        testingIndex !== index &&
                        testResults[record.name] === 'success'
                      "
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    <XCircle
                      v-else-if="
                        testingIndex !== index &&
                        testResults[record.name] === 'failed'
                      "
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    <Zap
                      v-else-if="testingIndex !== index"
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    {{ $t('config.testProvider') }}
                  </div>
                </a-button>
                <a-button type="default" @click="openEdit(index)">
                  <div class="inline-flex items-center gap-1">
                    <Edit class="w-4 h-4" aria-hidden="true" />
                    {{ $t('common.edit') }}
                  </div>
                </a-button>
                <a-popconfirm
                  :title="$t('config.deleteProviderConfirm')"
                  :ok-text="$t('common.yes')"
                  :cancel-text="$t('common.cancel')"
                  @confirm="removeProvider(index)"
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

      <!-- 空状态 -->
      <EmptyState v-if="customProviders.length === 0 && !loading">
        <a-button type="primary" @click="openAdd">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('config.builtinAddCustom') }}
          </div>
        </a-button>
      </EmptyState>
    </LoadingState>

    <!-- 自定义提供商编辑弹窗 -->
    <ConfigModelProviderEditModal
      v-model:open="modalVisible"
      :initial-data="editingData"
      @submit="onModalSubmit"
    />

    <!-- 内置模型设置弹窗 -->
  </div>
</template>

<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Star } from 'lucide-vue-next'
import CheckCircle from '~icons/lucide/check-circle'
import Edit from '~icons/lucide/edit'
import Globe from '~icons/lucide/globe'
import Layers from '~icons/lucide/layers'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import XCircle from '~icons/lucide/x-circle'
import Zap from '~icons/lucide/zap'
import {
  getModelProvider,
  saveModelProvider,
  testModelProvider,
  type ModelProviderConfig,
} from '../../api/config'
import {
  getProviderList,
  setProviderDefault,
  saveBuiltinProviderModels,
  type UnifiedProvider,
} from '../../api/model'
import ModelIcon from '../../components/ModelIcon.vue'
import ProxyViewer from '../Setting/SettingProxy/SettingProxyViewer.vue'
import {
  PROVIDER_COLORS,
  PROVIDER_DEFAULTS,
  PROVIDER_LABELS,
} from './configModelProviderConstants'
import ConfigModelProviderEditModal from './ConfigModelProviderEditModal.vue'

const { t } = useI18n()

// 在 setup 中捕获编译时常量，供模板使用（Vite define 仅替换裸标识符）
const hidePro = __HIDE_PRO__

// ─── State ────────────────────────────────────────────────────────────────────

const loading = ref(false)
const testingIndex = ref<number | null>(null)
const testResults = ref<Record<string, 'success' | 'failed'>>({})
const customProviders = ref<ModelProviderConfig[]>([])


// 自定义提供商编辑
const modalVisible = ref(false)
const editingData = ref<ModelProviderConfig | null>(null)
const editingIndex = ref(-1)

// ─── Computed ─────────────────────────────────────────────────────────────────

const columns = computed(() => [
  {
    title: t('config.providerName'),
    dataIndex: 'name',
    key: 'name',
    width: 140,
  },
  {
    title: t('config.providerType'),
    dataIndex: 'provider',
    key: 'provider',
    width: 130,
  },
  { title: t('config.providerInfo'), key: 'info', ellipsis: true },
  { title: t('config.actions'), key: 'actions', width: 240 },
])


// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultApiBase(provider: string): string {
  return PROVIDER_DEFAULTS[provider] ?? ''
}

function providerColor(provider: string): string {
  return PROVIDER_COLORS[provider] ?? 'default'
}

function providerLabel(provider: string): string {
  const i18nKey = `config.provider${provider.charAt(0).toUpperCase() + provider.slice(1)}`
  const translated = t(i18nKey)
  if (translated === i18nKey) return PROVIDER_LABELS[provider] ?? provider
  return translated
}


// ─── 默认提供商设置 ────────────────────────────────────────────────────────────

async function setCustomAsDefault(idx: number) {
  const provider = customProviders.value[idx]
  if (!provider) return
  try {
    await setProviderDefault(provider.name)
    // 本地更新：自定义提供商互斥，清除内置默认
    customProviders.value.forEach((p, i) => {
      p.isDefault = i === idx
    })
  } catch {
    message.error(t('config.saveFailed'))
  }
}


// ─── 自定义提供商 CRUD ─────────────────────────────────────────────────────────

function openAdd() {
  editingIndex.value = -1
  editingData.value = null
  modalVisible.value = true
}

function openEdit(idx: number) {
  editingIndex.value = idx
  editingData.value = { ...customProviders.value[idx] }
  modalVisible.value = true
}

async function onModalSubmit(entry: ModelProviderConfig) {
  if (editingIndex.value === -1) {
    customProviders.value.push(entry)
  } else {
    customProviders.value[editingIndex.value] = entry
  }
  // 如果新增/编辑的提供商设为了默认，需要同步清除内置的默认标记
  if (entry.isDefault) {
  }
  await persistSave(true)
}

function setModelAsDefault(providerIdx: number, modelName: string) {
  const provider = customProviders.value[providerIdx]
  if (!provider) return
  const idx = provider.models.findIndex((m) => m.name === modelName)
  if (idx < 0) return
  const [entry] = provider.models.splice(idx, 1)
  provider.models.unshift(entry)
  persistSave(true)
}

async function removeProvider(idx: number) {
  const removed = customProviders.value[idx]
  customProviders.value.splice(idx, 1)

  // 如果删除的是默认提供商，重新计算默认值
  if (removed?.isDefault) {
    const hasCustomDefault = customProviders.value.some((p) => p.isDefault)
    if (!hasCustomDefault) {
      if (customProviders.value.length > 0) {
        // 优先设第一个自定义提供商为默认
        customProviders.value[0].isDefault = true
        await persistSave(true)
        return
      }
    }
  }

  await persistSave(true)
}

async function doTestProvider(idx: number, providerName: string) {
  const provider = customProviders.value[idx]
  testingIndex.value = idx
  delete testResults.value[providerName]
  try {
    const result = await testModelProvider(provider)
    if (result.ok) {
      testResults.value[providerName] = 'success'
      message.success(t('config.testProviderSuccess'))
    } else {
      testResults.value[providerName] = 'failed'
      message.error(
        t('config.testProviderFailed', { error: result.error ?? 'unknown' })
      )
    }
  } catch (e: any) {
    testResults.value[providerName] = 'failed'
    message.error(
      t('config.testProviderFailed', { error: e?.message ?? 'unknown' })
    )
  } finally {
    testingIndex.value = null
  }
}

function testResultClass(providerName: string): string {
  if (testResults.value[providerName] === 'success') return '!text-success'
  if (testResults.value[providerName] === 'failed') return '!text-error'
  return ''
}

async function persistSave(silent = false) {
  try {
    await saveModelProvider(customProviders.value)
    if (!silent) message.success(t('config.saveSuccess'))
  } catch {
    message.error(t('config.saveFailed'))
  }
}

// ─── Load ─────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  try {
    // 并行加载：自定义提供商（用于编辑）+ 统一提供商列表（含内置）
    const [customList, unifiedList] = await Promise.all([
      getModelProvider(),
      getProviderList(),
    ])
    customProviders.value = (customList || []).map((p) => ({
      ...p,
      format: p.format ?? '',
      models: p.models.length > 0 ? p.models : [],
    }))
  } catch {
    message.error(t('config.loadFailed'))
  } finally {
    loading.value = false
  }
}


onMounted(() => {
  load()
})

onUnmounted(() => {
})
</script>

<style scoped>
.builtin-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid #e5e5ea;
  background: linear-gradient(135deg, #f8f7ff 0%, #f0f4ff 100%);
}

:global(.dark) .builtin-bar {
  background: linear-gradient(
    135deg,
    rgba(124, 58, 237, 0.08) 0%,
    rgba(59, 130, 246, 0.06) 100%
  );
  border-color: rgba(124, 58, 237, 0.2);
}

.builtin-bar-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.builtin-bar-label {
  font-size: 13px;
  font-weight: 600;
  color: #1c1c1e;
  white-space: nowrap;
}

:global(.dark) .builtin-bar-label {
  color: #f5f5f7;
}

.builtin-bar-center {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.builtin-bar-hint {
  font-size: 12px;
  color: #aeaeb2;
}

.builtin-bar-quota {
  font-size: 12px;
  font-weight: 500;
  color: #7c3aed;
  white-space: nowrap;
}

.builtin-bar-divider {
  width: 1px;
  height: 12px;
  background: #d4d4d8;
  flex-shrink: 0;
}

.builtin-bar-models {
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s;
}

.builtin-bar-models:hover {
  color: #7c3aed;
}

.builtin-bar-default-model {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.builtin-bar-set-default {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #aeaeb2;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s;
}

.builtin-bar-set-default:hover,
.builtin-bar-set-default.active {
  color: #d97706;
}

.builtin-bar-right {
  flex-shrink: 0;
}
</style>
