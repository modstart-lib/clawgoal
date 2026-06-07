<!-- ResourceMcp.vue — 已重构，逻辑见 ResourceMcpCard.vue / ResourceMcpFormModal.vue -->
<template>
  <div>
    <!-- 状态统计栏 -->
    <div class="flex items-center justify-between mb-4">
      <div
        class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"
      >
        <span>{{
          $t('claw.resource.totalMcp', { count: mcpList.length })
        }}</span>
        <span class="flex items-center gap-1">
          <span
            class="inline-block w-1.5 h-1.5 rounded-full bg-green-400"
          ></span>
          {{ $t('claw.resource.availableMcp', { count: connectedCount }) }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <a-button v-if="mcpList.length > 0" type="primary" @click="openAdd">
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

    <!-- 有记录：卡片网格 -->
    <template v-if="mcpList.length > 0">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ResourceMcpCard
          v-for="mcp in mcpList"
          :key="mcp.id"
          :mcp="mcp"
          :loading="loadingIds.has(mcp.id)"
          @toggle="(v) => handleToggle(mcp, v)"
          @edit="openEdit(mcp)"
          @delete="handleDelete(mcp)"
          @copy="openCopy(mcp)"
        />
      </div>
      <p class="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
        {{ $t('claw.resource.mcpHint') }}
      </p>
    </template>

    <!-- 无记录：居中引导创建 -->
    <EmptyState v-else :description="$t('claw.resource.noMcpDesc')">
      <a-button type="primary" @click="openAdd">
        <div class="inline-flex items-center gap-1">
          <Plus class="w-4 h-4" aria-hidden="true" />
          {{ $t('claw.resource.addMcp') }}
        </div>
      </a-button>
    </EmptyState>

    <!-- 新增/编辑弹窗 -->
    <ResourceMcpFormModal
      v-model:open="formVisible"
      :edit-row="editRow"
      :clone-row="cloneRow"
      @saved="loadList"
    />
  </div>
</template>

<script setup lang="ts">
import type { McpRow } from '@/claw/api/mcp'
import {
  deleteMcp,
  getMcpDetail,
  getMcpList,
  setMcpEnable,
} from '@/claw/api/mcp'
import EmptyState from '@/components/EmptyState.vue'
import { systemWs } from '@/utils/system'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Plus from '~icons/lucide/plus'
import RefreshCw from '~icons/lucide/refresh-cw'
import ResourceMcpCard from './ResourceMcpCard.vue'
import ResourceMcpFormModal from './ResourceMcpFormModal.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const mcpList = ref<McpRow[]>([])
const formVisible = ref(false)
const editRow = ref<McpRow | null>(null)
const cloneRow = ref<McpRow | null>(null)

function openAdd() {
  formVisible.value = true
  editRow.value = null
}

/** 正在切换开关的 MCP id 集合 */
const loadingIds = ref<Set<number>>(new Set())

const connectedCount = computed(
  () => mcpList.value.filter((m) => m.status === 'connected').length
)

async function loadList(showToast = false) {
  try {
    mcpList.value = await getMcpList()
    if (showToast) message.success(t('claw.resource.dataRefreshed'))
  } catch {
    message.error(t('claw.resource.loadMcpFailed'))
  }
}

async function handleToggle(mcp: McpRow, enable: boolean) {
  if (loadingIds.value.has(mcp.id)) return

  loadingIds.value = new Set([...loadingIds.value, mcp.id])

  if (enable) {
    // 乐观更新：开关显示打开 + connecting 状态；等 WS 通知后再最终刷新
    mcp.enable = 1
    mcp.status = 'connecting'
  } else {
    mcp.enable = 0
    mcp.status = 'disconnected'
  }

  try {
    await setMcpEnable(mcp.id, enable)
    if (!enable) {
      // 关闭是同步的，立即结束 loading
      const next = new Set(loadingIds.value)
      next.delete(mcp.id)
      loadingIds.value = next
    }
    // enable=true 时：loading 保持，等 MCP:Updated WS 事件触发后再解除
  } catch (err: any) {
    // 回滚
    mcp.enable = enable ? 0 : 1
    mcp.status = enable ? 'error' : mcp.status
    const errMsg =
      err?.response?.data?.message || t('claw.resource.mcpOperationFailed')
    message.error(errMsg)
    const next = new Set(loadingIds.value)
    next.delete(mcp.id)
    loadingIds.value = next
  }
}

async function onMcpUpdated(data: Record<string, unknown>) {
  const mcpId = data.mcpId as number
  if (!mcpId) return
  try {
    const fresh = await getMcpDetail(mcpId)
    const idx = mcpList.value.findIndex((m) => m.id === mcpId)
    if (idx !== -1) {
      mcpList.value[idx] = fresh
    }
    // 解除 loading
    if (loadingIds.value.has(mcpId)) {
      const next = new Set(loadingIds.value)
      next.delete(mcpId)
      loadingIds.value = next
      if (fresh.status === 'connected') {
        let toolCount = 0
        try {
          toolCount = fresh.tools ? fresh.tools.length : 0
        } catch {
          /* */
        }
        message.success(t('claw.resource.mcpConnected', { count: toolCount }))
      } else if (fresh.status === 'error') {
        message.error(t('claw.resource.mcpOperationFailed'))
      }
    }
  } catch {
    // ignore
  }
}

onMounted(() => {
  loadList()
  systemWs.on('claw:mcp:updated', onMcpUpdated)
  testActionSet('list.refresh', () => loadList())
  testActionSet('list.add', () => openAdd())
})
onUnmounted(() => {
  systemWs.off('claw:mcp:updated', onMcpUpdated)
  testActionUnset('list.refresh')
  testActionUnset('list.add')
})

function openEdit(mcp: McpRow) {
  editRow.value = mcp
  cloneRow.value = null
  formVisible.value = true
}

function openCopy(mcp: McpRow) {
  editRow.value = null
  cloneRow.value = mcp
  formVisible.value = true
}

async function handleDelete(mcp: McpRow) {
  try {
    await deleteMcp(mcp.id)
    message.success(t('claw.resource.mcpDeleted'))
    await loadList()
  } catch {
    message.error(t('claw.resource.deleteMcpFailed'))
  }
}
</script>
