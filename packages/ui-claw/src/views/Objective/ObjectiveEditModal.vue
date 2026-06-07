<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="t('claw.objective.editTitle')"
    width="min(600px, 90vw)"
    :confirm-loading="saving"
    @cancel="$emit('update:open', false)"
    @ok="handleSave"
  >
    <div class="py-2 space-y-4">
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.objective.nameLabel') }}
          <span class="text-red-500">*</span></label
        >
        <a-input
          v-model:value="form.title"
          :placeholder="t('claw.objective.namePlaceholder')"
          class="!rounded-xl"
        />
      </div>
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.objective.descriptionLabel') }}</label
        >
        <a-textarea
          v-model:value="form.description"
          :placeholder="t('claw.objective.descriptionPlaceholder')"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          class="!rounded-xl"
        />
      </div>
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.objective.iconStyle') }}</label
        >
        <IconSelector v-model="form.icon" />
      </div>
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.objective.statusLabel') }}</label
        >
        <a-select v-model:value="form.status" class="w-full">
          <a-select-option value="pending">{{
            t('claw.objective.statusPending')
          }}</a-select-option>
          <a-select-option value="active">{{
            t('claw.objective.statusActive')
          }}</a-select-option>
          <a-select-option value="paused">{{
            t('claw.objective.statusPaused')
          }}</a-select-option>
          <a-select-option value="completed">{{
            t('claw.objective.statusCompleted')
          }}</a-select-option>
          <a-select-option value="failed">{{
            t('claw.objective.statusFailed')
          }}</a-select-option>
        </a-select>
      </div>
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.objective.dueDateLabel') }}</label
        >
        <a-date-picker
          v-model:value="form.dueAt"
          class="!w-full"
          :placeholder="t('claw.objective.dueDatePlaceholder')"
          value-format="YYYY-MM-DD"
        />
      </div>
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.objective.resultLabel') }}</label
        >
        <a-textarea
          v-model:value="form.result"
          :placeholder="t('claw.objective.resultPlaceholder')"
          :auto-size="{ minRows: 2, maxRows: 4 }"
          class="!rounded-xl"
        />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { editObjective, type Objective } from '@/claw/api/objective'
import IconSelector from '@/components/IconSelector.vue'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { testActionSet, testActionUnset } from '@/utils/test'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  objective: Objective | null
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'refresh'): void
}>()

const saving = ref(false)

const form = reactive({
  title: '',
  description: '',
  icon: 'Target' as string | null,
  status: 'active',
  dueAt: null as string | null,
  result: '',
})

onMounted(() => {
  testActionSet('modal.fillTitle', (val: string) => {
    form.title = val
  })
  testActionSet('modal.submit', () => handleSave())
  testActionSet('modal.close', () => emit('update:open', false))
})
onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})

watch(
  () => props.objective,
  (obj) => {
    if (obj) {
      form.title = obj.title
      form.description = obj.description || ''
      form.icon = obj.icon || 'Target'
      form.status = obj.status
      form.dueAt = obj.dueAt || null
      form.result = obj.result || ''
    }
  }
)

const handleSave = async () => {
  if (!form.title.trim()) {
    message.warning(t('claw.objective.nameRequired'))
    return
  }
  if (!props.objective) return
  saving.value = true
  try {
    await editObjective(props.objective.id, {
      title: form.title.trim(),
      description: form.description || undefined,
      icon: form.icon || undefined,
      status: form.status,
      dueAt: form.dueAt || null,
      result: form.result || undefined,
      projectId: props.objective.projectId ?? null,
    })
    message.success(t('claw.objective.editSuccess'))
    emit('refresh')
    emit('update:open', false)
  } catch (e: any) {
    message.error(e.message || t('claw.objective.editFailed'))
  } finally {
    saving.value = false
  }
}
</script>
