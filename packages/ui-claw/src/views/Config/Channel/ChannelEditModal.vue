<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="
      isEdit ? $t('config.channelEditTitle') : $t('config.channelAddTitle')
    "
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
    :confirm-loading="submitting"
    width="min(600px, 90vw)"
    destroy-on-close
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <a-form
      ref="formRef"
      :model="form"
      :label-col="{ span: 7 }"
      :wrapper-col="{ span: 17 }"
      label-align="right"
      class="mt-4"
    >
      <!-- 名称 -->
      <a-form-item
        :label="$t('config.channelFormName')"
        name="title"
        :rules="[
          { required: true, message: $t('config.channelFormNameRequired') },
        ]"
      >
        <a-input
          v-model:value="form.title"
          :placeholder="$t('config.channelFormNamePlaceholder')"
        />
      </a-form-item>

      <!-- 类型 -->
      <a-form-item
        :label="$t('config.channelFormType')"
        name="type"
        :rules="[
          { required: true, message: $t('config.channelFormTypeRequired') },
        ]"
      >
        <a-select v-model:value="form.type" style="width: 200px">
          <a-select-option value="telegram">Telegram</a-select-option>
          <a-select-option value="feishu">{{
            $t('config.channelTypeFeishu')
          }}</a-select-option>
          <a-select-option value="dingtalk">{{
            $t('config.channelTypeDingtalk')
          }}</a-select-option>
          <a-select-option value="wecom">{{
            $t('config.channelTypeWecom')
          }}</a-select-option>
          <a-select-option value="discord">Discord</a-select-option>
          <a-select-option value="slack">Slack</a-select-option>
          <a-select-option value="msteams">Microsoft Teams</a-select-option>
          <a-select-option value="line">LINE</a-select-option>
          <a-select-option value="matrix">Matrix</a-select-option>
          <a-select-option value="mattermost">Mattermost</a-select-option>
        </a-select>
      </a-form-item>

      <!-- ── Telegram ── -->
      <template v-if="form.type === 'telegram'">
        <a-form-item
          label="Bot Token"
          name="token"
          :rules="[
            { required: true, message: $t('config.channelFormTokenRequired') },
          ]"
        >
          <a-input-password
            v-model:value="form.token"
            placeholder="Bot Token"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="Chat ID" name="chatId">
          <a-input
            v-model:value="form.chatId"
            :placeholder="$t('config.channelFormChatIdPlaceholder')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormChatIdHint') }}
          </div>
        </a-form-item>
        <a-form-item label="Owner ID" name="ownerId">
          <a-input
            v-model:value="form.ownerId"
            :placeholder="$t('config.channelFormOwnerIdPlaceholder')"
          />
        </a-form-item>
      </template>

      <!-- ── 飞书 ── -->
      <template v-else-if="form.type === 'feishu'">
        <a-form-item
          label="App ID"
          name="appId"
          :rules="[
            { required: true, message: $t('config.channelFormAppIdRequired') },
          ]"
        >
          <a-input
            v-model:value="form.appId"
            placeholder="cli_xxxxxxxxxxxxxxxx"
          />
        </a-form-item>
        <a-form-item
          label="App Secret"
          name="appSecret"
          :rules="[
            {
              required: true,
              message: $t('config.channelFormAppSecretRequired'),
            },
          ]"
        >
          <a-input-password
            v-model:value="form.appSecret"
            placeholder="App Secret"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="Verify Token" name="verifyToken">
          <a-input
            v-model:value="form.verifyToken"
            :placeholder="$t('config.channelFormVerifyTokenPlaceholder')"
          />
        </a-form-item>
        <a-form-item label="Encrypt Key" name="encryptKey">
          <a-input-password
            v-model:value="form.encryptKey"
            :placeholder="$t('config.channelFormEncryptKeyPlaceholder')"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="Chat ID" name="chatId">
          <a-input
            v-model:value="form.chatId"
            :placeholder="$t('config.channelFormFeishuChatIdPlaceholder')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormChatIdAutoHint') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('config.channelFormWebhookLabel')">
          <div class="text-xs text-gray-500 break-all">{{ webhookUrl }}</div>
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormFeishuWebhookHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- ── 钉钉 ── -->
      <template v-else-if="form.type === 'dingtalk'">
        <a-form-item
          label="App Key"
          name="appKey"
          :rules="[
            { required: true, message: $t('config.channelFormAppKeyRequired') },
          ]"
        >
          <a-input
            v-model:value="form.appKey"
            :placeholder="$t('config.channelFormDingtalkAppKeyPlaceholder')"
          />
        </a-form-item>
        <a-form-item
          label="App Secret"
          name="appSecret"
          :rules="[
            {
              required: true,
              message: $t('config.channelFormAppSecretRequired'),
            },
          ]"
        >
          <a-input-password
            v-model:value="form.appSecret"
            placeholder="App Secret"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="Agent ID" name="agentId">
          <a-input
            v-model:value="form.agentId"
            :placeholder="$t('config.channelFormAgentIdPlaceholder')"
          />
        </a-form-item>
        <a-form-item label="Robot Code" name="robotCode">
          <a-input
            v-model:value="form.robotCode"
            :placeholder="$t('config.channelFormRobotCodePlaceholder')"
          />
        </a-form-item>
        <a-form-item label="Chat ID" name="chatId">
          <a-input
            v-model:value="form.chatId"
            :placeholder="$t('config.channelFormDingtalkChatIdPlaceholder')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormChatIdAutoHint') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('config.channelFormWebhookLabel')">
          <div class="text-xs text-gray-500 break-all">{{ webhookUrl }}</div>
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormDingtalkWebhookHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- ── 企业微信 ── -->
      <template v-else-if="form.type === 'wecom'">
        <a-form-item
          label="Corp ID"
          name="corpId"
          :rules="[
            { required: true, message: $t('config.channelFormCorpIdRequired') },
          ]"
        >
          <a-input
            v-model:value="form.corpId"
            :placeholder="$t('config.channelFormCorpIdPlaceholder')"
          />
        </a-form-item>
        <a-form-item
          label="Corp Secret"
          name="corpSecret"
          :rules="[
            {
              required: true,
              message: $t('config.channelFormCorpSecretRequired'),
            },
          ]"
        >
          <a-input-password
            v-model:value="form.corpSecret"
            :placeholder="$t('config.channelFormCorpSecretPlaceholder')"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item
          label="Agent ID"
          name="agentId"
          :rules="[
            {
              required: true,
              message: $t('config.channelFormWecomAgentIdRequired'),
            },
          ]"
        >
          <a-input
            v-model:value="form.agentId"
            :placeholder="$t('config.channelFormWecomAgentIdPlaceholder')"
          />
        </a-form-item>
        <a-form-item label="Token" name="token">
          <a-input
            v-model:value="form.token"
            :placeholder="$t('config.channelFormWecomTokenPlaceholder')"
          />
        </a-form-item>
        <a-form-item label="EncodingAESKey" name="encodingAesKey">
          <a-input-password
            v-model:value="form.encodingAesKey"
            :placeholder="$t('config.channelFormEncodingAesKeyPlaceholder')"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item :label="$t('config.channelFormToUserLabel')" name="toUser">
          <a-input
            v-model:value="form.toUser"
            :placeholder="$t('config.channelFormToUserPlaceholder')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormChatIdAutoHint') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('config.channelFormWebhookLabel')">
          <div class="text-xs text-gray-500 break-all">{{ webhookUrl }}</div>
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormWecomWebhookHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- ── Discord ── -->
      <template v-else-if="form.type === 'discord'">
        <a-form-item
          label="Bot Token"
          name="token"
          :rules="[
            { required: true, message: $t('config.channelFormTokenRequired') },
          ]"
        >
          <a-input-password
            v-model:value="form.token"
            placeholder="Bot Token（Bot Settings → Token）"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="Public Key" name="publicKey">
          <a-input
            v-model:value="form.publicKey"
            :placeholder="$t('config.channelFormPublicKeyPlaceholder')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormDiscordPublicKeyHint') }}
          </div>
        </a-form-item>
        <a-form-item label="Channel ID" name="channelId">
          <a-input
            v-model:value="form.channelId"
            :placeholder="$t('config.channelFormChannelIdPlaceholder')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormChatIdAutoHint') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('config.channelFormWebhookLabel')">
          <div class="text-xs text-gray-500 break-all">{{ webhookUrl }}</div>
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormDiscordWebhookHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- ── Slack ── -->
      <template v-else-if="form.type === 'slack'">
        <a-form-item
          label="Bot Token"
          name="botToken"
          :rules="[
            { required: true, message: $t('config.channelFormTokenRequired') },
          ]"
        >
          <a-input-password
            v-model:value="form.botToken"
            placeholder="xoxb-..."
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="Signing Secret" name="signingSecret">
          <a-input-password
            v-model:value="form.signingSecret"
            placeholder="App Credentials → Signing Secret"
            autocomplete="new-password"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormSigningSecretHint') }}
          </div>
        </a-form-item>
        <a-form-item label="Channel ID" name="channelId">
          <a-input
            v-model:value="form.channelId"
            :placeholder="$t('config.channelFormSlackChannelIdPlaceholder')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormChatIdAutoHint') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('config.channelFormWebhookLabel')">
          <div class="text-xs text-gray-500 break-all">{{ webhookUrl }}</div>
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormSlackWebhookHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- ── Microsoft Teams ── -->
      <template v-else-if="form.type === 'msteams'">
        <a-form-item
          label="App ID"
          name="appId"
          :rules="[
            { required: true, message: $t('config.channelFormAppIdRequired') },
          ]"
        >
          <a-input
            v-model:value="form.appId"
            placeholder="Azure Bot App ID（GUID）"
          />
        </a-form-item>
        <a-form-item
          label="App Password"
          name="appPassword"
          :rules="[
            {
              required: true,
              message: $t('config.channelFormAppPasswordRequired'),
            },
          ]"
        >
          <a-input-password
            v-model:value="form.appPassword"
            placeholder="Azure Bot App Password"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item :label="$t('config.channelFormWebhookLabel')">
          <div class="text-xs text-gray-500 break-all">{{ webhookUrl }}</div>
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormTeamsWebhookHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- ── LINE ── -->
      <template v-else-if="form.type === 'line'">
        <a-form-item
          label="Channel Access Token"
          name="channelAccessToken"
          :rules="[
            {
              required: true,
              message: $t('config.channelFormChannelAccessTokenRequired'),
            },
          ]"
        >
          <a-input-password
            v-model:value="form.channelAccessToken"
            placeholder="Long-lived Channel Access Token"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="Channel Secret" name="channelSecret">
          <a-input-password
            v-model:value="form.channelSecret"
            :placeholder="$t('config.channelFormChannelSecretPlaceholder')"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="User/Group ID" name="userId">
          <a-input
            v-model:value="form.userId"
            :placeholder="$t('config.channelFormLineUserIdPlaceholder')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormChatIdAutoHint') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('config.channelFormWebhookLabel')">
          <div class="text-xs text-gray-500 break-all">{{ webhookUrl }}</div>
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormLineWebhookHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- ── Matrix ── -->
      <template v-else-if="form.type === 'matrix'">
        <a-form-item
          label="Homeserver URL"
          name="homeserverUrl"
          :rules="[
            {
              required: true,
              message: $t('config.channelFormHomeserverUrlRequired'),
            },
          ]"
        >
          <a-input
            v-model:value="form.homeserverUrl"
            placeholder="https://matrix.org"
          />
        </a-form-item>
        <a-form-item
          label="Access Token"
          name="accessToken"
          :rules="[
            {
              required: true,
              message: $t('config.channelFormAccessTokenRequired'),
            },
          ]"
        >
          <a-input-password
            v-model:value="form.accessToken"
            :placeholder="$t('config.channelFormMatrixAccessTokenPlaceholder')"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="Room ID" name="roomId">
          <a-input
            v-model:value="form.roomId"
            :placeholder="$t('config.channelFormRoomIdPlaceholder')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormChatIdAutoHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- ── Mattermost ── -->
      <template v-else-if="form.type === 'mattermost'">
        <a-form-item
          label="Server URL"
          name="serverUrl"
          :rules="[
            {
              required: true,
              message: $t('config.channelFormServerUrlRequired'),
            },
          ]"
        >
          <a-input
            v-model:value="form.serverUrl"
            placeholder="https://mattermost.example.com"
          />
        </a-form-item>
        <a-form-item
          label="Token"
          name="token"
          :rules="[
            { required: true, message: $t('config.channelFormTokenRequired') },
          ]"
        >
          <a-input-password
            v-model:value="form.token"
            :placeholder="$t('config.channelFormMattermostTokenPlaceholder')"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="Channel ID" name="channelId">
          <a-input
            v-model:value="form.channelId"
            :placeholder="
              $t('config.channelFormMattermostChannelIdPlaceholder')
            "
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormChatIdAutoHint') }}
          </div>
        </a-form-item>
        <a-form-item label="Outgoing Token" name="outgoingToken">
          <a-input
            v-model:value="form.outgoingToken"
            :placeholder="$t('config.channelFormOutgoingTokenPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('config.channelFormWebhookLabel')">
          <div class="text-xs text-gray-500 break-all">{{ webhookUrl }}</div>
          <div class="text-xs text-gray-400 mt-1">
            {{ $t('config.channelFormMattermostWebhookHint') }}
          </div>
        </a-form-item>
      </template>

      <!-- 全局转发 -->
      <a-form-item :label="$t('config.channelFormIsGlobal')">
        <div class="flex items-start gap-2">
          <a-switch v-model:checked="form.isGlobal" class="mt-0.5 shrink-0" />
          <span class="text-xs text-gray-500 dark:text-gray-400 leading-5">
            {{ $t('config.channelFormIsGlobalDesc') }}
          </span>
        </div>
      </a-form-item>

      <!-- 启用 -->
      <a-form-item :label="$t('config.channelFormEnable')">
        <a-switch v-model:checked="form.enable" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChannelConfig } from '@/claw/api/channel'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  initialData?: ChannelConfig | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'submit', entry: ChannelConfig): void
}>()

const formRef = ref()
const submitting = ref(false)

type ChannelType = ChannelConfig['type']

interface FormState {
  title: string
  type: ChannelType
  // Telegram
  token: string
  chatId: string
  ownerId: string
  // 飞书
  appId: string
  appSecret: string
  verifyToken: string
  encryptKey: string
  // 钉钉
  appKey: string
  agentId: string
  robotCode: string
  userId: string
  // 企业微信
  corpId: string
  corpSecret: string
  toUser: string
  toParty: string
  encodingAesKey: string
  // Discord
  publicKey: string
  channelId: string
  guildId: string
  // Slack
  botToken: string
  signingSecret: string
  // MS Teams
  appPassword: string
  serviceUrl: string
  conversationId: string
  // LINE
  channelAccessToken: string
  channelSecret: string
  // Matrix
  homeserverUrl: string
  accessToken: string
  roomId: string
  // Mattermost
  serverUrl: string
  outgoingToken: string
  // 通用
  isGlobal: boolean
  enable: boolean
}

function emptyForm(): FormState {
  return {
    title: '',
    type: 'telegram',
    token: '',
    chatId: '',
    ownerId: '',
    appId: '',
    appSecret: '',
    verifyToken: '',
    encryptKey: '',
    appKey: '',
    agentId: '',
    robotCode: '',
    userId: '',
    corpId: '',
    corpSecret: '',
    toUser: '',
    toParty: '',
    encodingAesKey: '',
    publicKey: '',
    channelId: '',
    guildId: '',
    botToken: '',
    signingSecret: '',
    appPassword: '',
    serviceUrl: '',
    conversationId: '',
    channelAccessToken: '',
    channelSecret: '',
    homeserverUrl: '',
    accessToken: '',
    roomId: '',
    serverUrl: '',
    outgoingToken: '',
    isGlobal: false,
    enable: true,
  }
}

const form = reactive<FormState>(emptyForm())
const isEdit = computed(() => !!props.initialData?.id)

const webhookUrl = computed(() => {
  const id = props.initialData?.id ?? t('config.channelWebhookIdPlaceholder')
  const base = window.location.origin + '/api'
  return `${base}/webhook/channel/${form.type}/${id}`
})

watch(
  () => [props.open, props.initialData] as const,
  ([open, data]) => {
    if (!open) return
    if (data) {
      form.title = data.title
      form.type = data.type
      const c = data.config ?? {}
      form.token = c.token ?? ''
      form.chatId = c.chatId ?? ''
      form.ownerId = c.ownerId ?? ''
      form.appId = c.appId ?? ''
      form.appSecret = c.appSecret ?? ''
      form.verifyToken = c.verifyToken ?? ''
      form.encryptKey = c.encryptKey ?? ''
      form.appKey = c.appKey ?? ''
      form.agentId = c.agentId ?? ''
      form.robotCode = c.robotCode ?? ''
      form.userId = c.userId ?? ''
      form.corpId = c.corpId ?? ''
      form.corpSecret = c.corpSecret ?? ''
      form.toUser = c.toUser ?? ''
      form.toParty = c.toParty ?? ''
      form.encodingAesKey = c.encodingAesKey ?? ''
      form.publicKey = c.publicKey ?? ''
      form.channelId = c.channelId ?? ''
      form.guildId = c.guildId ?? ''
      form.botToken = c.botToken ?? ''
      form.signingSecret = c.signingSecret ?? ''
      form.appPassword = c.appPassword ?? ''
      form.serviceUrl = c.serviceUrl ?? ''
      form.conversationId = c.conversationId ?? ''
      form.channelAccessToken = c.channelAccessToken ?? ''
      form.channelSecret = c.channelSecret ?? ''
      form.homeserverUrl = c.homeserverUrl ?? ''
      form.accessToken = c.accessToken ?? ''
      form.roomId = c.roomId ?? ''
      form.serverUrl = c.serverUrl ?? ''
      form.outgoingToken = c.outgoingToken ?? ''
      form.isGlobal = data.isGlobal ?? false
      form.enable = data.enable
    } else {
      Object.assign(form, emptyForm())
    }
  },
  { immediate: true }
)

function buildConfig(): ChannelConfig['config'] {
  const t = form.type
  if (t === 'telegram')
    return {
      token: form.token.trim() || undefined,
      chatId: form.chatId.trim() || undefined,
      ownerId: form.ownerId.trim() || undefined,
    }
  if (t === 'feishu')
    return {
      appId: form.appId.trim() || undefined,
      appSecret: form.appSecret.trim() || undefined,
      verifyToken: form.verifyToken.trim() || undefined,
      encryptKey: form.encryptKey.trim() || undefined,
      chatId: form.chatId.trim() || undefined,
    }
  if (t === 'dingtalk')
    return {
      appKey: form.appKey.trim() || undefined,
      appSecret: form.appSecret.trim() || undefined,
      agentId: form.agentId.trim() || undefined,
      robotCode: form.robotCode.trim() || undefined,
      chatId: form.chatId.trim() || undefined,
    }
  if (t === 'wecom')
    return {
      corpId: form.corpId.trim() || undefined,
      corpSecret: form.corpSecret.trim() || undefined,
      agentId: form.agentId.trim() || undefined,
      token: form.token.trim() || undefined,
      encodingAesKey: form.encodingAesKey.trim() || undefined,
      toUser: form.toUser.trim() || undefined,
      toParty: form.toParty.trim() || undefined,
    }
  if (t === 'discord')
    return {
      token: form.token.trim() || undefined,
      publicKey: form.publicKey.trim() || undefined,
      channelId: form.channelId.trim() || undefined,
      guildId: form.guildId.trim() || undefined,
    }
  if (t === 'slack')
    return {
      botToken: form.botToken.trim() || undefined,
      signingSecret: form.signingSecret.trim() || undefined,
      channelId: form.channelId.trim() || undefined,
    }
  if (t === 'msteams')
    return {
      appId: form.appId.trim() || undefined,
      appPassword: form.appPassword.trim() || undefined,
    }
  if (t === 'line')
    return {
      channelAccessToken: form.channelAccessToken.trim() || undefined,
      channelSecret: form.channelSecret.trim() || undefined,
      userId: form.userId.trim() || undefined,
    }
  if (t === 'matrix')
    return {
      homeserverUrl: form.homeserverUrl.trim() || undefined,
      accessToken: form.accessToken.trim() || undefined,
      roomId: form.roomId.trim() || undefined,
    }
  if (t === 'mattermost')
    return {
      serverUrl: form.serverUrl.trim() || undefined,
      token: form.token.trim() || undefined,
      channelId: form.channelId.trim() || undefined,
      outgoingToken: form.outgoingToken.trim() || undefined,
    }
  return {}
}

async function handleOk() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const entry: ChannelConfig = {
      ...(props.initialData?.id ? { id: props.initialData.id } : {}),
      title: form.title.trim(),
      type: form.type,
      isGlobal: form.isGlobal,
      enable: form.enable,
      config: buildConfig(),
    }
    emit('submit', entry)
    emit('update:open', false)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  testActionSet('modal.fillTitle', (title: string) => {
    form.title = title
  })
  testActionSet('modal.submit', () => handleOk())
  testActionSet('modal.close', () => emit('update:open', false))
})

onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})
</script>
