<script setup lang="ts">
import SystemDirSelectorButton from '@/components/SystemDirSelectorButton.vue'
const localPath = defineModel<string>({ required: true })
</script>

<template>
  <a-form-item
    :label="$t('settingUpload.fieldStoragePath')"
    :help="$t('settingUpload.fieldStoragePathHelp')"
  >
    <div class="flex gap-2">
      <a-input
        v-model:value="localPath"
        placeholder="{dataPath}/uploads/"
        class="flex-1"
      />
      <SystemDirSelectorButton @select="(p) => (localPath = p)" />
    </div>
  </a-form-item>
</template>
