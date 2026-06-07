<script setup lang="ts">
import type { AwsS3Config } from '@/api/setting'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const AWS_REGIONS = computed(() => [
  { value: 'us-east-1', label: t('settingUpload.awsRegionUsEast1') },
  { value: 'us-west-2', label: t('settingUpload.awsRegionUsWest2') },
  { value: 'ap-east-1', label: t('settingUpload.awsRegionApEast1') },
  { value: 'ap-northeast-1', label: t('settingUpload.awsRegionApNortheast1') },
  { value: 'ap-southeast-1', label: t('settingUpload.awsRegionApSoutheast1') },
  { value: 'ap-southeast-2', label: t('settingUpload.awsRegionApSoutheast2') },
  { value: 'eu-west-1', label: t('settingUpload.awsRegionEuWest1') },
  { value: 'eu-central-1', label: t('settingUpload.awsRegionEuCentral1') },
])

const config = defineModel<AwsS3Config>('config', { required: true })
</script>

<template>
  <div>
    <a-form-item label="Access Key ID" required>
      <a-input v-model:value="config.accessKeyId" placeholder="Access Key ID" />
    </a-form-item>
    <a-form-item label="Secret Access Key" required>
      <a-input-password
        v-model:value="config.secretAccessKey"
        placeholder="Secret Access Key"
      />
    </a-form-item>
    <a-form-item :label="$t('settingUpload.fieldBucket')" required>
      <a-input v-model:value="config.bucket" placeholder="my-bucket" />
    </a-form-item>
    <a-form-item :label="$t('settingUpload.fieldRegion')" required>
      <a-select v-model:value="config.region" show-search>
        <a-select-option
          v-for="r in AWS_REGIONS"
          :key="r.value"
          :value="r.value"
        >
          {{ r.label }} ({{ r.value }})
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item
      :label="$t('settingUpload.fieldCustomEndpoint')"
      :help="$t('settingUpload.awsEndpointHelp')"
    >
      <a-input
        v-model:value="config.endpoint"
        placeholder="https://s3.us-east-1.amazonaws.com"
      />
    </a-form-item>
  </div>
</template>
