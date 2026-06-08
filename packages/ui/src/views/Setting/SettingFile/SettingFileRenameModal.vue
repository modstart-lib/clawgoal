<script setup lang="ts">
defineProps<{
  open: boolean
  newName: string
  loading: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:newName': [value: string]
  confirm: []
}>()
</script>

<template>
  <a-modal
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('settingFile.rename')"
    :confirm-loading="loading"
    :ok-text="$t('common.confirm')"
    :cancel-text="$t('common.cancel')"
    @ok="emit('confirm')"
    @update:open="emit('update:open', $event)"
  >
    <a-form layout="vertical">
      <a-form-item :label="$t('settingFile.newName')">
        <a-input
          :value="newName"
          @change="
            emit('update:newName', ($event.target as HTMLInputElement).value)
          "
          @keyup.enter="emit('confirm')"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
