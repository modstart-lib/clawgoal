<script setup lang="ts">
import AiGenerating from '@/components/AiGenerating.vue'
import type { Task } from '@/claw/api/task'
import {
  addTask,
  addTaskToKeyResult,
  batchAddTasks,
  batchGenerateTasks,
  changeTaskStatus,
} from '@/claw/api/task'
import { useAgentStore } from '@/claw/stores/agent'
import AgentSelector from '@/claw/views/Agent/AgentSelector.vue'
import TaskSelector from '@/claw/views/Task/TaskSelector.vue'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import PenLine from '~icons/lucide/pen-line'
import Plus from '~icons/lucide/plus'
import Sparkles from '~icons/lucide/sparkles'
import Trash2 from '~icons/lucide/trash-2'
import Wand2 from '~icons/lucide/wand-2'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  source?: 'task' | 'keyResult'
  keyResultId?: number
  objectiveId?: number
  objectiveTitle?: string
  keyResultTitle?: string
  parentId?: number
  parentTitle?: string
  projectId?: number
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [task: Task]
}>()

const createMode = ref<'smart' | 'manual'>('smart')
const batchGenerated = ref(false)
const generating = ref(false)
const userPrompt = ref('')
const batchList = ref<
  {
    title: string
    description: string
    agentId: string | undefined
    dueAt: string | null
    estimatedHours: number | null
    needs: string[]
  }[]
>([])

const submitting = ref(false)
const queueOnAdd = ref(false)
const form = ref({
  title: '',
  description: '',
  agentId: undefined as string | undefined,
  dueAt: null as string | null,
  estimatedHours: null as number | null,
  needs: [] as string[],
})

const agentStore = useAgentStore()

watch(
  () => props.open,
  (val) => {
    if (val) {
      queueOnAdd.value = false
      createMode.value = 'smart'
      batchGenerated.value = false
      batchList.value = []
      userPrompt.value = ''
      form.value = {
        title: '',
        description: '',
        agentId: undefined,
        dueAt: null,
        estimatedHours: null,
        needs: [],
      }
    }
  }
)

onMounted(() => {
  agentStore.load()
  testActionSet('modal.fillTitle', (title: string) => {
    form.value.title = title
    createMode.value = 'manual'
  })
  testActionSet('modal.submit', () => handleOk())
  testActionSet('modal.close', () => emit('update:open', false))
})

onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})

async function handleBatchGenerate() {
  generating.value = true
  try {
    const results = await batchGenerateTasks({
      keyResultId: props.keyResultId,
      objectiveId: props.objectiveId,
      parentId: props.parentId,
      userPrompt: userPrompt.value || undefined,
    })
    batchList.value = results.map((r) => ({
      title: r.title,
      description: r.description,
      agentId: r.agentId != null ? String(r.agentId) : undefined,
      dueAt: r.dueAt || null,
      estimatedHours: r.estimatedHours || null,
      needs: r.needs ?? [],
    }))
    batchGenerated.value = true
  } catch (e: any) {
    message.error(e.message || t('claw.task.genFailed'))
  } finally {
    generating.value = false
  }
}

async function handleBatchSave() {
  const valid = batchList.value.filter((item) => item.title.trim())
  if (valid.length === 0) {
    message.warning(t('claw.task.batchMinOne'))
    return
  }
  submitting.value = true
  try {
    let lastTask: Task | null = null
    if (props.parentId) {
      const created = await batchAddTasks(
        props.parentId,
        valid.map((item) => ({
          title: item.title.trim(),
          description: item.description.trim() || undefined,
          agentId: item.agentId ? Number(item.agentId) : undefined,
          dueAt: item.dueAt || undefined,
          estimatedHours: item.estimatedHours ?? undefined,
          needs: item.needs.length ? item.needs : undefined,
        }))
      )
      lastTask = created[created.length - 1] ?? null
    } else {
      for (const item of valid) {
        let task: Task
        if (props.source === 'keyResult') {
          task = await addTaskToKeyResult({
            keyResultId: props.keyResultId!,
            title: item.title.trim(),
            description: item.description.trim() || undefined,
            agentId: item.agentId ? Number(item.agentId) : undefined,
            dueAt: item.dueAt || undefined,
            estimatedHours: item.estimatedHours ?? undefined,
          })
        } else {
          task = await addTask({
            title: item.title.trim(),
            description: item.description.trim() || undefined,
            agentId: item.agentId,
            dueAt: item.dueAt || undefined,
            estimatedHours: item.estimatedHours ?? undefined,
          })
        }
        lastTask = task
      }
    }
    message.success(t('claw.task.batchAddSuccess', { count: valid.length }))
    if (lastTask) emit('created', lastTask)
    emit('update:open', false)
  } catch (e: any) {
    message.error(e.message || t('claw.task.addFailed'))
  } finally {
    submitting.value = false
  }
}

const handleOk = async () => {
  if (!form.value.title.trim()) {
    message.warning(t('claw.task.titleRequired'))
    return
  }
  submitting.value = true
  try {
    let task: Task
    if (props.source === 'keyResult') {
      task = await addTaskToKeyResult({
        keyResultId: props.keyResultId!,
        title: form.value.title.trim(),
        description: form.value.description.trim() || undefined,
        agentId: form.value.agentId ? Number(form.value.agentId) : undefined,
        dueAt: form.value.dueAt || undefined,
        estimatedHours: form.value.estimatedHours ?? undefined,
      })
    } else {
      task = await addTask({
        title: form.value.title.trim(),
        description: form.value.description.trim() || undefined,
        agentId: form.value.agentId,
        dueAt: form.value.dueAt || undefined,
        estimatedHours: form.value.estimatedHours ?? undefined,
        parentId: props.parentId,
        needs: form.value.needs.length ? form.value.needs : undefined,
        projectId: props.projectId,
      })
    }
    if (queueOnAdd.value) {
      await changeTaskStatus(task.id, 'queue')
      task = { ...task, status: 'queue' }
    }
    message.success(t('claw.task.addSuccess'))
    emit('created', task)
    emit('update:open', false)
  } catch (e: any) {
    message.error(e.message || t('claw.task.addFailed'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <a-modal
    width="95vw"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="parentId ? t('claw.task.addSubtask') : t('claw.task.addTask')"
    :footer="null"
    @cancel="emit('update:open', false)"
  >
    <!-- 关联信息 -->
    <div
      v-if="source === 'keyResult' && (objectiveTitle || keyResultTitle)"
      class="mt-4 mb-2 flex flex-wrap gap-2"
    >
      <span
        v-if="objectiveTitle"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50"
      >
        {{ t('claw.task.labelObjective') }}：{{ objectiveTitle }}
      </span>
      <span
        v-if="keyResultTitle"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-100 dark:border-purple-800/50"
      >
        {{ t('claw.task.labelKeyResult') }}：{{ keyResultTitle }}
      </span>
    </div>

    <!-- 父任务提示 -->
    <div v-if="parentId && parentTitle" class="mt-4 mb-2">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-100 dark:border-orange-800/50"
      >
        {{ t('claw.task.labelParentTask') }}：{{ parentTitle }}
      </span>
    </div>

    <a-tabs v-model:active-key="createMode" class="mt-2">
      <!-- 智能创建 Tab -->
      <a-tab-pane key="smart">
        <template #tab>
          <span class="flex items-center gap-1">
            <Sparkles class="w-4 h-4" />
            {{ t('claw.task.smartCreate') }}
          </span>
        </template>
        <div class="py-2">
          <template v-if="!batchGenerated">
            <div class="mb-3">
              <a-textarea
                v-model:value="userPrompt"
                :placeholder="t('claw.task.smartPromptPlaceholder')"
                :rows="3"
                :maxlength="500"
              />
            </div>
            <div class="py-2">
              <AiGenerating v-if="generating" />
              <a-button
                v-else
                type="primary"
                block
                @click="handleBatchGenerate"
              >
                <div class="inline-flex items-center gap-1">
                  <Wand2 class="w-4 h-4" aria-hidden="true" />
                  {{ t('claw.task.aiBatchGenerate') }}
                </div>
              </a-button>
            </div>
          </template>
          <template v-else>
            <div class="space-y-3 mb-4">
              <div
                v-for="(item, idx) in batchList"
                :key="idx"
                class="relative border border-gray-200 dark:border-gray-700 rounded-xl p-3 pt-7 space-y-2"
              >
                <span
                  class="absolute top-2 left-3 text-xs font-medium text-gray-400"
                  >{{ idx + 1 }}</span
                >
                <div class="flex items-center gap-2">
                  <a-input
                    v-model:value="item.title"
                    :placeholder="$t('claw.task.addTitlePlaceholder')"
                    class="!rounded-lg flex-1"
                  />
                  <a-button
                    class="inline-flex items-center shrink-0"
                    danger
                    @click="batchList.splice(idx, 1)"
                  >
                    <Trash2 class="w-4 h-4" aria-hidden="true" />
                  </a-button>
                </div>
                <a-textarea
                  v-model:value="item.description"
                  :placeholder="$t('claw.task.addDescPlaceholder')"
                  :auto-size="{ minRows: 2, maxRows: 4 }"
                  class="!rounded-lg"
                />
                <div class="grid grid-cols-3 gap-2">
                  <AgentSelector
                    v-model:value="item.agentId"
                    :empty-label="t('claw.task.manualExecution')"
                    :allow-clear="true"
                    :project-id="props.projectId"
                  />
                  <a-date-picker
                    v-model:value="item.dueAt"
                    class="!w-full"
                    :placeholder="t('claw.task.dueDatePlaceholder')"
                    value-format="YYYY-MM-DD"
                  />
                  <a-input-number
                    v-model:value="item.estimatedHours"
                    class="!w-full"
                    :min="0.5"
                    :step="0.5"
                    :placeholder="t('claw.task.estimatedHoursPlaceholder')"
                  />
                </div>
                <TaskSelector
                  v-if="parentId"
                  v-model="item.needs"
                  :parent-id="parentId"
                  :batch-tasks="
                    batchList
                      .map((b, i) => ({ index: i, title: b.title }))
                      .filter((_, i) => i !== idx)
                  "
                />
              </div>
            </div>
            <div class="flex items-center justify-between">
              <a-button @click="batchGenerated = false">{{
                t('claw.task.regenerate')
              }}</a-button>
              <a-button
                type="primary"
                :loading="submitting"
                :disabled="batchList.length === 0"
                @click="handleBatchSave"
              >
                <div class="inline-flex items-center gap-1">
                  <Plus class="w-4 h-4" aria-hidden="true" />
                  {{ t('claw.task.batchAdd') }}
                </div>
              </a-button>
            </div>
          </template>
        </div>
      </a-tab-pane>

      <!-- 手动创建 Tab -->
      <a-tab-pane key="manual">
        <template #tab>
          <span class="flex items-center gap-1">
            <PenLine class="w-4 h-4" />
            {{ t('claw.task.manualCreate') }}
          </span>
        </template>
        <a-form layout="vertical" class="mt-2">
          <a-form-item :label="$t('claw.task.title')" required>
            <a-input
              v-model:value="form.title"
              :placeholder="$t('claw.task.addTitlePlaceholder')"
              :maxlength="200"
            />
          </a-form-item>
          <a-form-item :label="t('claw.task.descLabel')">
            <a-textarea
              v-model:value="form.description"
              :placeholder="$t('claw.task.addDescPlaceholder')"
              :rows="4"
              :maxlength="2000"
            />
          </a-form-item>
          <a-form-item :label="t('claw.task.agentLabel')">
            <AgentSelector
              v-model:value="form.agentId"
              :empty-label="t('claw.task.manualExecution')"
              :allow-clear="true"
              :project-id="props.projectId"
            />
          </a-form-item>
          <div class="grid grid-cols-2 gap-3">
            <a-form-item :label="t('claw.task.dueDateLabel')">
              <a-date-picker
                v-model:value="form.dueAt"
                class="!w-full"
                :placeholder="t('claw.task.dueDatePlaceholder')"
                value-format="YYYY-MM-DD"
              />
            </a-form-item>
            <a-form-item :label="t('claw.task.estimatedHoursLabel')">
              <a-input-number
                v-model:value="form.estimatedHours"
                class="!w-full"
                :min="0.5"
                :step="0.5"
                :placeholder="t('claw.task.estimatedHoursPlaceholder')"
              />
            </a-form-item>
          </div>
          <a-form-item
            v-if="parentId"
            :label="t('claw.task.prerequisitesLabel')"
          >
            <TaskSelector v-model="form.needs" :parent-id="parentId" />
          </a-form-item>
          <a-form-item>
            <a-checkbox v-model:checked="queueOnAdd">{{
              t('claw.task.queueOnAdd')
            }}</a-checkbox>
            <p class="text-xs text-gray-400 mt-0.5 ml-5">
              {{ t('claw.task.queueOnAddHint') }}
            </p>
          </a-form-item>
          <div class="flex justify-end -mt-2">
            <a-button type="primary" :loading="submitting" @click="handleOk">
              <div class="inline-flex items-center gap-1">
                <Plus class="w-4 h-4" aria-hidden="true" />
                {{ $t('common.confirm') }}
              </div>
            </a-button>
          </div>
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>
