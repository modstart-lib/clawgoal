<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="isEdit ? $t('config.proxyEditTitle') : $t('config.proxyAddNew')"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
    :confirm-loading="submitting"
    width="min(600px, 90vw)"
    destroy-on-close
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <a-form
      ref="formRef"
      :model="form"
      :label-col="{ span: 5 }"
      :wrapper-col="{ span: 19 }"
      label-align="right"
      class="mt-4"
    >
      <!-- Name -->
      <a-form-item
        :label="$t('config.proxyName')"
        name="name"
        :rules="[{ required: true, message: $t('config.proxyNameRequired') }]"
      >
        <a-input
          v-model:value="form.name"
          :placeholder="$t('config.proxyNameFormPlaceholder')"
        />
      </a-form-item>

      <!-- Type -->
      <a-form-item :label="$t('config.proxyType')" name="type">
        <a-radio-group v-model:value="form.type" button-style="solid">
          <a-radio-button value="http">HTTP</a-radio-button>
          <a-radio-button value="socks5">SOCKS5</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <!-- Host -->
      <a-form-item
        :label="$t('config.proxyHost')"
        name="host"
        :rules="[{ required: true, message: $t('config.proxyHostRequired') }]"
      >
        <a-input
          v-model:value="form.host"
          :placeholder="$t('config.proxyHostPlaceholder')"
        />
      </a-form-item>

      <!-- Port -->
      <a-form-item
        :label="$t('config.proxyPort')"
        name="port"
        :rules="[{ required: true, message: $t('config.proxyPortRequired') }]"
      >
        <a-input
          v-model:value="form.port"
          :placeholder="$t('config.proxyPortPlaceholder')"
          style="width: 160px"
        />
      </a-form-item>

      <!-- Username -->
      <a-form-item :label="$t('config.proxyUsername')" name="username">
        <a-input
          v-model:value="form.username"
          :placeholder="$t('config.proxyOptional')"
          autocomplete="off"
        />
      </a-form-item>

      <!-- Password -->
      <a-form-item :label="$t('config.proxyPassword')" name="password">
        <a-input-password
          v-model:value="form.password"
          :placeholder="$t('config.proxyOptional')"
          autocomplete="new-password"
        />
      </a-form-item>

      <!-- Preview URL -->
      <a-form-item v-if="previewUrl" :label="$t('config.proxyPreview')">
        <div
          class="rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1"
        >
          <span
            class="text-xs text-gray-500 dark:text-gray-400 font-mono break-all"
            >{{ previewUrl }}</span
          >
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { ProxyConfig } from '../../../api/config'

const props = defineProps<{
  open: boolean
  initialData?: ProxyConfig | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'submit', entry: ProxyConfig): void
}>()

const formRef = ref()
const submitting = ref(false)

function emptyForm(): ProxyConfig {
  return {
    name: '',
    type: 'http',
    host: '',
    port: '',
    username: '',
    password: '',
  }
}

const form = reactive<ProxyConfig>(emptyForm())

const isEdit = computed(() => !!props.initialData)

const previewUrl = computed(() => {
  if (!form.host || !form.port) return ''
  const proto = form.type === 'socks5' ? 'socks5' : 'http'
  const auth = form.username ? `${form.username}:***@` : ''
  return `${proto}://${auth}${form.host}:${form.port}`
})

watch(
  () => [props.open, props.initialData] as const,
  ([open, data]) => {
    if (!open) return
    if (data) {
      Object.assign(form, { ...emptyForm(), ...data })
    } else {
      Object.assign(form, emptyForm())
    }
  },
  { immediate: true }
)

async function handleOk() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const entry: ProxyConfig = {
      name: form.name.trim(),
      type: form.type,
      host: form.host.trim(),
      port: form.port.trim(),
      username: form.username?.trim() || undefined,
      password: form.password?.trim() || undefined,
    }
    emit('submit', entry)
    emit('update:open', false)
  } finally {
    submitting.value = false
  }
}
</script>
