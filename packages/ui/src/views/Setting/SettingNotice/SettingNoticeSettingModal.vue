<script setup lang="ts">
import { noticeList, type NoticeItem } from '@/api/notice.ts'
import {
  getSettingValue,
  setSettingValue,
  getSettingValueJson,
  setSettingValueJson,
} from '@/api/setting.ts'
import { message } from 'ant-design-vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingNoticeMultiSelector from './SettingNoticeMultiSelector.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const { t } = useI18n()

const startupNoticeEnable = ref(false)
const loginNoticeEnable = ref(false)
const defaultNoticeIds = ref<number[]>([])
const notices = ref<NoticeItem[]>([])
const saving = ref(false)

watch(
  () => props.open,
  async (val) => {
    if (val) {
      const [v1, v2, ids, noticeRecords] = await Promise.all([
        getSettingValue('startup_notice_enable', '0'),
        getSettingValue('login_notice_enable', '0'),
        getSettingValueJson<number[]>('default_notice_ids', []),
        noticeList(),
      ])
      startupNoticeEnable.value = v1 === '1'
      loginNoticeEnable.value = v2 === '1'
      defaultNoticeIds.value = Array.isArray(ids) ? ids : []
      notices.value = noticeRecords
    }
  }
)

async function handleOk() {
  saving.value = true
  try {
    await Promise.all([
      setSettingValue(
        'startup_notice_enable',
        startupNoticeEnable.value ? '1' : '0'
      ),
      setSettingValue(
        'login_notice_enable',
        loginNoticeEnable.value ? '1' : '0'
      ),
      setSettingValueJson('default_notice_ids', defaultNoticeIds.value),
    ])
    message.success(t('settingNoticeSettings.saveSuccess'))
    emit('update:open', false)
  } catch {
    message.error(t('settingNoticeSettings.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <a-modal
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('settingNoticeSettings.title')"
    :ok-text="$t('settingNoticeSettings.saveOk')"
    :confirm-loading="saving"
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <div class="py-2 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('settingNoticeSettings.startupNoticeTitle') }}
          </div>
          <div class="text-xs text-gray-400 mt-0.5">
            {{ $t('settingNoticeSettings.startupNoticeDesc') }}
          </div>
        </div>
        <a-switch v-model:checked="startupNoticeEnable" />
      </div>
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('settingNoticeSettings.loginNoticeTitle') }}
          </div>
          <div class="text-xs text-gray-400 mt-0.5">
            {{ $t('settingNoticeSettings.loginNoticeDesc') }}
          </div>
        </div>
        <a-switch v-model:checked="loginNoticeEnable" />
      </div>
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ $t('settingNoticeSettings.defaultChannelTitle') }}
        </div>
        <div class="text-xs text-gray-400 mb-2">
          {{ $t('settingNoticeSettings.defaultChannelDesc') }}
        </div>
        <SettingNoticeMultiSelector
          v-model:value="defaultNoticeIds"
          :notices="notices"
        />
      </div>
    </div>
  </a-modal>
</template>
