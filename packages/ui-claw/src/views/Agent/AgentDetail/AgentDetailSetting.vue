<script setup lang="ts">
import {
  removeAgent,
  updateAgentBasic,
  updateAgentParam,
} from '@/claw/api/agent'
import ProjectSelector from '@/claw/components/ProjectSelector.vue'
import type { Agent, RoleParamDef } from '@/types'
import { copyText } from '@/utils/utils'
import { message } from 'ant-design-vue'
import Copy from '~icons/lucide/copy'
import RefreshCw from '~icons/lucide/refresh-cw'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ConfigChannelSelector from '../../../components/ChannelSelector.vue'
import AgentEditModal from '../AgentEditModal.vue'
import AgentParamForm from '../AgentParamForm.vue'
import { useSiteUrl } from '@/composables/setting'
import { useAgentStore } from '@/claw/stores/agent'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()
const siteUrlStore = useSiteUrl()

const props = defineProps<{ agent: Agent }>()
const emit = defineEmits<{ updated: [agent: Partial<Agent>] }>()
const router = useRouter()
const agentStore = useAgentStore()

const deleting = ref(false)
const editOpen = ref(false)

// ── 渠道配置 ──────────────────────────────────────────────────────────────────
const channelIds = ref<number[]>([...(props.agent.channelIds ?? [])])
const savedChannelIds = ref<number[]>([...(props.agent.channelIds ?? [])])
const savingChannels = ref(false)

const channelsChanged = computed(() => {
  const a = [...channelIds.value].sort((x, y) => x - y)
  const b = [...savedChannelIds.value].sort((x, y) => x - y)
  return a.length !== b.length || a.some((v, i) => v !== b[i])
})

watch(
  () => props.agent.channelIds,
  (val) => {
    channelIds.value = [...(val ?? [])]
    savedChannelIds.value = [...(val ?? [])]
  }
)

async function handleSaveChannels() {
  savingChannels.value = true
  try {
    await updateAgentBasic(props.agent.id, { channelIds: channelIds.value })
    emit('updated', { channelIds: channelIds.value })
    savedChannelIds.value = [...channelIds.value]
    message.success(t('claw.agent.saveChannelSuccess'))
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : t('claw.agent.saveChannelFailed')
    message.error(msg)
  } finally {
    savingChannels.value = false
  }
}

// ── Webhook 配置 ──────────────────────────────────────────────────────────────
const webhookEnable = ref<boolean>(props.agent.webhookEnable ?? false)
const webhookToken = ref<string>(props.agent.webhookToken ?? '')
const savedWebhookEnable = ref<boolean>(props.agent.webhookEnable ?? false)
const savedWebhookToken = ref<string>(props.agent.webhookToken ?? '')
const savingWebhook = ref(false)

const webhookChanged = computed(() => {
  return (
    webhookEnable.value !== savedWebhookEnable.value ||
    webhookToken.value !== savedWebhookToken.value
  )
})

const webhookUrl = computed(() => {
  const base = siteUrlStore.siteUrl
  return `${base}/api/hook/claw/agent/say/${webhookToken.value || '<token>'}`
})

function copyWebhookUrl() {
  copyText(webhookUrl.value)
  message.success(t('claw.agent.webhookCopySuccess'))
}

watch(
  () => props.agent,
  (val) => {
    webhookEnable.value = val.webhookEnable ?? false
    webhookToken.value = val.webhookToken ?? ''
    savedWebhookEnable.value = val.webhookEnable ?? false
    savedWebhookToken.value = val.webhookToken ?? ''
  }
)

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  webhookToken.value = result
}

const webhookCurlExample = computed(() => {
  const url = webhookUrl.value
  return `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '{"content": "Hello!", "format": "markdown"}'`
})

function copyWebhookUsage() {
  copyText(webhookCurlExample.value)
  message.success(t('common.copied'))
}

async function handleSaveWebhook() {
  savingWebhook.value = true
  try {
    await updateAgentBasic(props.agent.id, {
      webhookEnable: webhookEnable.value,
      webhookToken: webhookToken.value || null,
    })
    emit('updated', {
      webhookEnable: webhookEnable.value,
      webhookToken: webhookToken.value || null,
    })
    savedWebhookEnable.value = webhookEnable.value
    savedWebhookToken.value = webhookToken.value
    message.success(t('claw.agent.saveWebhookSuccess'))
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : t('claw.agent.saveWebhookFailed')
    message.error(msg)
  } finally {
    savingWebhook.value = false
  }
}

// ── Param 配置 ────────────────────────────────────────────────────────────────
const paramDefs = computed<RoleParamDef[]>(() => props.agent.config.param ?? [])

function buildInitialParam(): Record<string, string> {
  const values: Record<string, string> = {}
  for (const def of paramDefs.value) {
    const saved = (props.agent.param ?? {})[def.name]
    values[def.name] = saved != null ? String(saved) : (def.defaultValue ?? '')
  }
  return values
}

const paramValues = ref<Record<string, string>>(buildInitialParam())
const savedParamValues = ref<Record<string, string>>(buildInitialParam())
const savingParam = ref(false)

const paramChanged = computed(() => {
  return paramDefs.value.some(
    (def) => paramValues.value[def.name] !== savedParamValues.value[def.name]
  )
})

watch(
  () => props.agent,
  () => {
    const initial = buildInitialParam()
    paramValues.value = { ...initial }
    savedParamValues.value = { ...initial }
  }
)

async function handleSaveParam() {
  savingParam.value = true
  try {
    const result = await updateAgentParam(props.agent.id, paramValues.value)
    emit('updated', { param: result.param })
    savedParamValues.value = { ...paramValues.value }
    message.success(t('claw.agent.paramSaved'))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : t('common.saveFailed')
    message.error(msg)
  } finally {
    savingParam.value = false
  }
}

// ── 删除 ──────────────────────────────────────────────────────────────────────
const isSupervisor = () => props.agent.roleName === 'supervisor'

// ── 所属项目 ──────────────────────────────────────────────────────────────────
const projectId = ref<number | undefined>(props.agent.projectId ?? undefined)
const savedProjectId = ref<number | undefined>(
  props.agent.projectId ?? undefined
)
const savingProject = ref(false)

const projectChanged = computed(
  () => (projectId.value ?? null) !== (savedProjectId.value ?? null)
)

watch(
  () => props.agent.projectId,
  (val) => {
    projectId.value = val ?? undefined
    savedProjectId.value = val ?? undefined
  }
)

async function handleSaveProject() {
  savingProject.value = true
  try {
    await updateAgentBasic(props.agent.id, {
      projectId: projectId.value ?? null,
    })
    emit('updated', { projectId: projectId.value ?? null })
    savedProjectId.value = projectId.value
    message.success(t('claw.agent.projectSaved'))
  } catch (err: unknown) {
    message.error(err instanceof Error ? err.message : t('common.saveFailed'))
  } finally {
    savingProject.value = false
  }
}

async function handleDelete() {
  deleting.value = true
  try {
    await removeAgent(props.agent.id)
    message.success(t('common.deleteSuccess'))
    await agentStore.refresh()
    router.push('/claw/agent')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : t('common.deleteFailed')
    message.error(msg)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  testActionSet('settings.openEdit', () => {
    editOpen.value = true
  })
  testActionSet('settings.enableWebhook', () => {
    webhookEnable.value = true
  })
  testActionSet('settings.generateToken', () => generateToken())
})
onUnmounted(() => {
  testActionUnset('settings.openEdit')
  testActionUnset('settings.enableWebhook')
  testActionUnset('settings.generateToken')
})
</script>

<template>
  <div class="p-5">
    <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5">
      {{ $t('claw.agent.settingsTitle') }}
    </h3>

    <!-- 基础信息 -->
    <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
      {{ $t('claw.agent.basicInfo') }}
    </h4>
    <div
      class="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-xl p-4 flex items-center justify-between mb-6"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0"
        >
          <img
            v-if="agent.avatar"
            :src="agent.avatar"
            alt="Avatar"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold"
          >
            {{ agent.title?.[0] ?? '?' }}
          </div>
        </div>
        <div>
          <p class="font-semibold text-gray-900 dark:text-gray-100">
            {{ agent.title }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {{ agent.description || $t('claw.agent.noIntro') }}
          </p>
        </div>
      </div>
      <a-button type="default" @click="editOpen = true">{{
        $t('claw.agent.editBtn')
      }}</a-button>
    </div>

    <!-- 角色参数 -->
    <template v-if="paramDefs.length > 0">
      <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 mt-4">
        {{ t('claw.agent.roleParamTitle') }}
      </h4>
      <div
        class="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-xl p-4 mb-6"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {{ t('claw.agent.roleParamDesc') }}
        </p>
        <AgentParamForm v-model="paramValues" :defs="paramDefs" />
        <div v-if="paramChanged" class="flex justify-end mt-4">
          <a-button
            type="primary"
            :loading="savingParam"
            @click="handleSaveParam"
            >{{ t('claw.agent.saveBtn') }}</a-button
          >
        </div>
      </div>
    </template>

    <!-- 消息渠道 -->
    <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 mt-4">
      {{ $t('claw.agent.messageChannel') }}
    </h4>
    <div
      class="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-xl p-4 mb-6"
    >
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {{ $t('claw.agent.messageChannelDesc') }}
        <span class="text-primary-500 dark:text-primary-400">{{
          $t('claw.agent.messageChannelHint')
        }}</span>
      </p>
      <ConfigChannelSelector v-model:value="channelIds" class="mb-3" />
      <div v-if="channelsChanged" class="flex justify-end mb-3">
        <a-button
          type="primary"
          :loading="savingChannels"
          @click="handleSaveChannels"
          >{{ $t('claw.agent.saveBtn') }}</a-button
        >
      </div>

      <!-- Webhook 推送 -->
      <div class="border-t border-gray-200 dark:border-gray-600 pt-3 mt-1">
        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {{ $t('claw.agent.webhookTitle') }}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {{ $t('claw.agent.webhookDesc') }}
        </p>
        <div class="flex items-center gap-3 mb-3">
          <span class="text-sm text-gray-700 dark:text-gray-300">{{
            $t('claw.agent.webhookEnable')
          }}</span>
          <a-switch v-model:checked="webhookEnable" />
        </div>
        <template v-if="webhookEnable">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-sm text-gray-700 dark:text-gray-300 shrink-0"
              >Token</span
            >
            <a-input
              v-model:value="webhookToken"
              :placeholder="$t('claw.agent.webhookTokenPlaceholder')"
              class="flex-1 font-mono"
            />
            <a-button @click="generateToken">
              <div class="inline-flex items-center gap-1">
                <RefreshCw class="w-4 h-4" aria-hidden="true" />
                {{ $t('claw.agent.webhookGenerate') }}
              </div>
            </a-button>
          </div>
          <div v-if="webhookToken" class="mb-3">
            <p class="text-xs text-gray-400 dark:text-gray-500 mb-1">
              {{ $t('claw.agent.webhookUrlLabel') }}
            </p>
            <div class="flex items-center gap-2 mb-3">
              <div
                class="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 dark:text-gray-300 break-all select-all"
              >
                {{ webhookUrl }}
              </div>
              <a-button
                class="inline-flex items-center shrink-0"
                @click="copyWebhookUrl"
              >
                <Copy class="w-4 h-4" aria-hidden="true" />
              </a-button>
            </div>
            <!-- 使用说明 -->
            <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
              <p
                class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2"
              >
                {{ $t('claw.agent.webhookUsageTitle') }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('claw.agent.webhookUsageParams') }}
              </p>
              <ul
                class="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside mb-2 space-y-0.5"
              >
                <li>
                  <span class="font-mono text-primary-500">content</span
                  >{{ $t('claw.agent.webhookParamContent') }}
                </li>
                <li>
                  <span class="font-mono text-primary-500">format</span
                  >{{ $t('claw.agent.webhookParamFormat') }}
                </li>
              </ul>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('claw.agent.webhookUsageExample') }}
              </p>
              <div class="relative">
                <pre
                  class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-xs font-mono text-gray-600 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-all"
                  >{{ webhookCurlExample }}</pre
                >
                <a-button
                  class="absolute top-1 right-1 inline-flex items-center"
                  @click="copyWebhookUsage"
                >
                  <Copy class="w-4 h-4" aria-hidden="true" />
                </a-button>
              </div>
            </div>
          </div>
        </template>
        <div v-if="webhookChanged" class="flex justify-end">
          <a-button
            type="primary"
            :loading="savingWebhook"
            @click="handleSaveWebhook"
            >{{ $t('claw.agent.saveBtn') }}</a-button
          >
        </div>
      </div>
    </div>

    <!-- 所属项目（非 supervisor 可修改） -->
    <template v-if="!isSupervisor()">
      <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 mt-4">
        {{ t('claw.agent.projectTitle') }}
      </h4>
      <div
        class="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-xl p-4 mb-6"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {{ t('claw.agent.projectDesc') }}
        </p>
        <ProjectSelector
          v-model="projectId"
          :placeholder="t('claw.agent.projectPlaceholder')"
        />
        <div v-if="projectChanged" class="flex justify-end mt-3">
          <a-button
            type="primary"
            :loading="savingProject"
            @click="handleSaveProject"
          >
            {{ t('claw.agent.saveBtn') }}
          </a-button>
        </div>
      </div>
    </template>

    <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 mt-4">
      {{ $t('claw.agent.dangerZone') }}
    </h4>
    <div
      class="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-center justify-between"
    >
      <div>
        <h5 class="font-bold text-red-600 dark:text-red-400">
          {{ $t('claw.agent.deleteAgent') }}
        </h5>
        <p v-if="isSupervisor()" class="text-sm text-red-400/70 mt-1">
          {{ $t('claw.agent.supervisorCannotDelete') }}
        </p>
        <p v-else class="text-sm text-red-500/80 mt-1">
          {{ $t('claw.agent.deleteWarning') }}
        </p>
      </div>
      <a-tooltip
        v-if="isSupervisor()"
        :title="$t('claw.agent.supervisorTooltip')"
      >
        <a-button danger type="primary" disabled>{{
          $t('claw.agent.deleteAgent')
        }}</a-button>
      </a-tooltip>
      <a-popconfirm
        v-else
        :title="$t('claw.agent.deleteAgentConfirm')"
        :ok-text="$t('claw.agent.confirmDelete')"
        :cancel-text="$t('common.cancel')"
        @confirm="handleDelete"
      >
        <a-button danger type="primary" :loading="deleting">{{
          $t('claw.agent.deleteAgent')
        }}</a-button>
      </a-popconfirm>
    </div>
  </div>

  <AgentEditModal
    v-model:open="editOpen"
    :agent="agent"
    @updated="emit('updated', $event)"
  />
</template>
