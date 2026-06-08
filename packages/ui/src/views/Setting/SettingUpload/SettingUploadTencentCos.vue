<script setup lang="ts">
import type { TencentCosConfig } from '@/api/setting'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const TENCENT_REGIONS = computed(() => [
  { value: 'ap-guangzhou', label: t('settingUpload.tencentRegionGuangzhou') },
  { value: 'ap-shanghai', label: t('settingUpload.tencentRegionShanghai') },
  { value: 'ap-beijing', label: t('settingUpload.tencentRegionBeijing') },
  { value: 'ap-chengdu', label: 'Southwest (Chengdu)' },
  { value: 'ap-chongqing', label: 'Southwest (Chongqing)' },
  { value: 'ap-nanjing', label: t('settingUpload.tencentRegionNanjing') },
  { value: 'ap-hongkong', label: 'Hong Kong, Macao, Taiwan (Hong Kong)' },
  { value: 'ap-singapore', label: t('settingUpload.tencentRegionSingapore') },
  { value: 'ap-tokyo', label: t('settingUpload.tencentRegionTokyo') },
  { value: 'na-toronto', label: t('settingUpload.tencentRegionToronto') },
  { value: 'eu-frankfurt', label: t('settingUpload.tencentRegionFrankfurt') },
])

const config = defineModel<TencentCosConfig>('config', { required: true })
</script>

<template>
  <div>
    <a-form-item label="SecretId" required>
      <a-input v-model:value="config.secretId" placeholder="SecretId" />
    </a-form-item>
    <a-form-item label="SecretKey" required>
      <a-input-password
        v-model:value="config.secretKey"
        placeholder="SecretKey"
      />
    </a-form-item>
    <a-form-item
      :label="$t('settingUpload.fieldBucket')"
      required
      :help="$t('settingUpload.tencentBucketHelp')"
    >
      <a-input
        v-model:value="config.bucket"
        placeholder="mybucket-1250000000"
      />
    </a-form-item>
    <a-form-item :label="$t('settingUpload.fieldRegion')" required>
      <a-select v-model:value="config.region">
        <a-select-option
          v-for="r in TENCENT_REGIONS"
          :key="r.value"
          :value="r.value"
        >
          {{ r.label }} ({{ r.value }})
        </a-select-option>
      </a-select>
    </a-form-item>
  </div>
</template>
