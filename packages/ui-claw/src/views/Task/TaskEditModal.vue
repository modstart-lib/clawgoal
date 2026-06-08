<script setup lang="ts">
import { editTask } from '@/claw/api/task'
import { useAgentStore } from '@/claw/stores/agent'
import AgentSelector from '@/claw/views/Agent/AgentSelector.vue'
import TaskSelector from '@/claw/views/Task/TaskSelector.vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { testActionSet, testActionUnset } from '@/utils/test'

interface TaskItem {
  id: number
  title: string
  description?: string
  agentId?: number | null
  projectId?: number | null
  dueAt?: string
  estimatedHours?: number | null
  parentId?: number
  needs?: string[]
}

const { t } = useI18n()

const props = defineProps<{ open: boolean; task: TaskItem | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; updated: [] }>()

const submitting = ref(false)
const form = ref({
  title: '',
  description: '',
  agentId: undefined as string | undefined,
  dueAt: null as string | null,
  estimatedHours: null as number | null,
  needs: [] as string[],
})

watch(
  () => props.open,
  async (val) => {
    if (val && props.task) {
      useAgentStore().load()
      form.value = {
        title: props.task.title,
        description: props.task.description ?? '',
        agentId: props.task.agentId ? String(props.task.agentId) : undefined,
        dueAt: props.task.dueAt || null,
        estimatedHours: props.task.estimatedHours ?? null,
        needs: props.task.needs ?? [],
      }
    }
  }
)

const handleOk = async () => {
  if (!form.value.title.trim()) {
    message.warning(t('claw.task.titleRequired'))
    return
  }
  if (!props.task) return
  submitting.value = true
  try {
    await editTask({
      id: props.task.id,
      title: form.value.title.trim(),
      description: form.value.description.trim() || null,
      agentId: form.value.agentId ? Number(form.value.agentId) : null,
      dueAt: form.value.dueAt || null,
      estimatedHours: form.value.estimatedHours ?? null,
      needs: form.value.needs,
    })
    message.success(t('claw.task.editSuccess'))
    emit('update:open', false)
    emit('updated')
  } catch (e: any) {
    message.error(e.message || t('claw.task.editFailed'))
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  testActionSet('modal.fillTitle', (title: string) => {
    form.value.title = title
  })
  testActionSet('modal.submit', () => handleOk())
  testActionSet('modal.close', () => emit('update:open', false))
})

onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})
</script>

<template>
  <a-modal
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="t('claw.task.editTitle')"
    :confirm-loading="submitting"
    :ok-text="t('common.save')"
    :cancel-text="t('common.cancel')"
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" class="mt-4">
      <a-form-item :label="t('claw.task.titleLabel')" required>
        <a-input
          v-model:value="form.title"
          :placeholder="t('claw.task.addTitlePlaceholder')"
          :maxlength="200"
        />
      </a-form-item>

      <a-form-item :label="t('claw.task.agentLabel')">
        <AgentSelector
          v-model:value="form.agentId"
          :placeholder="t('claw.task.agentPlaceholder')"
          :project-id="task?.projectId ?? undefined"
        />
      </a-form-item>

      <a-form-item :label="t('claw.task.descLabel')">
        <a-textarea
          v-model:value="form.description"
          :placeholder="t('claw.task.addDescPlaceholder')"
          :rows="4"
          :maxlength="2000"
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
        v-if="task?.parentId"
        :label="t('claw.task.prerequisitesLabel')"
      >
        <TaskSelector
          v-model="form.needs"
          :parent-id="task.parentId"
          :exclude-id="task?.id"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
