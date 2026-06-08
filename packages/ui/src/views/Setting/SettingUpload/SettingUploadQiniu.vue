<script setup lang="ts">
import type { QiniuConfig } from '@/api/setting'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const QINIU_ZONES = computed(() => [
  { value: 'z0', label: t('settingUpload.qiniuRegionZ0') },
  { value: 'z1', label: t('settingUpload.qiniuRegionZ1') },
  { value: 'z2', label: t('settingUpload.qiniuRegionZ2') },
  { value: 'na0', label: t('settingUpload.qiniuRegionNa0') },
  { value: 'as0', label: t('settingUpload.qiniuRegionAs0') },
])

const config = defineModel<QiniuConfig>('config', { required: true })
</script>

<template>
  <div>
    <a-form-item label="AccessKey" required>
      <a-input v-model:value="config.accessKey" placeholder="AccessKey" />
    </a-form-item>
    <a-form-item label="SecretKey" required>
      <a-input-password
        v-model:value="config.secretKey"
        placeholder="SecretKey"
      />
    </a-form-item>
    <a-form-item :label="$t('settingUpload.fieldBucket')" required>
      <a-input v-model:value="config.bucket" placeholder="my-bucket" />
    </a-form-item>
    <a-form-item :label="$t('settingUpload.fieldStorageZone')" required>
      <a-select v-model:value="config.region">
        <a-select-option
          v-for="z in QINIU_ZONES"
          :key="z.value"
          :value="z.value"
        >
          {{ z.label }} ({{ z.value }})
        </a-select-option>
      </a-select>
    </a-form-item>
  </div>
</template>
