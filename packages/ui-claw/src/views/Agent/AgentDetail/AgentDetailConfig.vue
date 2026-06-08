<script setup lang="ts">
import {
  getAgentRoleConfig,
  getAvailableTools,
  updateAgentConfig,
} from '@/claw/api/agent'
import { useAgentStore } from '@/claw/stores/agent'

const {
  getById: getAgentById,
  load: loadAgents,
  refresh: refreshAgents,
} = useAgentStore()
import ToolActionBuilder from '@/components/AgentChat/components/ToolActionBuilder.vue'
import ConfigModelSelector from '@/views/Config/ConfigModelSelector.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { testActionSet, testActionUnset } from '@/utils/test'
import Brain from '~icons/lucide/brain'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import Cpu from '~icons/lucide/cpu'
import Hash from '~icons/lucide/hash'
import Info from '~icons/lucide/info'
import RefreshCw from '~icons/lucide/refresh-cw'
import ScrollText from '~icons/lucide/scroll-text'
import SlidersHorizontal from '~icons/lucide/sliders-horizontal'
import Thermometer from '~icons/lucide/thermometer'
import Wrench from '~icons/lucide/wrench'

const { t } = useI18n()
const route = useRoute()
const agentId = route.params.id as string

/** Tools that are always available to every agent — should not appear in config UI */
const AGENT_DEFAULT_TOOLS = ['asks', 'soul_get', 'soul_update']

/** All available tool names fetched from the backend (includes '*') */
const allTools = ref<string[]>([])

/** Grouped options for the tools selector (default tools are excluded) */
const toolOptions = computed(() => {
  const result: {
    label: string
    value?: string
    options?: { label: string; value: string }[]
  }[] = [{ label: `* (${t('claw.agent.allTools')})`, value: '*' }]

  // Group by underscore prefix (e.g. web_search, web_fetch → "web" group)
  const grouped: Record<string, string[]> = {}
  for (const tool of allTools.value) {
    if (tool === '*') continue
    if (AGENT_DEFAULT_TOOLS.includes(tool)) continue
    const underIdx = tool.indexOf('_')
    const prefix = underIdx === -1 ? tool : tool.slice(0, underIdx)
    if (!grouped[prefix]) grouped[prefix] = []
    grouped[prefix].push(tool)
  }

  for (const [prefix, tools] of Object.entries(grouped)) {
    if (tools.length === 1 && tools[0] === prefix) {
      result.push({ label: prefix, value: prefix })
    } else {
      result.push({
        label: prefix,
        options: tools.map((t) => ({ label: t, value: t })),
      })
    }
  }
  return result
})

const DEFAULT_MODEL_REF = () => ({
  name: 'default',
  temperature: 0.3,
  maxTokens: 4096,
  systemPrompt: '',
})

// ─── Editable field / action types ──────────────────────────────────────────

interface UIToolActionField {
  type: 'text' | 'radio' | 'textarea'
  name: string
  title: string
  defaultValue: string
  required: boolean
  /** Comma-separated options string (radio only, used for editing) */
  optionsStr: string
}

interface UIToolAction {
  type: 'form'
  icon: string
  title: string
  config: {
    fields: UIToolActionField[]
    template: string
  }
}

/** Snapshot of the last-saved / just-loaded config, used to detect changes */
const savedSnapshot = ref('')

const agentConfig = ref({
  name: '',
  description: '',
  models: {} as Record<
    string,
    {
      name: string
      temperature: number
      maxTokens: number
      systemPrompt: string
    }
  >,
  capabilities: {
    tools: [] as string[],
  },
  chats: {
    toolActions: [] as UIToolAction[],
  },
})

/** The role name of the loaded agent, used for "reset from role" */
const agentRoleName = ref('')

const loading = ref(true)

/** True when current agentConfig differs from the last saved snapshot */
const hasChanges = computed(
  () => JSON.stringify(agentConfig.value) !== savedSnapshot.value
)

/** Parse chats config into editable UI actions */
function parseUIActions(raw: unknown): UIToolAction[] {
  const chats = raw as Record<string, unknown> | undefined
  const rawActions = (chats?.toolActions ?? []) as unknown[]
  if (!Array.isArray(rawActions)) return []
  return rawActions.map((item: unknown) => {
    const a = item as Record<string, unknown>
    const cfg = (a.config ?? {}) as Record<string, unknown>
    const fields = ((cfg.fields ?? []) as unknown[]).map((f: unknown) => {
      const field = f as Record<string, unknown>
      return {
        type: (field.type === 'radio'
          ? 'radio'
          : field.type === 'textarea'
            ? 'textarea'
            : 'text') as 'text' | 'radio' | 'textarea',
        name: String(field.name ?? ''),
        title: String(field.title ?? ''),
        defaultValue: String(field.defaultValue ?? ''),
        required: field.required === true,
        optionsStr: Array.isArray(field.options)
          ? (field.options as string[]).join(', ')
          : '',
      } as UIToolActionField
    })
    return {
      type: 'form' as const,
      icon: String(a.icon ?? ''),
      title: String(a.title ?? ''),
      config: {
        fields,
        template: String(cfg.template ?? ''),
      },
    } as UIToolAction
  })
}

/** Populate agentConfig from a config object (agent.config or role config) */
function applyConfig(cfg: Record<string, unknown>, snapshot = false) {
  agentConfig.value.name = (cfg.name as string) ?? ''
  agentConfig.value.description = (cfg.description as string) ?? ''
  agentConfig.value.capabilities = {
    tools: (
      ((cfg.capabilities as Record<string, unknown>)?.tools as string[]) ?? []
    ).filter((t) => !AGENT_DEFAULT_TOOLS.includes(t)),
  }
  // 完全覆盖 models，使用角色配置中所有的 slot
  const rawModels = (cfg.models ?? {}) as Record<string, unknown>
  const mergedModels: typeof agentConfig.value.models = {}
  for (const [slot, m] of Object.entries(rawModels)) {
    if (m && typeof m === 'object') {
      mergedModels[slot] = {
        name: (m as { name: string }).name ?? 'default',
        temperature: (m as { temperature?: number }).temperature ?? 0.3,
        maxTokens: (m as { maxTokens?: number }).maxTokens ?? 4096,
        systemPrompt: (m as { systemPrompt?: string }).systemPrompt ?? '',
      }
    }
  }
  if (Object.keys(mergedModels).length === 0) {
    mergedModels['default'] = DEFAULT_MODEL_REF()
  }
  agentConfig.value.models = mergedModels
  // Parse chats.toolActions
  agentConfig.value.chats.toolActions = parseUIActions(cfg.chats)
  if (snapshot) {
    savedSnapshot.value = JSON.stringify(agentConfig.value)
  }
}

onMounted(async () => {
  try {
    const [tools] = await Promise.all([getAvailableTools(), loadAgents()])
    const agent = getAgentById(agentId)
    agentRoleName.value = agent?.roleName ?? ''
    allTools.value = tools
    if (agent)
      applyConfig(agent.config as unknown as Record<string, unknown>, true)
  } finally {
    loading.value = false
  }
  testActionSet('config.tab.switch', (slot: string) => {
    activeModelSlot.value = slot
  })
  testActionSet('config.save', () => saveAgentConfig())
  testActionSet('config.resetFromRole', () => resetFromRole())
})

onUnmounted(() => {
  testActionUnset('config.tab.switch')
  testActionUnset('config.save')
  testActionUnset('config.resetFromRole')
})

const activeModelSlot = ref('default')
const modelSlots = computed(() => Object.keys(agentConfig.value.models))

const currentModelConfig = computed(
  () => agentConfig.value.models[activeModelSlot.value] ?? DEFAULT_MODEL_REF()
)

/** Serialise UI actions back to the API format */
function serializeToolActions() {
  return agentConfig.value.chats.toolActions.map((action) => ({
    type: 'form' as const,
    icon: action.icon || undefined,
    title: action.title,
    config: {
      fields: action.config.fields.map((f) => {
        if (f.type === 'radio') {
          return {
            type: 'radio' as const,
            name: f.name,
            title: f.title,
            options: f.optionsStr
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            defaultValue: f.defaultValue || undefined,
            required: f.required || undefined,
          }
        }
        if (f.type === 'textarea') {
          return {
            type: 'textarea' as const,
            name: f.name,
            title: f.title,
            defaultValue: f.defaultValue || undefined,
            required: f.required || undefined,
          }
        }
        return {
          type: 'text' as const,
          name: f.name,
          title: f.title,
          defaultValue: f.defaultValue || undefined,
          required: f.required || undefined,
        }
      }),
      template: action.config.template,
    },
  }))
}

const saving = ref(false)
const saveAgentConfig = async () => {
  saving.value = true
  try {
    await updateAgentConfig(agentId, {
      name: agentConfig.value.name,
      description: agentConfig.value.description,
      models: agentConfig.value.models,
      capabilities: agentConfig.value.capabilities,
      chats: { toolActions: serializeToolActions() },
    })
    savedSnapshot.value = JSON.stringify(agentConfig.value)
    refreshAgents()
  } finally {
    saving.value = false
  }
}

/** Reset models completely from the agent's assigned role defaults and persist immediately */
const resetting = ref(false)
const resetFromRole = async () => {
  resetting.value = true
  try {
    const roleConfig = await getAgentRoleConfig(agentId)
    // 完全覆盖 models：使用角色配置中所有的 slot，不保留旧的 agent 覆盖值
    const rawModels = (roleConfig.models ?? {}) as Record<string, unknown>
    const newModels: typeof agentConfig.value.models = {}
    for (const [slot, m] of Object.entries(rawModels)) {
      if (m && typeof m === 'object') {
        newModels[slot] = {
          name: (m as { name: string }).name ?? 'default',
          temperature: (m as { temperature?: number }).temperature ?? 0.3,
          maxTokens: (m as { maxTokens?: number }).maxTokens ?? 4096,
          systemPrompt: (m as { systemPrompt?: string }).systemPrompt ?? '',
        }
      }
    }
    if (Object.keys(newModels).length === 0) {
      newModels['default'] = DEFAULT_MODEL_REF()
    }
    agentConfig.value.models = newModels
    // 如果当前激活的 tab 不在新 models 里，重置到第一个
    if (!newModels[activeModelSlot.value]) {
      activeModelSlot.value = Object.keys(newModels)[0] ?? 'default'
    }
    // 立即持久化到后端，确保不依赖用户手动点保存
    await updateAgentConfig(agentId, { models: newModels })
    savedSnapshot.value = JSON.stringify(agentConfig.value)
    message.success(t('claw.agent.resetFromRoleSuccess'))
  } catch (e: unknown) {
    message.error((e as Error)?.message || t('claw.agent.resetFromRoleFailed'))
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div class="p-5">
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
        {{ $t('claw.agent.configTitle') }}
      </h3>
      <div class="flex items-center gap-2">
        <a-button :loading="resetting" @click="resetFromRole">
          <div class="inline-flex items-center gap-1">
            <RefreshCw class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.agent.resetFromRole') }}
          </div>
        </a-button>
        <a-button
          type="primary"
          :loading="saving"
          :disabled="!hasChanges"
          @click="saveAgentConfig"
        >
          <div class="inline-flex items-center gap-1">
            <CheckCircle2 class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.agent.saveConfig') }}
          </div>
        </a-button>
      </div>
    </div>

    <!-- 角色信息 -->
    <div class="mb-6">
      <div
        class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5"
      >
        <Info class="w-4 h-4 text-blue-500" />
        {{ $t('claw.agent.basicInfo') }}
      </div>
      <div
        class="px-3 py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800 space-y-3 text-sm text-gray-700 dark:text-gray-300"
      >
        <div class="flex items-center gap-2">
          <span class="text-gray-500 font-medium w-16 shrink-0">{{
            $t('claw.agent.agentNameLabel')
          }}</span>
          <span class="font-mono">{{ agentConfig.name || '-' }}</span>
        </div>
        <div class="flex items-start gap-2">
          <span class="text-gray-500 font-medium w-16 shrink-0">{{
            $t('claw.agent.descriptionConfigLabel')
          }}</span>
          <span class="text-gray-600 dark:text-gray-400 leading-relaxed">{{
            agentConfig.description || '-'
          }}</span>
        </div>
      </div>
    </div>

    <!-- 模型配置 -->
    <div class="mb-6">
      <div
        class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5"
      >
        <Brain class="w-4 h-4 text-primary-500" />
        {{ $t('claw.agent.modelConfigTitle') + ' (models)' }}
      </div>
      <a-tabs v-model:active-key="activeModelSlot" type="card">
        <a-tab-pane v-for="slot in modelSlots" :key="slot" :tab="slot">
          <a-form layout="vertical">
            <a-form-item>
              <template #label>
                <span class="inline-flex items-center gap-1">
                  <Cpu class="w-3.5 h-3.5 text-primary-400" />
                  {{ $t('claw.agent.modelNameLabel') }}
                  <span class="text-gray-400 font-mono text-xs">(name)</span>
                </span>
              </template>
              <ConfigModelSelector v-model:value="currentModelConfig.name" />
            </a-form-item>
            <div class="grid grid-cols-2 gap-x-3">
              <a-form-item>
                <template #label>
                  <span class="inline-flex items-center gap-1">
                    <Thermometer class="w-3.5 h-3.5 text-orange-400" />
                    {{ $t('claw.agent.temperatureLabel') }}
                    <span class="text-gray-400 font-mono text-xs"
                      >(temperature)</span
                    >
                  </span>
                </template>
                <a-input-number
                  v-model:value="currentModelConfig.temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  :precision="1"
                  class="w-full"
                />
              </a-form-item>
              <a-form-item>
                <template #label>
                  <span class="inline-flex items-center gap-1">
                    <Hash class="w-3.5 h-3.5 text-green-400" />
                    {{ $t('claw.agent.maxTokensLabel') }}
                    <span class="text-gray-400 font-mono text-xs"
                      >(maxTokens)</span
                    >
                  </span>
                </template>
                <a-input-number
                  v-model:value="currentModelConfig.maxTokens"
                  :min="256"
                  :max="128000"
                  :step="256"
                  class="w-full"
                />
              </a-form-item>
            </div>
            <a-form-item>
              <template #label>
                <span class="inline-flex items-center gap-1">
                  <ScrollText class="w-3.5 h-3.5 text-indigo-400" />
                  {{ $t('claw.agent.systemPromptLabel') }}
                  <span class="text-gray-400 font-mono text-xs"
                    >(systemPrompt)</span
                  >
                </span>
              </template>
              <a-textarea
                v-model:value="currentModelConfig.systemPrompt"
                :auto-size="{ minRows: 4, maxRows: 10 }"
                :placeholder="$t('claw.agent.systemPromptPlaceholder')"
                class="font-mono text-xs!"
              />
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 能力配置 -->
    <div class="mb-6">
      <div
        class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5"
      >
        <SlidersHorizontal class="w-4 h-4 text-green-500" />
        {{ $t('claw.agent.capabilitiesTitle') + ' (capabilities)' }}
      </div>
      <a-form layout="vertical">
        <a-form-item>
          <template #label>
            <span class="inline-flex items-center gap-1">
              <Wrench class="w-3.5 h-3.5 text-green-500" />
              {{ $t('claw.agent.toolsLabel') }}
              <span class="text-gray-400 font-mono text-xs">(tools)</span>
            </span>
          </template>
          <a-select
            v-model:value="agentConfig.capabilities.tools"
            mode="multiple"
            :placeholder="$t('claw.agent.toolsPlaceholder')"
            class="w-full"
            :options="toolOptions"
          >
            <template #option="{ label, value }">
              <span class="font-mono text-xs">{{ value ?? label }}</span>
            </template>
          </a-select>
        </a-form-item>
      </a-form>
    </div>

    <!-- 聊天快捷操作 -->
    <div class="mb-2">
      <ToolActionBuilder v-model:value="agentConfig.chats.toolActions" />
    </div>
  </div>
</template>
