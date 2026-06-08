<script setup lang="ts">
import type { AliyunOssConfig } from '@/api/setting'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const ALIYUN_REGIONS = computed(() => [
  { value: 'oss-cn-hangzhou', label: t('settingUpload.aliyunRegionHangzhou') },
  { value: 'oss-cn-shanghai', label: t('settingUpload.aliyunRegionShanghai') },
  { value: 'oss-cn-qingdao', label: t('settingUpload.aliyunRegionQingdao') },
  { value: 'oss-cn-beijing', label: t('settingUpload.aliyunRegionBeijing') },
  {
    value: 'oss-cn-zhangjiakou',
    label: t('settingUpload.aliyunRegionZhangjiakou'),
  },
  { value: 'oss-cn-shenzhen', label: t('settingUpload.aliyunRegionShenzhen') },
  {
    value: 'oss-cn-guangzhou',
    label: t('settingUpload.aliyunRegionGuangzhou'),
  },
  { value: 'oss-cn-chengdu', label: 'Southwest (Chengdu)' },
  {
    value: 'oss-ap-southeast-1',
    label: t('settingUpload.aliyunRegionSingapore'),
  },
  { value: 'oss-ap-northeast-1', label: t('settingUpload.aliyunRegionJapan') },
  {
    value: 'oss-eu-central-1',
    label: t('settingUpload.aliyunRegionFrankfurt'),
  },
  { value: 'oss-us-east-1', label: t('settingUpload.aliyunRegionUsEast') },
  { value: 'oss-us-west-1', label: t('settingUpload.aliyunRegionUsWest') },
])

const config = defineModel<AliyunOssConfig>('config', { required: true })
</script>

<template>
  <div>
    <a-form-item label="AccessKey ID" required>
      <a-input v-model:value="config.accessKeyId" placeholder="AccessKey ID" />
    </a-form-item>
    <a-form-item label="AccessKey Secret" required>
      <a-input-password
        v-model:value="config.accessKeySecret"
        placeholder="AccessKey Secret"
      />
    </a-form-item>
    <a-form-item :label="$t('settingUpload.fieldBucket')" required>
      <a-input v-model:value="config.bucket" placeholder="my-bucket" />
    </a-form-item>
    <a-form-item :label="$t('settingUpload.fieldRegion')" required>
      <a-select v-model:value="config.region">
        <a-select-option
          v-for="r in ALIYUN_REGIONS"
          :key="r.value"
          :value="r.value"
        >
          {{ r.label }} ({{ r.value }})
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item
      :label="$t('settingUpload.fieldCustomEndpoint')"
      :help="$t('settingUpload.aliyunEndpointHelp')"
    >
      <a-input
        v-model:value="config.endpoint"
        placeholder="https://oss-cn-hangzhou.aliyuncs.com"
      />
    </a-form-item>
  </div>
</template>
