<template>
  <div>
    <!-- 状态统计栏 -->
    <div class="flex items-center justify-between mb-4">
      <div
        class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"
      >
        <span>{{
          $t('claw.resource.totalRuntimes', { count: connectors.length })
        }}</span>
        <span class="flex items-center gap-1">
          <span
            class="inline-block w-1.5 h-1.5 rounded-full bg-green-400"
          ></span>
          {{ $t('claw.resource.onlineCount', { count: onlineCount }) }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <a-button
          v-if="connectors.length > 0 && viewMode !== 'client'"
          type="primary"
          @click="modalVisible = true"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('common.add') }}
          </div>
        </a-button>
        <a-button type="default" @click="() => loadList(true)">
          <div class="inline-flex items-center gap-1">
            <RefreshCw class="w-4 h-4" aria-hidden="true" />
            {{ $t('common.refresh') }}
          </div>
        </a-button>
      </div>
    </div>

    <template v-if="connectors.length > 0">
      <div class="grid grid-cols-1 gap-4">
        <ResourceRuntimeCard
          v-for="item in sortedConnectors"
          :key="item.id"
          :connector="item"
          @copy-url="copyUrl"
          @edit="handleEdit"
          @delete="handleDelete"
          @open-runners="handleOpenRunners"
        />
      </div>
      <p
        v-if="viewMode !== 'client'"
        class="text-center text-xs text-gray-400 dark:text-gray-500 mt-6"
      >
        {{ $t('claw.resource.runtimeHint')
        }}<code class="font-mono">{{ connectorWsPath }}</code>
      </p>
    </template>

    <!-- 无记录：居中引导创建 -->
    <EmptyState
      v-if="connectors.length === 0"
      :description="$t('claw.resource.noRuntimesDesc')"
    >
      <a-button
        v-if="viewMode !== 'client'"
        type="primary"
        @click="modalVisible = true"
      >
        <div class="inline-flex items-center gap-1">
          <Plus class="w-4 h-4" aria-hidden="true" />
          {{ $t('claw.resource.addRuntime') }}
        </div>
      </a-button>
    </EmptyState>

    <ResourceRuntimeAddModal
      v-model:open="modalVisible"
      @created="connectors.push($event)"
    />
    <ResourceRuntimeEditModal
      v-model:open="editModalVisible"
      :connector="editingConnector"
      @updated="handleUpdated"
    />
    <ResourceRuntimeRunnerModal
      v-model:open="runnerModalVisible"
      :connector="runnerConnector"
      @updated="handleUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { getApiBase, resolveApiPath } from '@/api/base'
import {
  deleteRuntime,
  getRuntimeList,
  type RuntimeRow,
} from '@/claw/api/runtime'
import EmptyState from '@/components/EmptyState.vue'
import { systemWs } from '@/utils/system'
import { copyText } from '@/utils/utils'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Plus from '~icons/lucide/plus'
import RefreshCw from '~icons/lucide/refresh-cw'
import ResourceRuntimeAddModal from './ResourceRuntime/ResourceRuntimeAddModal.vue'
import ResourceRuntimeCard from './ResourceRuntime/ResourceRuntimeCard.vue'
import ResourceRuntimeEditModal from './ResourceRuntime/ResourceRuntimeEditModal.vue'
import ResourceRuntimeRunnerModal from './ResourceRuntime/ResourceRuntimeRunnerModal.vue'
import { useSiteUrl, useAppEnvComputed } from '@/composables/setting'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()
const siteUrlStore = useSiteUrl()
const { viewMode } = useAppEnvComputed()

const connectors = ref<RuntimeRow[]>([])
const onlineCount = computed(
  () => connectors.value.filter((c) => c.status === 'online').length
)
// 本机运行环境始终排第一，其余按在线状态排序
const sortedConnectors = computed(() => {
  return [...connectors.value].sort((a, b) => {
    if (a.id === 0) return -1
    if (b.id === 0) return 1
    if (a.status === 'online' && b.status !== 'online') return -1
    if (a.status !== 'online' && b.status === 'online') return 1
    return 0
  })
})
const modalVisible = ref(false)
const editModalVisible = ref(false)
const editingConnector = ref<RuntimeRow | null>(null)
const runnerModalVisible = ref(false)
const runnerConnector = ref<RuntimeRow | null>(null)
const connectorWsPath = resolveApiPath('/websocket/runtime')

const loadList = async (showToast = false) => {
  connectors.value = await getRuntimeList()
  if (showToast) message.success(t('claw.resource.dataRefreshed'))
}

const handleEdit = (id: number) => {
  editingConnector.value = connectors.value.find((c) => c.id === id) ?? null
  editModalVisible.value = true
}

const handleOpenRunners = (id: number) => {
  runnerConnector.value = connectors.value.find((c) => c.id === id) ?? null
  runnerModalVisible.value = true
}

const handleUpdated = (row: RuntimeRow) => {
  const idx = connectors.value.findIndex((c) => c.id === row.id)
  if (idx !== -1) connectors.value[idx] = row
  // 同步更新 runnerConnector 使弹窗内数据保持最新
  if (runnerConnector.value?.id === row.id) runnerConnector.value = row
}

const handleDelete = async (id: number) => {
  if (id === 0) return // 本机运行环境不可删除
  await deleteRuntime(id)
  connectors.value = connectors.value.filter((c) => c.id !== id)
  message.success(t('claw.resource.runtimeDeleted'))
}

const copyUrl = async (token: string) => {
  try {
    const base = getApiBase()
    let wsUrl: string
    if (base.startsWith('http://') || base.startsWith('https://')) {
      wsUrl = `${base}/websocket/runtime`
    } else {
      wsUrl = `${siteUrlStore.siteUrl}${base}/websocket/runtime`
    }
    const cmd = import.meta.env.DEV
      ? `cd packages/backend && pnpm cli --token ${token} connect ${wsUrl}`
      : `clawgoal --token ${token} connect ${wsUrl}`
    await copyText(cmd, false)
    message.success(t('claw.resource.urlCopied'))
  } catch {
    message.error(t('claw.resource.copyFailed'))
  }
}

onMounted(loadList)
onMounted(() => {
  systemWs.onThrottle('claw:runtime:updated', onRuntimeUpdated)
  testActionSet('list.refresh', () => loadList())
  testActionSet('list.add', () => {
    modalVisible.value = true
  })
})
onUnmounted(() => {
  systemWs.offThrottle('claw:runtime:updated', onRuntimeUpdated)
  testActionUnset('list.refresh')
  testActionUnset('list.add')
})

const onRuntimeUpdated = () => {
  loadList()
}
</script>
