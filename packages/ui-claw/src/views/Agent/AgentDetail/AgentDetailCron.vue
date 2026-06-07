<script setup lang="ts">
import { useAgentStore } from '@/claw/stores/agent'
import type { Agent } from '@/types'
import {
  deleteCronTask,
  listCronTasks,
  runCronTaskNow,
  toggleCronTask,
  updateCronTask,
  type CronTask,
} from '@/claw/api/cron'
import CronAddModal from '@/claw/views/Cron/CronAddModal.vue'
import CronTaskCard from '@/claw/views/Cron/CronCard.vue'
import CronDetailModal from '@/claw/views/Cron/CronDetailModal.vue'
import CronHistoryModal from '@/claw/views/Cron/CronHistoryModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import History from '~icons/lucide/history'
import Plus from '~icons/lucide/plus'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{ agentId: number }>()

const agentStore = useAgentStore()
const { agents } = agentStore
const tasks = ref<CronTask[]>([])
const loading = ref(false)

async function loadTasks() {
  loading.value = true
  try {
    const allTasks = await listCronTasks()
    tasks.value = allTasks.filter(
      (t: CronTask) => String(t.agentId) === String(props.agentId)
    )
  } catch (err: unknown) {
    message.error(
      err instanceof Error ? err.message : t('claw.agent.loadFailed')
    )
  } finally {
    loading.value = false
  }
}

// ─── 新建 / 编辑 ──────────────────────────────────────────────────────────────
const addModalVisible = ref(false)
const editingTask = ref<CronTask | null>(null)

function openAddModal(task?: CronTask) {
  editingTask.value = task || null
  addModalVisible.value = true
}

function handleSaved(saved: CronTask) {
  const idx = tasks.value.findIndex((t: CronTask) => t.id === saved.id)
  if (idx !== -1) {
    tasks.value[idx] = saved
  } else {
    tasks.value.push(saved)
  }
}

// ─── 详情 ────────────────────────────────────────────────────────────────────
const detailModalVisible = ref(false)
const detailTask = ref<CronTask | null>(null)

function openDetailModal(task: CronTask) {
  detailTask.value = task
  detailModalVisible.value = true
}

// ─── 调度历史 ─────────────────────────────────────────────────────────────────
const historyOpen = ref(false)

// ─── 切换启用 ────────────────────────────────────────────────────────────────
async function handleToggle(id: number, val: boolean) {
  try {
    const updated = await toggleCronTask(id, val)
    const idx = tasks.value.findIndex((t: CronTask) => t.id === id)
    if (idx !== -1) tasks.value[idx] = updated
    message.success(
      t('claw.cron.toggleSuccess', {
        action: val
          ? t('claw.cron.toggleEnable')
          : t('claw.cron.toggleDisable'),
      })
    )
  } catch (err: unknown) {
    message.error(
      err instanceof Error ? err.message : t('claw.agent.operationFailed')
    )
  }
}

// ─── 切换成功通知 ────────────────────────────────────────────────────────────
async function handleToggleNotify(id: number, val: boolean) {
  try {
    const updated = await updateCronTask(id, { successNotify: val })
    const idx = tasks.value.findIndex((t: CronTask) => t.id === id)
    if (idx !== -1) tasks.value[idx] = updated
    message.success(
      t('claw.cron.toggleSuccess', {
        action: val
          ? t('claw.cron.toggleEnable')
          : t('claw.cron.toggleDisable'),
      })
    )
  } catch (err: unknown) {
    message.error(
      err instanceof Error ? err.message : t('claw.agent.operationFailed')
    )
  }
}

// ─── 立即执行 ────────────────────────────────────────────────────────────────
async function handleRunNow(id: number) {
  try {
    await runCronTaskNow(id)
    message.success(t('claw.cron.runNowSuccess'))
  } catch (err: unknown) {
    message.error(
      err instanceof Error ? err.message : t('claw.agent.operationFailed')
    )
  }
}

// ─── 删除 ────────────────────────────────────────────────────────────────────
async function handleDelete(id: number) {
  try {
    await deleteCronTask(id)
    tasks.value = tasks.value.filter((t: CronTask) => t.id !== id)
    message.success(
      t('claw.cron.toggleSuccess', { action: t('claw.cron.deleteBtn') })
    )
  } catch (err: unknown) {
    message.error(err instanceof Error ? err.message : t('common.deleteFailed'))
  }
}

const getAgent = (agentId?: string) =>
  agents.value.find((a: Agent) => a.id === agentId)

onMounted(() => {
  agentStore.load()
  loadTasks()
  testActionSet('list.refresh', () => loadTasks())
  testActionSet('list.add', () => openAddModal())
  testActionSet('cron.openHistory', () => {
    historyOpen.value = true
  })
})
onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
  testActionUnset('cron.openHistory')
})
</script>

<template>
  <div class="p-5">
    <ListerTop :loading="loading" :total="tasks.length" @refresh="loadTasks">
      <template #actions>
        <a-button type="default" @click="historyOpen = true">
          <div class="inline-flex items-center gap-1">
            <History class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.agent.cronHistory') }}
          </div>
        </a-button>
        <a-button
          v-if="tasks.length > 0 || loading"
          type="primary"
          @click="openAddModal()"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.agent.addCronTask') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <LoadingState :loading="loading">
      <EmptyState
        v-if="tasks.length === 0"
        :loading="loading"
        :description="$t('claw.agent.noCronTasks')"
      >
        <a-button type="primary" @click="openAddModal()">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.agent.addCronTask') }}
          </div>
        </a-button>
      </EmptyState>
      <div class="flex flex-col gap-3">
        <CronTaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          :agent="getAgent(task.agentId)"
          @toggle="handleToggle"
          @toggle-notify="handleToggleNotify"
          @run-now="handleRunNow"
          @view-logs="openDetailModal"
          @edit="openAddModal"
          @delete="handleDelete"
        />
      </div>
    </LoadingState>

    <!-- 新建 / 编辑弹窗 -->
    <CronAddModal
      v-model:open="addModalVisible"
      :task="editingTask"
      :initial-agent-id="String(agentId)"
      :lock-to-agent="true"
      @saved="handleSaved"
    />

    <!-- 详情弹窗 -->
    <CronDetailModal
      v-model:open="detailModalVisible"
      :task="detailTask"
      :agent="detailTask ? getAgent(detailTask.agentId) : undefined"
    />

    <!-- 调度历史弹窗 -->
    <CronHistoryModal
      v-model:open="historyOpen"
      :agent-id="String(agentId)"
      :title="$t('claw.agent.cronHistory')"
    />
  </div>
</template>
