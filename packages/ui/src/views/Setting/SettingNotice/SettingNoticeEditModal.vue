<script setup lang="ts">
import apiClient from '@/api/client.ts'
import type { NoticeItem } from '@/api/notice.ts'
import { systemWs } from '@/utils/system.ts'
import { message } from 'ant-design-vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingProxySelector from '../SettingProxy/SettingProxySelector.vue'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  initial?: Partial<NoticeItem> | null
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [item: NoticeItem]
}>()

const NOTICE_TYPES = computed(() => [
  { value: 'url', label: 'Webhook URL' },
  { value: 'email', label: t('settingNotice.typeEmail') },
  { value: 'dingtalk', label: t('settingNotice.typeDingtalk') },
  { value: 'feishu', label: t('settingNotice.typeFeishu') },
  { value: 'wework', label: t('settingNotice.typeWework') },
  { value: 'telegram', label: 'Telegram Bot' },
  { value: 'slack', label: 'Slack Webhook' },
  { value: 'ntfy', label: 'Ntfy' },
])

const saving = ref(false)

// Telegram Chat ID 监听状态
const telegramListening = ref(false)
const telegramListenStatus = ref<'idle' | 'listening' | 'success' | 'error'>(
  'idle'
)
let telegramListenTimer: ReturnType<typeof setTimeout> | null = null
let telegramHandler: ((data: Record<string, unknown>) => void) | null = null

function cleanupTelegramListen() {
  if (telegramHandler) {
    systemWs.off('system:telegramBot:chatIdReceived', telegramHandler)
    telegramHandler = null
  }
  if (telegramListenTimer) {
    clearTimeout(telegramListenTimer)
    telegramListenTimer = null
  }
  telegramListening.value = false
}

onUnmounted(cleanupTelegramListen)

async function startTelegramListen() {
  const botToken = getConfigField('botToken')
  if (!botToken) {
    message.warning(t('settingNotice.telegramBotTokenRequired'))
    return
  }
  cleanupTelegramListen()
  telegramListening.value = true
  telegramListenStatus.value = 'listening'

  telegramHandler = (data: Record<string, unknown>) => {
    if (data.chatId) {
      setConfigField('chatId', String(data.chatId))
      telegramListenStatus.value = 'success'
      telegramListening.value = false
      cleanupTelegramListen()
    } else if (data.error) {
      message.error(String(data.error))
      telegramListenStatus.value = 'error'
      cleanupTelegramListen()
    }
  }
  systemWs.on('system:telegramBot:chatIdReceived', telegramHandler)

  // 超时 60 秒
  telegramListenTimer = setTimeout(() => {
    message.warning(t('settingNotice.telegramListenTimeout'))
    telegramListenStatus.value = 'idle'
    cleanupTelegramListen()
  }, 60000)

  try {
    await apiClient.post('/setting/notice/telegram/startListen', {
      botToken,
      proxyName: form.value.proxyName,
    })
  } catch (e: any) {
    message.error(e?.message ?? t('settingNotice.startListenFailed'))
    cleanupTelegramListen()
    telegramListenStatus.value = 'idle'
  }
}

const form = ref({
  title: '',
  enable: true,
  rateLimitEnable: false,
  rateInterval: 60,
  type: 'url' as string,
  config: {} as Record<string, any>,
  proxyName: null as string | null,
})

const isEdit = computed(() => !!props.initial?.id)
const modalTitle = computed(() =>
  isEdit.value
    ? t('settingNotice.modalTitleEdit')
    : t('settingNotice.modalTitleAdd')
)

watch(
  () => props.open,
  (val) => {
    if (val) {
      telegramListenStatus.value = 'idle'
      cleanupTelegramListen()
      if (props.initial) {
        form.value = {
          title: props.initial.title ?? '',
          enable: props.initial.enable ?? true,
          rateLimitEnable: props.initial.rateLimitEnable ?? false,
          rateInterval: props.initial.rateInterval ?? 60,
          type: props.initial.type ?? 'url',
          config: { ...(props.initial.config ?? {}) },
          proxyName: props.initial.proxyName ?? null,
        }
      } else {
        form.value = {
          title: '',
          enable: true,
          rateLimitEnable: false,
          rateInterval: 60,
          type: 'url',
          config: {},
          proxyName: null,
        }
      }
    }
  }
)

function getConfigField(key: string, defaultVal: any = '') {
  return form.value.config[key] ?? defaultVal
}
function setConfigField(key: string, val: any) {
  form.value.config = { ...form.value.config, [key]: val }
}

async function handleOk() {
  if (!form.value.title.trim()) {
    message.warning(t('settingNotice.titleRequired'))
    return
  }
  saving.value = true
  try {
    emit('saved', {
      ...(props.initial?.id ? { id: props.initial.id } : {}),
      ...form.value,
    } as any)
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  emit('update:open', false)
}
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="modalTitle"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
    :confirm-loading="saving"
    width="95vw"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form layout="vertical" class="mt-4">
      <!-- 基础字段 -->
      <a-form-item :label="$t('settingNotice.fieldType')">
        <a-select
          v-model:value="form.type"
          :options="NOTICE_TYPES"
          @change="form.config = {}"
        />
      </a-form-item>

      <a-form-item :label="$t('settingNotice.fieldTitle')">
        <a-input
          v-model:value="form.title"
          :placeholder="$t('settingNotice.fieldTitlePlaceholder')"
        />
      </a-form-item>

      <div class="flex gap-4">
        <a-form-item :label="$t('settingNotice.fieldEnable')" class="flex-1">
          <a-switch v-model:checked="form.enable" />
        </a-form-item>
        <a-form-item :label="$t('settingNotice.fieldRateLimit')" class="flex-1">
          <a-switch v-model:checked="form.rateLimitEnable" />
        </a-form-item>
        <a-form-item
          :label="$t('settingNotice.fieldRateInterval')"
          class="flex-1"
        >
          <a-input-number
            v-model:value="form.rateInterval"
            :min="1"
            class="w-full"
            :disabled="!form.rateLimitEnable"
          />
        </a-form-item>
      </div>

      <!-- Webhook URL -->
      <template v-if="form.type === 'url'">
        <a-form-item label="Webhook URL">
          <a-input
            :value="getConfigField('url')"
            placeholder="https://example.com/webhook"
            @update:value="setConfigField('url', $event)"
          />
        </a-form-item>
        <div class="flex gap-4">
          <a-form-item :label="$t('settingNotice.fieldMethod')" class="flex-1">
            <a-select
              :value="getConfigField('method', 'POST')"
              :options="[
                { value: 'POST', label: 'POST' },
                { value: 'GET', label: 'GET' },
              ]"
              @update:value="setConfigField('method', $event)"
            />
          </a-form-item>
          <a-form-item :label="$t('settingNotice.fieldKey')" class="flex-1">
            <a-input
              :value="getConfigField('key', 'data')"
              placeholder="data"
              @update:value="setConfigField('key', $event)"
            />
          </a-form-item>
        </div>
      </template>

      <!-- Email -->
      <template v-else-if="form.type === 'email'">
        <div class="flex gap-4">
          <a-form-item :label="$t('settingNotice.smtpServer')" class="flex-1">
            <a-input
              :value="getConfigField('smtpHost')"
              placeholder="smtp.example.com"
              @update:value="setConfigField('smtpHost', $event)"
            />
          </a-form-item>
          <a-form-item
            :label="$t('settingNotice.smtpPort')"
            style="width: 120px"
          >
            <a-input-number
              :value="getConfigField('smtpPort', 465)"
              class="w-full"
              @update:value="setConfigField('smtpPort', $event)"
            />
          </a-form-item>
        </div>
        <div class="flex gap-4">
          <a-form-item :label="$t('settingNotice.username')" class="flex-1">
            <a-input
              :value="getConfigField('smtpUser')"
              placeholder="user@example.com"
              @update:value="setConfigField('smtpUser', $event)"
            />
          </a-form-item>
          <a-form-item :label="$t('settingNotice.password')" class="flex-1">
            <a-input-password
              :value="getConfigField('smtpPassword')"
              @update:value="setConfigField('smtpPassword', $event)"
            />
          </a-form-item>
        </div>
        <a-form-item :label="$t('settingNotice.toEmail')">
          <a-input
            :value="getConfigField('toEmail')"
            placeholder="to@example.com"
            @update:value="setConfigField('toEmail', $event)"
          />
        </a-form-item>
        <a-form-item :label="$t('settingNotice.fromEmail')">
          <a-input
            :value="getConfigField('fromEmail')"
            :placeholder="$t('settingNotice.fromEmailPlaceholder')"
            @update:value="setConfigField('fromEmail', $event)"
          />
        </a-form-item>
      </template>

      <!-- 钉钉 -->
      <template v-else-if="form.type === 'dingtalk'">
        <a-form-item :label="$t('settingNotice.webhookUrl')">
          <a-input
            :value="getConfigField('webhookUrl')"
            placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
            @update:value="setConfigField('webhookUrl', $event)"
          />
        </a-form-item>
        <a-form-item :label="$t('settingNotice.signSecret')">
          <a-input
            :value="getConfigField('secret')"
            :placeholder="$t('settingNotice.signSecretDingPlaceholder')"
            @update:value="setConfigField('secret', $event)"
          />
        </a-form-item>
      </template>

      <!-- 飞书 -->
      <template v-else-if="form.type === 'feishu'">
        <a-form-item :label="$t('settingNotice.webhookUrl')">
          <a-input
            :value="getConfigField('webhookUrl')"
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
            @update:value="setConfigField('webhookUrl', $event)"
          />
        </a-form-item>
        <a-form-item :label="$t('settingNotice.signSecret')">
          <a-input
            :value="getConfigField('secret')"
            :placeholder="$t('settingNotice.signSecretFeishuPlaceholder')"
            @update:value="setConfigField('secret', $event)"
          />
        </a-form-item>
      </template>

      <!-- 企业微信 -->
      <template v-else-if="form.type === 'wework'">
        <a-form-item :label="$t('settingNotice.webhookUrl')">
          <a-input
            :value="getConfigField('webhookUrl')"
            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
            @update:value="setConfigField('webhookUrl', $event)"
          />
        </a-form-item>
      </template>

      <!-- Telegram -->
      <template v-else-if="form.type === 'telegram'">
        <a-form-item label="Bot Token">
          <a-input
            :value="getConfigField('botToken')"
            placeholder="123456:ABC..."
            @update:value="setConfigField('botToken', $event)"
          />
        </a-form-item>
        <a-form-item label="Chat ID">
          <div class="flex gap-2">
            <a-input
              :value="getConfigField('chatId')"
              placeholder="-100xxxxxxxxxx"
              class="flex-1"
              @update:value="setConfigField('chatId', $event)"
            />
            <a-button
              :loading="telegramListening"
              :disabled="telegramListening"
              @click="startTelegramListen"
            >
              <template v-if="telegramListenStatus === 'listening'">{{
                $t('settingNotice.telegramListening')
              }}</template>
              <template v-else-if="telegramListenStatus === 'success'">{{
                $t('settingNotice.telegramListenSuccess')
              }}</template>
              <template v-else>{{
                $t('settingNotice.telegramListen')
              }}</template>
            </a-button>
          </div>
          <div
            v-if="telegramListenStatus === 'listening'"
            class="text-xs text-primary mt-1"
          >
            {{ $t('settingNotice.telegramChatIdHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- Slack -->
      <template v-else-if="form.type === 'slack'">
        <a-form-item label="Incoming Webhook URL">
          <a-input
            :value="getConfigField('webhookUrl')"
            placeholder="https://hooks.slack.com/services/..."
            @update:value="setConfigField('webhookUrl', $event)"
          />
        </a-form-item>
      </template>

      <!-- Ntfy -->
      <template v-else-if="form.type === 'ntfy'">
        <a-form-item :label="$t('settingNotice.ntfyServer')">
          <a-input
            :value="getConfigField('serverUrl', 'https://ntfy.sh')"
            placeholder="https://ntfy.sh"
            @update:value="setConfigField('serverUrl', $event)"
          />
        </a-form-item>
        <a-form-item :label="$t('settingNotice.ntfyTopic')">
          <a-input
            :value="getConfigField('topic')"
            placeholder="my-alerts"
            @update:value="setConfigField('topic', $event)"
          />
        </a-form-item>
        <a-form-item :label="$t('settingNotice.ntfyToken')">
          <a-input
            :value="getConfigField('token')"
            :placeholder="$t('settingNotice.ntfyTokenPlaceholder')"
            @update:value="setConfigField('token', $event)"
          />
        </a-form-item>
      </template>

      <!-- 代理 -->
      <a-form-item :label="$t('settingNotice.proxyField')">
        <SettingProxySelector v-model:value="form.proxyName" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
