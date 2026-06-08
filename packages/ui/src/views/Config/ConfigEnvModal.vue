<script setup lang="ts">
import { message } from 'ant-design-vue'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { userParamEnvSet } from '../../api/userParam'

const props = defineProps<{
  open: boolean
  editingName: string | null
  editingValue: string
  existingNames: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const { t } = useI18n()

const saving = ref(false)
const form = reactive({ name: '', value: '' })
const formErrors = reactive({ name: '', value: '' })

watch(
  () => props.open,
  (val) => {
    if (!val) return
    form.name = props.editingName ?? ''
    form.value = props.editingValue
    formErrors.name = ''
    formErrors.value = ''
  }
)

async function handleOk() {
  formErrors.name = ''
  formErrors.value = ''

  if (!form.name.trim()) {
    formErrors.name = t('config.envNameRequired')
    return
  }

  if (!props.editingName && props.existingNames.includes(form.name.trim())) {
    formErrors.name = t('config.envNameExists')
    return
  }

  saving.value = true
  try {
    await userParamEnvSet(props.editingName ?? form.name.trim(), form.value)
    message.success(t('config.envSaveSuccess'))
    emit('update:open', false)
    emit('saved')
  } catch (err: any) {
    const serverMsg: string = err?.response?.data?.msg || ''
    if (
      serverMsg &&
      (serverMsg.includes('exists') || serverMsg.includes('已存在'))
    ) {
      formErrors.name = serverMsg
    } else {
      message.error(serverMsg || t('config.envSaveFailed'))
    }
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  emit('update:open', false)
}
</script>

<template>
  <a-modal
    :open="open"
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :title="editingName ? $t('config.envEditTitle') : $t('config.envAddTitle')"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
    :confirm-loading="saving"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form :model="form" layout="vertical" class="mt-4">
      <a-form-item :label="$t('config.envName')">
        <a-input
          v-model:value="form.name"
          :placeholder="$t('config.envNamePlaceholder')"
          :disabled="!!editingName"
        />
        <div v-if="formErrors.name" class="text-error text-xs mt-1">
          {{ formErrors.name }}
        </div>
      </a-form-item>
      <a-form-item :label="$t('config.envValue')">
        <a-textarea
          v-model:value="form.value"
          :placeholder="$t('config.envValuePlaceholder')"
          :auto-size="{ minRows: 2, maxRows: 6 }"
        />
        <div v-if="formErrors.value" class="text-error text-xs mt-1">
          {{ formErrors.value }}
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
