<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="t('claw.objective.editKeyResult')"
    width="min(600px, 90vw)"
    :confirm-loading="saving"
    @cancel="$emit('update:open', false)"
    @ok="handleSave"
  >
    <div class="py-2 space-y-4">
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.objective.krTitleLabel') }}
          <span class="text-red-500">*</span></label
        >
        <a-input
          v-model:value="form.title"
          :placeholder="t('claw.objective.krTitlePlaceholder')"
          class="!rounded-xl"
        />
      </div>
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.objective.krDetailLabel') }}</label
        >
        <a-textarea
          v-model:value="form.detail"
          :placeholder="t('claw.objective.krDetailFullPlaceholder')"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          class="!rounded-xl"
        />
      </div>
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.objective.statusLabel') }}</label
        >
        <a-select v-model:value="form.status" class="w-full">
          <a-select-option value="running">{{
            t('claw.objective.statusRunning')
          }}</a-select-option>
          <a-select-option value="done">{{
            t('claw.objective.statusDone')
          }}</a-select-option>
          <a-select-option value="canceled">{{
            t('claw.objective.statusCanceled')
          }}</a-select-option>
        </a-select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >{{ t('claw.objective.dueDateLabel') }}</label
          >
          <a-date-picker
            v-model:value="form.dueAt"
            class="!w-full"
            :placeholder="t('claw.objective.dueDateSelectPlaceholder')"
            value-format="YYYY-MM-DD"
          />
        </div>
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >{{ t('claw.objective.estimatedHoursLabel') }}</label
          >
          <a-input-number
            v-model:value="form.estimatedHours"
            class="!w-full"
            :min="0.5"
            :step="0.5"
            :placeholder="t('claw.objective.estimatedHoursPlaceholder')"
          />
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { editKeyResult, type KeyResult } from '@/claw/api/objective'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  action: KeyResult | null
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'refresh'): void
}>()

const saving = ref(false)
const form = reactive({
  title: '',
  detail: '',
  status: 'running',
  dueAt: null as string | null,
  estimatedHours: null as number | null,
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
  () => props.action,
  (val) => {
    if (val) {
      form.title = val.title
      form.detail = val.detail
      form.status = val.status
      form.dueAt = val.dueAt || null
      form.estimatedHours = val.estimatedHours ?? null
    }
  }
)

const handleSave = async () => {
  if (!form.title.trim()) {
    message.warning(t('claw.objective.krTitleRequired'))
    return
  }
  if (!props.action) return
  saving.value = true
  try {
    await editKeyResult(props.action.id, {
      title: form.title.trim(),
      detail: form.detail.trim() || undefined,
      status: form.status,
      dueAt: form.dueAt || null,
      estimatedHours: form.estimatedHours ?? null,
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
