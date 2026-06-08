<script setup lang="ts">
import type { AzureBlobConfig } from '@/api/setting'
const config = defineModel<AzureBlobConfig>('config', { required: true })
</script>

<template>
  <div>
    <a-form-item :label="$t('settingUpload.fieldAccountName')" required>
      <a-input
        v-model:value="config.accountName"
        placeholder="mystorageaccount"
      />
    </a-form-item>
    <a-form-item :label="$t('settingUpload.fieldAccountKey')" required>
      <a-input-password
        v-model:value="config.accountKey"
        placeholder="account key"
      />
    </a-form-item>
    <a-form-item :label="$t('settingUpload.fieldContainerName')" required>
      <a-input
        v-model:value="config.containerName"
        placeholder="my-container"
      />
    </a-form-item>
    <a-form-item
      :label="$t('settingUpload.fieldCustomEndpoint')"
      :help="$t('settingUpload.azureEndpointHelp')"
    >
      <a-input
        v-model:value="config.endpoint"
        placeholder="https://mystorageaccount.blob.core.windows.net"
      />
    </a-form-item>
  </div>
</template>
