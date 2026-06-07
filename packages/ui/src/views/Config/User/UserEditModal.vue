<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="isEdit ? $t('config.userEditTitle') : $t('config.userAddTitle')"
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
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 18 }"
      label-align="right"
      class="mt-4"
    >
      <a-form-item
        :label="$t('config.userUsername')"
        name="username"
        :rules="[
          { required: true, message: $t('config.userUsernameRequired') },
        ]"
      >
        <a-input
          v-model:value="form.username"
          :placeholder="$t('config.userUsername')"
        />
      </a-form-item>

      <a-form-item
        :label="$t('config.userPassword')"
        name="password"
        :rules="
          isEdit
            ? []
            : [{ required: true, message: $t('config.userPasswordRequired') }]
        "
      >
        <a-input-password
          v-model:value="form.password"
          :placeholder="
            isEdit
              ? $t('config.userPasswordOptional')
              : $t('config.userPassword')
          "
          autocomplete="new-password"
        />
      </a-form-item>

      <a-form-item :label="$t('config.userIsCreator')">
        <a-switch v-model:checked="form.isCreator" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { UserRecord } from '@/api/user.ts'

const props = defineProps<{
  open: boolean
  initialData?: UserRecord | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (
    e: 'submit',
    entry: { username: string; password: string; isCreator: boolean }
  ): void
}>()

const formRef = ref()
const submitting = ref(false)

const form = reactive({
  username: '',
  password: '',
  isCreator: false,
})

const isEdit = computed(() => !!props.initialData)

watch(
  () => [props.open, props.initialData] as const,
  ([open, data]) => {
    if (!open) return
    if (data) {
      form.username = data.username
      form.password = ''
      form.isCreator = data.isCreator
    } else {
      form.username = ''
      form.password = ''
      form.isCreator = false
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
    emit('submit', {
      username: form.username.trim(),
      password: form.password,
      isCreator: form.isCreator,
    })
  } finally {
    submitting.value = false
  }
}
</script>
