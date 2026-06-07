<script setup lang="ts">
import type { KeyResult } from '@/claw/api/objective'
import { deleteKeyResult, editKeyResult } from '@/claw/api/objective'
import {
  KEY_RESULT_NEXT_STATUSES,
  KEY_RESULT_STATUS_BADGE,
  KEY_RESULT_STATUS_DOT,
  KEY_RESULT_STATUS_LABEL,
} from './constant'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import ExpandableText from '@/components/ExpandableText.vue'
import TextHighlight from '@/components/TextHighlight.vue'
import { copyText } from '@/utils/utils'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Check from '~icons/lucide/check'
import ListTodo from '~icons/lucide/list-todo'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import RotateCcw from '~icons/lucide/rotate-ccw'
import Trash2 from '~icons/lucide/trash-2'
import X from '~icons/lucide/x'
import TaskListViewer from '@/claw/views/Task/TaskListViewer.vue'
import TaskAddModal from '@/claw/views/Task/TaskAddModal.vue'
import ObjectiveKeyResultEditModal from './ObjectiveKeyResultEditModal.vue'

const props = defineProps<{
  keyResult: KeyResult
  keyword?: string
  objectiveTitle?: string
  projectId?: number
}>()
const { t } = useI18n()
const emit = defineEmits<{ refresh: [] }>()

const updating = ref(false)
const showEdit = ref(false)
const showAddTask = ref(false)
const taskListKey = ref(0)

const DOT_CLASS = KEY_RESULT_STATUS_DOT
const STATUS_BADGE = KEY_RESULT_STATUS_BADGE
const STATUS_LABEL = KEY_RESULT_STATUS_LABEL
const NEXT_STATUSES = KEY_RESULT_NEXT_STATUSES

const NEXT_STATUS_ICONS: Record<string, any> = {
  done: Check,
  canceled: X,
  running: RotateCcw,
}

const handleUpdateStatus = async (status: string) => {
  updating.value = true
  try {
    await editKeyResult(props.keyResult.id, { status })
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.objective.detailOperationFailed'))
  } finally {
    updating.value = false
  }
}

const handleDelete = async () => {
  try {
    await deleteKeyResult(props.keyResult.id)
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.objective.detailDeleteFailed'))
  }
}

const handleTaskCreated = () => {
  taskListKey.value++
  emit('refresh')
}

const handleTaskListRefresh = () => {
  taskListKey.value++
  emit('refresh')
}
</script>

<template>
  <div
    class="flex flex-col rounded-lg border transition-all"
    :class="
      keyResult.status === 'done' || keyResult.status === 'canceled'
        ? 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/50'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'
    "
  >
    <!-- 顶部行：状态点 + 内容 + 操作区 -->
    <div class="flex items-start gap-3 p-3">
      <!-- 状态点 -->
      <div class="mt-1 shrink-0">
        <div
          class="w-2.5 h-2.5 rounded-full mt-0.5"
          :class="DOT_CLASS[keyResult.status] || DOT_CLASS.running"
        />
      </div>

      <!-- 内容 -->
      <div class="flex-1 min-w-0">
        <p
          class="text-sm leading-snug"
          :class="
            keyResult.status === 'done' || keyResult.status === 'canceled'
              ? 'text-gray-400 line-through'
              : 'text-gray-800 dark:text-gray-200'
          "
        >
          <TextHighlight :text="keyResult.title" :keyword="keyword" />
        </p>
        <ExpandableText
          v-if="keyResult.detail"
          :text="keyResult.detail"
          class="mt-1"
        />
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span
            class="text-xs text-gray-400 dark:text-gray-500 font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
            :title="t('claw.common.copyIdTooltip')"
            @click.stop="copyText(String(keyResult.id))"
            >#{{ keyResult.id }}</span
          >
          <span
            class="text-xs px-1.5 py-0.5 rounded-full"
            :class="STATUS_BADGE[keyResult.status] || STATUS_BADGE.running"
          >
            {{ STATUS_LABEL[keyResult.status] || keyResult.status }}
          </span>
          <span
            v-if="keyResult.sourceProjectBacklogId"
            class="text-xs text-primary-500"
          >
            {{ t('claw.objective.sourceBacklog') }} #{{
              keyResult.sourceProjectBacklogId
            }}
          </span>
          <span v-if="keyResult.dueAt" class="text-xs text-orange-400">
            {{ t('claw.objective.dueLabel')
            }}<DatetimeViewer :value="keyResult.dueAt" format="date" />
          </span>
          <span v-if="keyResult.estimatedHours" class="text-xs text-primary-400"
            >{{ keyResult.estimatedHours }}h</span
          >
          <span class="text-xs text-gray-400"
            ><DatetimeViewer :value="keyResult.createdAt" format="date"
          /></span>
        </div>
      </div>

      <!-- 操作区 -->
      <div class="flex items-center gap-1 shrink-0">
        <a-dropdown :trigger="['hover']">
          <a-button
            class="flex items-center transition-opacity"
            :loading="updating"
            @click.stop
          >
            <MoreHorizontal
              v-if="!updating"
              class="w-4 h-4 text-gray-500"
              aria-hidden="true"
            />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item @click="showEdit = true">
                <div class="flex items-center gap-2">
                  <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ t('common.edit') }}
                </div>
              </a-menu-item>
              <template
                v-for="s in NEXT_STATUSES[keyResult.status] || []"
                :key="s.value"
              >
                <a-menu-item @click="handleUpdateStatus(s.value)">
                  <div class="flex items-center gap-2">
                    <component
                      :is="NEXT_STATUS_ICONS[s.value]"
                      class="w-3.5 h-3.5"
                      aria-hidden="true"
                    />
                    {{ s.label }}
                  </div>
                </a-menu-item>
              </template>
              <a-menu-item class="!text-red-500" @click="handleDelete">
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

    <!-- 关联任务列表（全宽） -->
    <div class="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-2">
      <div
        class="text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1 mb-2"
      >
        <ListTodo class="w-3.5 h-3.5" />
        {{ t('claw.objective.relatedTasks') }}
        <a-button
          class="ml-auto"
          size="small"
          type="text"
          @click.stop="showAddTask = true"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-3.5 h-3.5" aria-hidden="true" />
            {{ t('common.add') }}
          </div>
        </a-button>
      </div>
      <div class="text-xs">
        <TaskListViewer
          :key="taskListKey"
          :key-result-id="keyResult.id"
          @refresh="handleTaskListRefresh"
        />
      </div>
    </div>

    <ObjectiveKeyResultEditModal
      v-model:open="showEdit"
      :action="keyResult"
      @refresh="emit('refresh')"
    />

    <TaskAddModal
      v-model:open="showAddTask"
      source="keyResult"
      :key-result-id="keyResult.id"
      :objective-id="keyResult.objectiveId"
      :objective-title="objectiveTitle"
      :key-result-title="keyResult.title"
      :project-id="projectId"
      @created="handleTaskCreated"
    />
  </div>
</template>
