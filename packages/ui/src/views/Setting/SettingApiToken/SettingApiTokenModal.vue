<template>
  <a-modal
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="
      isEdit ? $t('setting.apiTokenEditTitle') : $t('setting.apiTokenAddTitle')
    "
    :confirm-loading="saving"
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <div class="py-2">
      <a-form layout="vertical" :model="form">
        <a-form-item :label="$t('setting.apiTokenFieldTitle')">
          <a-input
            v-model:value="form.title"
            :placeholder="$t('setting.apiTokenFieldTitlePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('setting.apiTokenFieldPermissions')" required>
          <div
            class="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <GroupLabelMultiSelector
              v-model:model-value="form.permissions"
              :groups="PERMISSION_OPTIONS"
            />
          </div>
        </a-form-item>
        <a-form-item :label="$t('setting.apiTokenFieldExpire')" required>
          <a-date-picker
            v-model:value="form.expireMoment"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            :placeholder="$t('setting.apiTokenSelectExpire')"
            class="w-full"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import dayjs, { Dayjs } from 'dayjs'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  addApiToken,
  editApiToken,
  type ApiTokenRecord,
} from '../../../api/apiToken.ts'
import GroupLabelMultiSelector from '../../../components/GroupLabelMultiSelector.vue'
import { usePermissionOptions } from './index.ts'
import { testActionSet, testActionUnset } from '@/utils/test'

const { PERMISSION_OPTIONS } = usePermissionOptions()

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  record?: ApiTokenRecord | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const isEdit = ref(false)
const saving = ref(false)

const form = reactive({
  permissions: [] as string[],
  expireMoment: null as Dayjs | null,
  title: '',
})

watch(
  () => props.open,
  (val) => {
    if (!val) return
    if (props.record) {
      isEdit.value = true
      form.permissions = props.record.permissions
        ? props.record.permissions.split(',').filter(Boolean)
        : []
      form.expireMoment = dayjs(props.record.expire)
      form.title = props.record.title ?? ''
    } else {
      isEdit.value = false
      form.permissions = []
      form.expireMoment = dayjs().add(1, 'year')
      form.title = ''
    }
  }
)

async function handleOk() {
  if (!form.expireMoment) {
    message.warning(t('setting.apiTokenExpireRequired'))
    return
  }
  saving.value = true
  try {
    const permissionsStr = form.permissions.join(',')
    const expireStr = form.expireMoment.format('YYYY-MM-DD HH:mm:ss')
    if (isEdit.value && props.record) {
      await editApiToken({
        id: props.record.id,
        permissions: permissionsStr,
        expire: expireStr,
        title: form.title,
      })
      message.success(t('setting.apiTokenEditSuccess'))
    } else {
      await addApiToken({
        permissions: permissionsStr,
        expire: expireStr,
        title: form.title,
      })
      message.success(t('setting.apiTokenAddSuccess'))
    }
    emit('update:open', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  testActionSet('apiToken.add.fill', () => {
    form.title = `TestToken_${Date.now()}`
  })
  testActionSet('apiToken.add.submit', () => handleOk())
})
onUnmounted(() => {
  testActionUnset('apiToken.add.fill')
  testActionUnset('apiToken.add.submit')
})
</script>
