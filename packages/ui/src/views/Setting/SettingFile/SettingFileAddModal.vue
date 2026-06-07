<script setup lang="ts">
defineProps<{
  open: boolean
  filePath: string
  content: string
  saving: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:filePath': [value: string]
  'update:content': [value: string]
  create: []
}>()
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('settingFile.newFile')"
    width="95vw"
    :confirm-loading="saving"
    :ok-text="$t('settingFile.add')"
    :cancel-text="$t('common.cancel')"
    @ok="emit('create')"
    @update:open="emit('update:open', $event)"
  >
    <a-form layout="vertical">
      <a-form-item :label="$t('settingFile.filePath')">
        <a-input
          :value="filePath"
          :placeholder="$t('settingFile.filePathPlaceholder')"
          @change="
            emit('update:filePath', ($event.target as HTMLInputElement).value)
          "
        />
      </a-form-item>
      <a-form-item :label="$t('settingFile.initialContent')">
        <a-textarea
          :value="content"
          :auto-size="{ minRows: 6, maxRows: 16 }"
          class="font-mono text-sm"
          @change="
            emit('update:content', ($event.target as HTMLTextAreaElement).value)
          "
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
