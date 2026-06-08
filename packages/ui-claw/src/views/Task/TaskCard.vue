<script setup lang="ts">
import {
  changeTaskStatus,
  deleteTask,
  retryTask,
  stopTask,
} from '@/claw/api/task'
import type { Task } from '@/claw/api/task'
import TaskSubtreeViewer from '@/claw/views/Task/TaskSubtreeViewer.vue'
import AgentViewer from '@/claw/views/Agent/AgentViewer.vue'
import TaskDetailModal from '@/claw/views/Task/TaskDetailModal.vue'
import TaskEditModal from '@/claw/views/Task/TaskEditModal.vue'
import TaskAddModal from '@/claw/views/Task/TaskAddModal.vue'
import { TASK_STATUS_OPTIONS } from '@/claw/views/Task/constant'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import LabelViewer from '@/components/LabelViewer.vue'
import TextHighlight from '@/components/TextHighlight.vue'
import { copyText } from '@/utils/utils'
import { systemWs } from '@/utils/system'
import { Modal, message } from 'ant-design-vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import Clock from '~icons/lucide/clock'
import Info from '~icons/lucide/info'
import GitBranch from '~icons/lucide/git-branch'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import MousePointerClick from '~icons/lucide/mouse-pointer-click'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import Ban from '~icons/lucide/ban'
import Play from '~icons/lucide/play'
import RotateCcw from '~icons/lucide/rotate-ccw'
import Target from '~icons/lucide/target'
import Trash2 from '~icons/lucide/trash-2'

interface TaskItem {
  id: number
  title: string
  description?: string
  status: string
  agentId?: number | null
  agentTitle?: string
  agentAvatar?: string | null
  objectiveId?: number | null
  objectiveTitle?: string
  keyResultId?: number | null
  keyResultTitle?: string
  createdAt: string
  source?: string
  dueAt?: string
  estimatedHours?: number | null
  /** 接口返回的后代任务列表 */
  descendants?: Task[]
}

const { t } = useI18n()

const props = defineProps<{ task: TaskItem; keyword?: string }>()
const emit = defineEmits<{ refresh: [] }>()

const operating = ref(false)
const taskDetailOpen = ref(false)
const taskEditOpen = ref(false)
const subtaskVisible = ref(false)
const addSubtaskVisible = ref(false)
const subtreeViewerRef = ref<InstanceType<typeof TaskSubtreeViewer>>()

const onTaskChanged = () => {
  subtreeViewerRef.value?.forceLoad()
}

onMounted(() => {
  systemWs.on(`claw:task:${props.task.id}:changed`, onTaskChanged)
  testActionSet('card.openDetail', () => {
    taskDetailOpen.value = true
  })
  testActionSet('card.openEdit', () => {
    taskEditOpen.value = true
  })
  testActionSet('card.addSubtask', () => {
    addSubtaskVisible.value = true
  })
})
onUnmounted(() => {
  systemWs.off(`claw:task:${props.task.id}:changed`, onTaskChanged)
  testActionUnset('card.openDetail')
  testActionUnset('card.openEdit')
  testActionUnset('card.addSubtask')
})

const handleStop = async () => {
  operating.value = true
  try {
    await stopTask(props.task.id)
    message.success(t('claw.task.stopped'))
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.task.operationFailed'))
  } finally {
    operating.value = false
  }
}

const handleMarkReady = async () => {
  operating.value = true
  try {
    await changeTaskStatus(props.task.id, 'queue')
    message.success(t('claw.task.queuedSuccess'))
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.task.operationFailed'))
  } finally {
    operating.value = false
  }
}

const handleRetry = async () => {
  operating.value = true
  try {
    await retryTask(props.task.id)
    message.success(t('claw.task.retried'))
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.task.operationFailed'))
  } finally {
    operating.value = false
  }
}

const handleDelete = async () => {
  operating.value = true
  try {
    await deleteTask(props.task.id)
    message.success(t('common.deleteSuccess'))
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('common.deleteFailed'))
  } finally {
    operating.value = false
  }
}

const confirmDelete = () => {
  Modal.confirm({
    title: t('claw.task.deleteConfirm'),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: handleDelete,
  })
}
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-all hover:shadow-md cursor-pointer"
    @click="taskDetailOpen = true"
  >
    <!-- 主内容区 -->
    <div class="p-3 flex flex-col gap-2">
      <!-- 顶部：标题 -->
      <div class="flex items-center gap-2">
        <span
          class="text-xs text-gray-400 dark:text-gray-500 font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
          :title="t('common.copyId')"
          @click.stop="copyText(String(task.id))"
          >#{{ task.id }}</span
        >
        <div
          class="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug flex-1 min-w-0 wrap-break-word"
        >
          <TextHighlight :text="task.title" :keyword="keyword" />
        </div>
        <div>
          <LabelViewer :value="task.status" :options="TASK_STATUS_OPTIONS" />
        </div>
      </div>

      <!-- AgentViewer + 状态 -->
      <div class="flex items-center gap-2 flex-wrap">
        <div class="grow">
          <AgentViewer
            v-if="task.agentTitle"
            :agent-id="task.agentId"
            :agent-title="task.agentTitle"
            :agent-avatar="task.agentAvatar"
          />
        </div>
        <span
          v-if="task.source === 'objective'"
          class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50"
        >
          <Target class="w-3 h-3" />{{ t('claw.task.sourceObjective') }}</span
        >
        <span
          v-else
          class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400 border border-gray-200 dark:border-gray-600/50"
        >
          <MousePointerClick class="w-3 h-3" />{{
            t('claw.task.sourceManual')
          }}</span
        >
      </div>

      <!-- ID + 关联目标/关键结果 -->
      <div
        v-if="task.objectiveId || task.keyResultId"
        class="flex flex-wrap gap-1.5 items-center"
      >
        <span
          v-if="task.objectiveId"
          class="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50"
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
          class="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-100 dark:border-purple-800/50"
        >
          {{ t('claw.task.labelKeyResult')
          }}{{
            task.keyResultTitle
              ? ': ' + task.keyResultTitle
              : ' #' + task.keyResultId
          }}
        </span>
      </div>

      <!-- 描述（无图标） -->
      <div
        v-if="task.description"
        class="text-xs text-gray-500 dark:text-gray-400 wrap-break-word leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md border border-gray-100 dark:border-gray-700/50"
      >
        {{ task.description }}
      </div>

      <!-- 子任务树 -->
      <div v-show="subtaskVisible" class="">
        <div class="text-gray-400 text-xs mb-2 flex items-center gap-1">
          <GitBranch class="w-3.5 h-3.5" />
          {{ t('claw.task.labelSubtask') }}
          <a-button
            class="ml-auto"
            size="small"
            type="text"
            @click.stop="addSubtaskVisible = true"
          >
            <div class="inline-flex items-center gap-1">
              <Plus class="w-3.5 h-3.5" aria-hidden="true" />
              {{ t('claw.task.addSubtask') }}
            </div>
          </a-button>
        </div>
        <div class="text-xs">
          <TaskSubtreeViewer
            ref="subtreeViewerRef"
            :task-id="task.id"
            :preloaded-descendants="task.descendants"
            @refresh="emit('refresh')"
            @has-children="subtaskVisible = $event"
          />
        </div>
      </div>

      <!-- 底部：时间信息 + 操作区 -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 text-xs text-gray-400">
          <span class="flex items-center gap-1">
            <Clock class="w-3.5 h-3.5" />
            <DatetimeViewer
              :value="task.createdAt"
              class="ml-1 text-gray-400! dark:text-gray-500!"
            />
          </span>
        </div>
        <div class="flex items-center gap-1">
          <!-- 更多操作 -->
          <a-dropdown :trigger="['hover']" placement="bottomRight">
            <a-button
              :loading="operating"
              class="text-gray-500 inline-flex items-center justify-center"
              @click.stop
            >
              <MoreHorizontal
                v-if="!operating"
                class="w-4 h-4"
                aria-hidden="true"
              />
            </a-button>
            <template #overlay>
              <a-menu>
                <!-- 详情 -->
                <a-menu-item @click="taskDetailOpen = true">
                  <div class="flex items-center gap-2">
                    <Info class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('claw.task.detail') }}
                  </div>
                </a-menu-item>
                <!-- 放入队列：draft -->
                <a-menu-item
                  v-if="task.status === 'draft'"
                  @click="handleMarkReady"
                >
                  <div class="flex items-center gap-2">
                    <Play class="w-3.5 h-3.5" aria-hidden="true" />
                    <div>
                      <div>{{ t('claw.task.addToQueue') }}</div>
                      <div class="text-xs text-gray-400">
                        {{ t('claw.task.addToQueueHint') }}
                      </div>
                    </div>
                  </div>
                </a-menu-item>
                <!-- 取消：draft / queue / ready / asking / running -->
                <a-menu-item
                  v-if="
                    ['draft', 'queue', 'ready', 'asking', 'running'].includes(
                      task.status
                    )
                  "
                  @click="handleStop"
                >
                  <div class="flex items-center gap-2">
                    <Ban class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('claw.task.cancel') }}
                  </div>
                </a-menu-item>
                <!-- 重试：fail / canceled -->
                <a-menu-item
                  v-if="task.status === 'failed' || task.status === 'canceled'"
                  @click="handleRetry"
                >
                  <div class="flex items-center gap-2">
                    <RotateCcw class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('claw.task.retry') }}
                  </div>
                </a-menu-item>
                <a-menu-item @click="taskEditOpen = true">
                  <div class="flex items-center gap-2">
                    <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('common.edit') }}
                  </div>
                </a-menu-item>
                <a-menu-item
                  v-if="!subtaskVisible"
                  @click="addSubtaskVisible = true"
                >
                  <div class="flex items-center gap-2">
                    <Plus class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('claw.task.addSubtask') }}
                  </div>
                </a-menu-item>
                <a-menu-item class="text-red-500!" @click="confirmDelete">
                  <div class="flex items-center gap-2">
                    <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('common.delete') }}
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
    </div>

    <!-- 任务详情弹窗 -->
    <TaskDetailModal
      v-model:open="taskDetailOpen"
      :task-id="task.id"
      @refresh="emit('refresh')"
    />
    <!-- 任务修改弹窗 -->
    <TaskEditModal
      v-model:open="taskEditOpen"
      :task="task"
      @updated="emit('refresh')"
    />
    <!-- 添加子任务弹窗 -->
    <TaskAddModal
      v-model:open="addSubtaskVisible"
      :parent-id="task.id"
      :parent-title="task.title"
      @created="emit('refresh')"
    />
  </div>
</template>
