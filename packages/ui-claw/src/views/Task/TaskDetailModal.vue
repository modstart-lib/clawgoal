<script setup lang="ts">
import {
  changeTaskStatus,
  deleteTask,
  getTaskDetail,
  type Task,
} from '@/claw/api/task'
import TaskSubtreeViewer from '@/claw/views/Task/TaskSubtreeViewer.vue'
import TaskEditModal from '@/claw/views/Task/TaskEditModal.vue'
import AgentViewer from '@/claw/views/Agent/AgentViewer.vue'
import AgentChatModal from '@/claw/views/Agent/AgentChatModal.vue'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import { systemWs } from '@/utils/system'
import { message, Modal } from 'ant-design-vue'
import { onMounted, ref, watch, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import CheckCircle from '~icons/lucide/check-circle'
import CircleX from '~icons/lucide/circle-x'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Play from '~icons/lucide/play'
import RotateCcw from '~icons/lucide/rotate-ccw'
import Square from '~icons/lucide/square'
import Trash2 from '~icons/lucide/trash-2'
import X from '~icons/lucide/x'
import XCircle from '~icons/lucide/x-circle'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  taskId: number | null
  hideSubtask?: true
}>()
const emit = defineEmits<{ 'update:open': [value: boolean]; refresh: [] }>()

const task = ref<Task | null>(null)
const loading = ref(false)
const subtaskHasChildren = ref(false)
const actionLoading = ref(false)
const showEdit = ref(false)
const agentChatVisible = ref(false)
const ancestors = ref<Task[]>([])
const ancestorDetailId = ref<number | null>(null)
const ancestorDetailOpen = ref(false)

const openAncestorDetail = (id: number) => {
  ancestorDetailId.value = id
  ancestorDetailOpen.value = true
}

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-gray-300 dark:bg-gray-500',
  queue: 'bg-amber-400',
  pending: 'bg-orange-400',
  ready: 'bg-blue-400',
  asking: 'bg-yellow-400',
  running: 'bg-primary-400',
  success: 'bg-green-400',
  failed: 'bg-red-400',
  canceled: 'bg-gray-300 dark:bg-gray-500',
}

const STATUS_LABEL = computed<Record<string, string>>(() => ({
  draft: t('claw.task.statusDraft'),
  queue: t('claw.task.statusQueue'),
  pending: t('claw.task.statusPending'),
  ready: t('claw.task.statusReady'),
  asking: t('claw.task.statusAsking'),
  running: t('claw.task.statusRunning'),
  success: t('claw.task.statusSuccess'),
  failed: t('claw.task.statusFailed'),
  canceled: t('claw.task.statusCanceled'),
}))

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  queue: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  pending:
    'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  ready: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  asking:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  running:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  success:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  canceled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

const loadAncestors = async () => {
  if (!task.value || task.value.parentId === 0) {
    ancestors.value = []
    return
  }
  // 从 descendants（同根树）构建 parentId → task 的映射
  const treeMap = new Map<number, Task>()
  for (const d of task.value.descendants ?? []) {
    treeMap.set(d.id, d)
  }
  const chain: Task[] = []
  let parentId = task.value.parentId
  while (parentId > 0) {
    const found = treeMap.get(parentId)
    if (found) {
      chain.unshift(found)
      parentId = found.parentId
    } else {
      break // 根任务不在 descendants 里，单独获取
    }
  }
  if (parentId > 0) {
    try {
      const rootTask = await getTaskDetail(parentId)
      chain.unshift(rootTask)
    } catch {
      // ignore
    }
  }
  ancestors.value = chain
}

const loadTask = async () => {
  if (!props.taskId) return
  loading.value = true
  subtaskHasChildren.value = false
  ancestors.value = []
  try {
    task.value = await getTaskDetail(props.taskId)
    await loadAncestors()
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  async (val) => {
    if (val && props.taskId) {
      await loadTask()
    }
  }
)

const onTaskUpdated = (data: Record<string, unknown>) => {
  if (props.open && task.value && (data.taskId as number) === task.value.id) {
    loadTask()
  }
}

systemWs.on('claw:task:updated', onTaskUpdated)
onMounted(() => {
  testActionSet('list.refresh', () => loadTask())
  testActionSet('modal.close', () => emit('update:open', false))
})
onUnmounted(() => {
  systemWs.off('claw:task:updated', onTaskUpdated)
  testActionUnset('list.refresh')
  testActionUnset('modal.close')
})

const handleSubtreeRefresh = () => {
  emit('refresh')
}

const handleSubtaskHasChildren = (val: boolean) => {
  subtaskHasChildren.value = val
}

const handleChangeStatus = async (status: string, statusRemark?: string) => {
  if (!task.value) return
  actionLoading.value = true
  try {
    task.value = await changeTaskStatus(task.value.id, status, statusRemark)
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.task.operationFailed'))
  } finally {
    actionLoading.value = false
  }
}

const handleDelete = () => {
  if (!task.value) return
  Modal.confirm({
    title: t('common.deleteTitle'),
    content: t('claw.task.deleteTaskConfirm', { title: task.value.title }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await deleteTask(task.value!.id)
      message.success(t('common.deleteSuccess'))
      emit('update:open', false)
      emit('refresh')
    },
  })
}

const handleEditUpdated = async () => {
  await loadTask()
  emit('refresh')
}

const showCompleteModal = ref(false)
const completeResult = ref('')
const completeLoading = ref(false)

function openCompleteModal() {
  completeResult.value = ''
  showCompleteModal.value = true
}

async function handleManualComplete() {
  if (!completeResult.value.trim()) {
    message.warning(t('claw.task.completeResultRequired'))
    return
  }
  if (!task.value) return
  completeLoading.value = true
  try {
    task.value = await changeTaskStatus(
      task.value.id,
      'success',
      completeResult.value.trim()
    )
    emit('refresh')
    showCompleteModal.value = false
  } catch (e: any) {
    message.error(e.message || t('claw.task.operationFailed'))
  } finally {
    completeLoading.value = false
  }
}
</script>

<template>
  <div>
    <a-modal
      :keyboard="false"
      :open="open"
      width="95vw"
      @cancel="emit('update:open', false)"
    >
      <template #title>
        <div class="flex items-center justify-between gap-2 pr-6">
          <span>{{
            task
              ? t('claw.task.modalTitle', { title: task.title })
              : t('claw.task.title')
          }}</span>
          <a-dropdown v-if="task" :trigger="['hover']" placement="bottomRight">
            <a-button class="inline-flex items-center" type="text" @click.stop>
              <MoreHorizontal class="w-4 h-4" aria-hidden="true" />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item
                  v-if="task.status === 'draft'"
                  @click="showEdit = true"
                >
                  <div class="flex items-center gap-2">
                    <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('common.edit') }}
                  </div>
                </a-menu-item>
                <a-menu-item
                  v-if="task.status !== 'running'"
                  class="text-red-500!"
                  @click="handleDelete"
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
      </template>
      <template #footer>
        <div v-if="task" class="flex items-center justify-between gap-2">
          <!-- 左侧操作 -->
          <div class="flex items-end gap-2">
            <!-- draft: 手动任务显示"转为进行中"，智能体任务显示"更改为就绪" -->
            <template v-if="task.status === 'draft'">
              <template v-if="task.agentId">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2">
                    <a-button
                      type="primary"
                      :loading="actionLoading"
                      @click="handleChangeStatus('queue')"
                    >
                      <div class="inline-flex items-center gap-1">
                        <Play
                          v-if="!actionLoading"
                          class="w-4 h-4"
                          aria-hidden="true"
                        />
                        {{ t('claw.task.changeToReady') }}
                      </div>
                    </a-button>
                    <a-button
                      :loading="actionLoading"
                      @click="
                        handleChangeStatus(
                          'canceled',
                          t('claw.task.manualCancel')
                        )
                      "
                    >
                      <div class="inline-flex items-center gap-1">
                        <XCircle
                          v-if="!actionLoading"
                          class="w-4 h-4"
                          aria-hidden="true"
                        />
                        {{ t('claw.task.changeToCancel') }}
                      </div>
                    </a-button>
                  </div>
                  <p class="text-xs text-gray-400 mb-0 text-left">
                    {{ t('claw.task.readyHint') }}
                  </p>
                </div>
              </template>
              <template v-else>
                <a-button
                  type="primary"
                  :loading="actionLoading"
                  @click="handleChangeStatus('running')"
                >
                  <div class="inline-flex items-center gap-1">
                    <Play
                      v-if="!actionLoading"
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    {{ t('claw.task.changeToRunning') }}
                  </div>
                </a-button>
                <a-button
                  :loading="actionLoading"
                  @click="
                    handleChangeStatus('canceled', t('claw.task.manualCancel'))
                  "
                >
                  <div class="inline-flex items-center gap-1">
                    <XCircle
                      v-if="!actionLoading"
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    {{ t('claw.task.changeToCancel') }}
                  </div>
                </a-button>
              </template>
            </template>
            <!-- ready: 撤回为草稿 -->
            <template v-else-if="task.status === 'ready'">
              <a-button
                :loading="actionLoading"
                @click="handleChangeStatus('draft')"
              >
                <div class="inline-flex items-center gap-1">
                  <RotateCcw
                    v-if="!actionLoading"
                    class="w-4 h-4"
                    aria-hidden="true"
                  />
                  {{ t('claw.task.changeToDraft') }}
                </div>
              </a-button>
            </template>
            <!-- asking: 查看处理 -->
            <template v-else-if="task.status === 'asking'">
              <a-button type="primary" @click="agentChatVisible = true">
                <div class="inline-flex items-center gap-1">
                  {{ t('claw.task.viewProcessing') }}
                </div>
              </a-button>
            </template>
            <!-- running: 手动任务显示完成/失败/取消，智能体任务显示停止 -->
            <template v-else-if="task.status === 'running'">
              <template v-if="!task.agentId">
                <a-button
                  type="primary"
                  :loading="actionLoading"
                  @click="openCompleteModal"
                >
                  <div class="inline-flex items-center gap-1">
                    <CheckCircle
                      v-if="!actionLoading"
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    {{ t('claw.task.changeToSuccess') }}
                  </div>
                </a-button>
                <a-button
                  danger
                  :loading="actionLoading"
                  @click="
                    handleChangeStatus(
                      'failed',
                      t('claw.task.manualMarkFailed')
                    )
                  "
                >
                  <div class="inline-flex items-center gap-1">
                    <CircleX
                      v-if="!actionLoading"
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    {{ t('claw.task.changeToFail') }}
                  </div>
                </a-button>
                <a-button
                  :loading="actionLoading"
                  @click="
                    handleChangeStatus('canceled', t('claw.task.manualCancel'))
                  "
                >
                  <div class="inline-flex items-center gap-1">
                    <XCircle
                      v-if="!actionLoading"
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    {{ t('claw.task.changeToCancel') }}
                  </div>
                </a-button>
              </template>
              <template v-else>
                <a-button
                  danger
                  :loading="actionLoading"
                  @click="
                    handleChangeStatus('failed', t('claw.task.manualStop'))
                  "
                >
                  <div class="inline-flex items-center gap-1">
                    <Square
                      v-if="!actionLoading"
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    {{ t('claw.task.stop') }}
                  </div>
                </a-button>
              </template>
            </template>
            <!-- failed / canceled: 重试 -->
            <template
              v-else-if="task.status === 'failed' || task.status === 'canceled'"
            >
              <a-button
                type="primary"
                :loading="actionLoading"
                @click="handleChangeStatus('ready')"
              >
                <div class="inline-flex items-center gap-1">
                  <RotateCcw
                    v-if="!actionLoading"
                    class="w-4 h-4"
                    aria-hidden="true"
                  />
                  {{ t('claw.task.retry') }}
                </div>
              </a-button>
            </template>
          </div>
          <!-- 右侧：关闭 -->
          <div class="flex items-center gap-2">
            <a-button @click="emit('update:open', false)">
              <div class="inline-flex items-center gap-1">
                <X class="w-4 h-4" aria-hidden="true" />
                {{ t('common.close') }}
              </div>
            </a-button>
          </div>
        </div>
        <div v-else>
          <a-button @click="emit('update:open', false)">
            <div class="inline-flex items-center gap-1">
              <X class="w-4 h-4" aria-hidden="true" />
              {{ t('common.close') }}
            </div>
          </a-button>
        </div>
      </template>

      <a-spin :spinning="loading">
        <div v-if="task" class="space-y-4 py-2">
          <!-- 父任务链路 -->
          <div
            v-if="ancestors.length > 0"
            class="flex items-center gap-1 flex-wrap text-xs"
          >
            <template v-for="(ancestor, i) in ancestors" :key="ancestor.id">
              <span v-if="i > 0" class="text-gray-300">›</span>
              <span
                class="flex items-center gap-1 cursor-pointer text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                @click="openAncestorDetail(ancestor.id)"
              >
                <span
                  class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  :class="STATUS_DOT[ancestor.status] || 'bg-gray-300'"
                />
                <span class="max-w-40 truncate" :title="ancestor.title">{{
                  ancestor.title
                }}</span>
              </span>
            </template>
            <span class="text-gray-300">›</span>
            <span class="text-xs text-gray-400">{{
              t('claw.task.currentTask')
            }}</span>
          </div>
          <!-- 标题 + 状态 -->
          <div class="flex items-start justify-between gap-3">
            <!-- Agent -->
            <div>
              <AgentViewer
                v-if="task.agentTitle"
                :agent-id="task.agentId"
                :agent-title="task.agentTitle"
                :agent-avatar="task.agentAvatar"
              />
            </div>
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium shrink-0"
              :class="STATUS_BADGE[task.status] || 'bg-gray-100 text-gray-600'"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="STATUS_DOT[task.status] || 'bg-gray-300'"
              />
              {{ STATUS_LABEL[task.status] || task.status }}
            </span>
          </div>

          <!-- 实时处理进度 -->
          <div
            v-if="task.processing"
            class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded px-3 py-2 font-mono"
          >
            {{ task.processing }}
          </div>

          <!-- 关联目标和关键结果 -->
          <div
            v-if="task.objectiveId || task.keyResultId"
            class="flex flex-wrap gap-2"
          >
            <span
              v-if="task.objectiveId"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50"
            >
              {{ t('claw.task.labelObjective')
              }}{{
                task.objectiveTitle
                  ? ': ' + task.objectiveTitle
                  : ' #' + task.objectiveId
              }}
            </span>
            <span
              v-if="task.keyResultId"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-100 dark:border-purple-800/50"
            >
              {{ t('claw.task.labelKeyResult')
              }}{{
                task.keyResultTitle
                  ? ': ' + task.keyResultTitle
                  : ' #' + task.keyResultId
              }}
            </span>
          </div>

          <!-- 描述 -->
          <div v-if="task.description">
            <div class="text-xs text-gray-400 mb-1">
              {{ t('claw.task.descLabel') }}
            </div>
            <div
              class="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap"
            >
              {{ task.description }}
            </div>
          </div>

          <!-- 时间信息 -->
          <div class="flex flex-wrap gap-4 text-xs text-gray-500">
            <span
              >{{ t('claw.task.createdLabel')
              }}<DatetimeViewer :value="task.createdAt"
            /></span>
            <span v-if="task.startAt"
              >{{ t('claw.task.startLabel')
              }}<DatetimeViewer :value="task.startAt"
            /></span>
            <span v-if="task.endAt"
              >{{ t('claw.task.endLabel') }}<DatetimeViewer :value="task.endAt"
            /></span>
          </div>

          <div
            v-if="subtaskHasChildren"
            class="border-t border-gray-100 dark:border-gray-700"
          />

          <!-- 子任务树 -->
          <div v-if="!hideSubtask">
            <div v-if="subtaskHasChildren" class="text-xs text-gray-400 mb-2">
              {{ t('claw.task.labelSubtask') }}
            </div>
            <TaskSubtreeViewer
              v-if="task.id"
              :key="task.id"
              :task-id="task.id"
              :root-id="task.rootId || task.id"
              :preloaded-descendants="task.descendants"
              @refresh="handleSubtreeRefresh"
              @has-children="handleSubtaskHasChildren"
            />
          </div>
        </div>
      </a-spin>
    </a-modal>

    <!-- 父任务详情弹窗 -->
    <TaskDetailModal
      v-if="ancestorDetailId"
      v-model:open="ancestorDetailOpen"
      :task-id="ancestorDetailId"
      @refresh="emit('refresh')"
    />

    <!-- 编辑弹窗（仅 draft 状态允许） -->
    <TaskEditModal
      v-if="task"
      v-model:open="showEdit"
      :task="task"
      @updated="handleEditUpdated"
    />

    <!-- Agent 对话弹窗（待反馈状态查看处理） -->
    <AgentChatModal
      v-if="task && task.agentId"
      :visible="agentChatVisible"
      :agent-id="task.agentId"
      :agent-title="task.agentTitle"
      :agent-avatar="task.agentAvatar"
      :title="task.agentTitle + ' · ' + task.title"
      @update:visible="agentChatVisible = $event"
    />

    <!-- 手动完成弹窗 -->
    <a-modal
      v-model:open="showCompleteModal"
      :title="t('claw.task.completeModalTitle')"
      width="min(500px, 90vw)"
      :confirm-loading="completeLoading"
      :ok-text="t('claw.task.completeOk')"
      :cancel-text="t('common.cancel')"
      @ok="handleManualComplete"
    >
      <div class="py-3">
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.task.completeResultLabel') }}
          <span class="text-red-500">*</span>
        </label>
        <a-textarea
          v-model:value="completeResult"
          :placeholder="t('claw.task.completeResultPlaceholder')"
          :auto-size="{ minRows: 4, maxRows: 8 }"
          class="!rounded-xl"
        />
      </div>
    </a-modal>
  </div>
</template>
