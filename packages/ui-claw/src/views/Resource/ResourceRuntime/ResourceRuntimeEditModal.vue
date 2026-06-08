<template>
  <a-modal
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('claw.resource.editRuntimeTitle')"
    :ok-text="$t('claw.resource.saveBtn')"
    :cancel-text="$t('claw.resource.cancelBtn')"
    :confirm-loading="saving"
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" class="mt-4">
      <a-form-item :label="$t('claw.resource.runtimeNameLabel')">
        <a-input :value="form.name" disabled />
      </a-form-item>
      <a-form-item :label="$t('claw.resource.runtimeTitleLabel')" required>
        <a-input
          v-model:value="form.title"
          :placeholder="$t('claw.resource.runtimeTitlePlaceholder')"
        />
      </a-form-item>
      <a-form-item :label="$t('claw.resource.tokenLabel')">
        <a-input-group compact>
          <a-input
            v-model:value="form.token"
            class="w-[calc(100%-45px)]!"
            readonly
          />
          <a-button type="default" @click="form.token = generateToken()">
            <RefreshCw class="w-3.5 h-3.5" aria-hidden="true" />
          </a-button>
        </a-input-group>
        <div class="text-xs text-gray-400 mt-1">
          {{ $t('claw.resource.tokenHint') }}
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import RefreshCw from '~icons/lucide/refresh-cw'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { updateRuntime, type RuntimeRow } from '@/claw/api/runtime'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{ open: boolean; connector: RuntimeRow | null }>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'updated', row: RuntimeRow): void
}>()

const saving = ref(false)
const form = reactive({ name: '', title: '', token: '' })

const generateToken = () => {
  const arr = new Uint8Array(24)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

watch(
  () => props.open,
  (val) => {
    if (val && props.connector) {
      form.name = props.connector.name
      form.title = props.connector.title
      form.token = props.connector.token
    }
  }
)

const handleOk = async () => {
  if (!form.title.trim()) {
    message.warning(t('claw.resource.titleRequired'))
    return
  }
  if (!props.connector) return
  saving.value = true
  try {
    const row = await updateRuntime({
      id: props.connector.id,
      title: form.title.trim(),
      token: form.token,
    })
    emit('updated', row)
    emit('update:open', false)
    message.success(t('claw.resource.runtimeUpdated'))
  } catch {
    message.error(t('claw.resource.editFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  testActionSet('modal.fillTitle', (title: string) => {
    form.title = title
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
