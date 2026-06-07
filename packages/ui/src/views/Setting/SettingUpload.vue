<script setup lang="ts">
import {
  getUploadSetting,
  saveUploadSetting,
  testUploadSetting,
  type UploadSetting,
} from '@/api/setting'
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import FlaskConical from '~icons/lucide/flask-conical'
import Save from '~icons/lucide/save'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingUploadAliyunOss from './SettingUpload/SettingUploadAliyunOss.vue'
import SettingUploadAwsS3 from './SettingUpload/SettingUploadAwsS3.vue'
import SettingUploadAzureBlob from './SettingUpload/SettingUploadAzureBlob.vue'
import SettingUploadLocal from './SettingUpload/SettingUploadLocal.vue'
import SettingUploadQiniu from './SettingUpload/SettingUploadQiniu.vue'
import SettingUploadTencentCos from './SettingUpload/SettingUploadTencentCos.vue'

const { t } = useI18n()

const DRIVER_OPTIONS = computed(() => [
  { value: 'local', label: t('settingUpload.providerLocal') },
  { value: 'aliyun-oss', label: t('settingUpload.providerAliyunOss') },
  { value: 'tencent-cos', label: t('settingUpload.providerTencentCos') },
  { value: 'qiniu', label: t('settingUpload.providerQiniu') },
  { value: 'aws-s3', label: t('settingUpload.providerAwsS3') },
  { value: 'azure-blob', label: t('settingUpload.providerAzureMsBlob') },
])

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)

const form = reactive<Required<UploadSetting> & { local: { path: string } }>({
  type: 'local',
  url: '',
  limitExt: 'jpg,png,gif,svg,doc,docx,xls,xlsx',
  limitSize: 1024000,
  local: { path: '' },
  aliyunOss: {
    accessKeyId: '',
    accessKeySecret: '',
    bucket: '',
    region: 'oss-cn-hangzhou',
    endpoint: '',
  },
  tencentCos: {
    secretId: '',
    secretKey: '',
    bucket: '',
    region: 'ap-guangzhou',
  },
  qiniu: { accessKey: '', secretKey: '', bucket: '', region: 'z0' },
  awsS3: {
    accessKeyId: '',
    secretAccessKey: '',
    bucket: '',
    region: 'us-east-1',
    endpoint: '',
  },
  azureBlob: {
    accountName: '',
    accountKey: '',
    containerName: '',
    endpoint: '',
  },
})

const limitSizeMB = computed({
  get: () => parseFloat((form.limitSize / 1024 / 1024).toFixed(2)),
  set: (v: number) => {
    form.limitSize = Math.round(v * 1024 * 1024)
  },
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await getUploadSetting()
    form.type = data.type || 'local'
    form.url = data.url || ''
    form.limitExt = data.limitExt || ''
    form.limitSize = data.limitSize ?? 1024000
    if (data.local?.path !== undefined) form.local.path = data.local.path
    if (data.aliyunOss) Object.assign(form.aliyunOss, data.aliyunOss)
    if (data.tencentCos) Object.assign(form.tencentCos, data.tencentCos)
    if (data.qiniu) Object.assign(form.qiniu, data.qiniu)
    if (data.awsS3) Object.assign(form.awsS3, data.awsS3)
    if (data.azureBlob) Object.assign(form.azureBlob, data.azureBlob)
  } catch {
    message.error(t('settingUpload.loadConfigFailed'))
  } finally {
    loading.value = false
  }
}

function buildPayload(): Partial<UploadSetting> {
  const payload: Partial<UploadSetting> = {
    type: form.type,
    url: form.url,
    limitExt: form.limitExt,
    limitSize: form.limitSize,
  }
  if (form.type === 'local') payload.local = { path: form.local.path }
  if (form.type === 'aliyun-oss') payload.aliyunOss = { ...form.aliyunOss }
  if (form.type === 'tencent-cos') payload.tencentCos = { ...form.tencentCos }
  if (form.type === 'qiniu') payload.qiniu = { ...form.qiniu }
  if (form.type === 'aws-s3') payload.awsS3 = { ...form.awsS3 }
  if (form.type === 'azure-blob') payload.azureBlob = { ...form.azureBlob }
  return payload
}

async function handleSave() {
  saving.value = true
  try {
    await saveUploadSetting(buildPayload())
    message.success(t('settingUpload.saveSuccess'))
  } catch (e: unknown) {
    message.error(
      e instanceof Error ? e.message : t('settingUpload.saveFailed')
    )
  } finally {
    saving.value = false
  }
}

async function handleTest() {
  testing.value = true
  try {
    const result = await testUploadSetting(buildPayload())
    message.success(t('settingUpload.testSuccess', { url: result.url }))
  } catch (e: unknown) {
    message.error(
      e instanceof Error ? e.message : t('settingUpload.testFailed')
    )
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <LoadingState :loading="loading">
    <div class="max-w-2xl pt-2 space-y-8">
      <!-- 通用设置 -->
      <div>
        <div
          class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4"
        >
          {{ $t('settingUpload.commonSettings') }}
        </div>
        <a-form layout="vertical">
          <a-form-item
            :label="$t('settingUpload.fieldAccessUrl')"
            :help="$t('settingUpload.fieldAccessUrlHelp')"
          >
            <a-input
              v-model:value="form.url"
              placeholder="https://example.com/uploads/"
            />
          </a-form-item>
          <a-form-item
            :label="$t('settingUpload.fieldAllowExt')"
            :help="$t('settingUpload.fieldAllowExtHelp')"
          >
            <a-input
              v-model:value="form.limitExt"
              placeholder="jpg,png,gif,svg"
            />
          </a-form-item>
          <a-form-item :label="$t('settingUpload.fieldSizeLimit')">
            <a-input-number
              v-model:value="limitSizeMB"
              :min="0.1"
              :max="500"
              :step="0.5"
              :precision="2"
              class="w-48"
            />
          </a-form-item>
        </a-form>
      </div>

      <!-- 存储驱动 -->
      <div>
        <div
          class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4"
        >
          {{ $t('settingUpload.storageDriver') }}
        </div>
        <a-form layout="vertical">
          <a-form-item :label="$t('settingUpload.fieldDriverType')" required>
            <a-select v-model:value="form.type" class="w-64">
              <a-select-option
                v-for="opt in DRIVER_OPTIONS"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <SettingUploadLocal
            v-if="form.type === 'local'"
            v-model="form.local.path"
          />
          <SettingUploadAliyunOss
            v-else-if="form.type === 'aliyun-oss'"
            v-model:config="form.aliyunOss"
          />
          <SettingUploadTencentCos
            v-else-if="form.type === 'tencent-cos'"
            v-model:config="form.tencentCos"
          />
          <SettingUploadQiniu
            v-else-if="form.type === 'qiniu'"
            v-model:config="form.qiniu"
          />
          <SettingUploadAwsS3
            v-else-if="form.type === 'aws-s3'"
            v-model:config="form.awsS3"
          />
          <SettingUploadAzureBlob
            v-else-if="form.type === 'azure-blob'"
            v-model:config="form.azureBlob"
          />
        </a-form>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3">
        <a-button type="primary" :loading="saving" @click="handleSave">
          <div class="inline-flex items-center gap-1">
            <Save v-if="!saving" class="w-4 h-4" aria-hidden="true" />
            {{ $t('settingUpload.save') }}
          </div>
        </a-button>
        <a-button :loading="testing" @click="handleTest">
          <div class="inline-flex items-center gap-1">
            <FlaskConical v-if="!testing" class="w-4 h-4" aria-hidden="true" />
            {{ $t('settingUpload.testConnection') }}
          </div>
        </a-button>
      </div>
    </div>
  </LoadingState>
</template>

<style scoped></style>
