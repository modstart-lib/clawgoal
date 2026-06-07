<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="isEdit ? $t('config.editProvider') : $t('config.addProvider')"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
    :confirm-loading="submitting"
    width="95vw"
    destroy-on-close
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <a-form
      ref="formRef"
      :model="form"
      :label-col="{ span: 3 }"
      :wrapper-col="{ span: 21 }"
      label-align="right"
      :colon="false"
      class="mt-4"
    >
      <!-- Name -->
      <a-form-item
        :label="$t('config.providerName')"
        name="name"
        :rules="[
          { required: true, message: $t('config.providerNameRequired') },
        ]"
      >
        <a-input
          v-model:value="form.name"
          :placeholder="$t('config.providerNamePlaceholder')"
        />
      </a-form-item>

      <!-- Provider Type -->
      <a-form-item
        :label="$t('config.providerType')"
        name="provider"
        :rules="[{ required: true }]"
      >
        <a-select
          v-model:value="form.provider"
          class="w-full"
          option-label-prop="label"
          @change="onProviderChange"
        >
          <a-select-option value="openai" label="OpenAI">
            <div class="flex items-center gap-2">
              <ModelIcon provider="openai" :size="16" class="shrink-0" />
              <span>OpenAI</span>
            </div>
          </a-select-option>
          <a-select-option value="gemini" label="Google Gemini">
            <div class="flex items-center gap-2">
              <ModelIcon provider="gemini" :size="16" class="shrink-0" />
              <span>Google Gemini</span>
            </div>
          </a-select-option>
          <a-select-option value="claude" label="Anthropic Claude">
            <div class="flex items-center gap-2">
              <ModelIcon provider="claude" :size="16" class="shrink-0" />
              <span>Anthropic Claude</span>
            </div>
          </a-select-option>
          <a-select-option value="deepseek" label="DeepSeek">
            <div class="flex items-center gap-2">
              <ModelIcon provider="deepseek" :size="16" class="shrink-0" />
              <span>DeepSeek</span>
            </div>
          </a-select-option>
          <a-select-option value="qwen" :label="$t('config.providerQwen')">
            <div class="flex items-center gap-2">
              <ModelIcon provider="qwen" :size="16" class="shrink-0" />
              <span>{{ $t('config.providerQwenFull') }}</span>
            </div>
          </a-select-option>
          <a-select-option
            value="moonshot"
            :label="$t('config.providerMoonshot')"
          >
            <div class="flex items-center gap-2">
              <ModelIcon provider="moonshot" :size="16" class="shrink-0" />
              <span>{{ $t('config.providerMoonshotFull') }}</span>
            </div>
          </a-select-option>
          <a-select-option value="zhipu" :label="$t('config.providerZhipu')">
            <div class="flex items-center gap-2">
              <ModelIcon provider="zhipu" :size="16" class="shrink-0" />
              <span>{{ $t('config.providerZhipu') }}</span>
            </div>
          </a-select-option>
          <a-select-option value="openrouter" label="OpenRouter">
            <div class="flex items-center gap-2">
              <ModelIcon provider="openrouter" :size="16" class="shrink-0" />
              <span>OpenRouter</span>
            </div>
          </a-select-option>
          <a-select-option
            value="custom"
            :label="$t('config.providerTypeCustom')"
          >
            <div class="flex items-center gap-2">
              <ModelIcon provider="custom" :size="16" class="shrink-0" />
              <span>{{ $t('config.providerTypeCustom') }}</span>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <!-- Format (only for custom) -->
      <a-form-item
        v-if="form.provider === 'custom'"
        :label="$t('config.providerFormat')"
        name="format"
        :rules="[
          { required: true, message: $t('config.providerFormatRequired') },
        ]"
      >
        <a-select
          v-model:value="form.format"
          class="w-full"
          option-label-prop="label"
        >
          <a-select-option
            value="openai"
            :label="$t('config.providerFormatOpenai')"
          >
            <div class="flex items-center gap-2">
              <ModelIcon provider="openai" :size="16" class="shrink-0" />
              <span>{{ $t('config.providerFormatOpenai') }}</span>
            </div>
          </a-select-option>
          <a-select-option
            value="gemini"
            :label="$t('config.providerFormatGemini')"
          >
            <div class="flex items-center gap-2">
              <ModelIcon provider="gemini" :size="16" class="shrink-0" />
              <span>{{ $t('config.providerFormatGemini') }}</span>
            </div>
          </a-select-option>
          <a-select-option
            value="anthropic"
            :label="$t('config.providerFormatAnthropic')"
          >
            <div class="flex items-center gap-2">
              <ModelIcon provider="claude" :size="16" class="shrink-0" />
              <span>{{ $t('config.providerFormatAnthropic') }}</span>
            </div>
          </a-select-option>
          <a-select-option
            value="ollama"
            :label="$t('config.providerFormatOllama')"
          >
            <div class="flex items-center gap-2">
              <ModelIcon provider="ollama" :size="16" class="shrink-0" />
              <span>{{ $t('config.providerFormatOllama') }}</span>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <!-- API Base -->
      <a-form-item
        :label="$t('config.providerApiBase')"
        name="apiBase"
        :rules="
          form.provider !== 'custom'
            ? [
                {
                  required: true,
                  message: $t('config.providerApiBaseRequired'),
                },
              ]
            : []
        "
      >
        <a-input
          v-model:value="form.apiBase"
          :placeholder="
            defaultApiBase(form.provider) ||
            $t('config.providerApiBasePlaceholder')
          "
        />
        <div
          v-if="form.provider !== 'custom' && defaultApiBase(form.provider)"
          class="text-xs text-gray-400 mt-1"
        >
          {{
            $t('config.providerApiBaseDefault', {
              url: defaultApiBase(form.provider),
            })
          }}
        </div>
      </a-form-item>

      <!-- API Key -->
      <a-form-item
        :label="$t('config.providerApiKey')"
        name="apiKey"
        :rules="
          form.provider === 'custom'
            ? []
            : [{ required: true, message: $t('config.providerApiKeyRequired') }]
        "
      >
        <a-input-password
          v-model:value="form.apiKey"
          :placeholder="
            form.provider === 'custom'
              ? $t('config.providerApiKeyOptional')
              : $t('config.providerApiKeyPlaceholder')
          "
          autocomplete="off"
        />
      </a-form-item>

      <!-- Models — required, placed before Max Retry -->
      <a-form-item
        :label="$t('config.providerModels')"
        name="models"
        :rules="modelsRules"
      >
        <a-select
          :value="form.models.map((m) => m.name)"
          mode="tags"
          class="w-full"
          :placeholder="$t('config.providerModelsPlaceholder')"
          :token-separators="[',']"
          option-label-prop="value"
          @change="onModelsChange"
        >
          <template #tagRender="{ value: tagValue, closable, onClose }">
            <a-tag
              :closable="closable"
              :color="form.models[0]?.name === tagValue ? 'blue' : undefined"
              style="margin-right: 3px; display: inline-flex"
              @close.prevent="() => onClose()"
            >
              <span
                class="flex items-center gap-1 cursor-pointer select-none"
                @click.stop="setAsDefaultModel(tagValue)"
              >
                <Star
                  v-if="form.models[0]?.name === tagValue"
                  class="w-3 h-3"
                  aria-hidden="true"
                />
                {{ tagValue }}
              </span>
            </a-tag>
          </template>
          <a-select-opt-group
            v-for="group in builtinModelGroups"
            :key="group.label"
            :label="group.label"
          >
            <a-select-option
              v-for="modelVal in group.models"
              :key="modelVal"
              :value="modelVal"
            >
              <div class="flex items-center gap-2">
                <ModelIcon
                  :provider="form.provider"
                  :size="14"
                  class="shrink-0"
                />
                <span>{{ modelVal }}</span>
              </div>
            </a-select-option>
          </a-select-opt-group>
        </a-select>
        <div class="text-xs text-gray-400 mt-1">
          {{ $t('config.providerModelsHint') }}。{{
            $t('config.providerModelsFirstIsDefault')
          }}
        </div>
      </a-form-item>

      <!-- Per-model Settings (collapsible) -->
      <a-form-item
        v-if="form.models.filter((m) => m.name.trim()).length > 0"
        :label="$t('config.modelSpecificSettings')"
        :wrapper-col="{ span: 24 }"
      >
        <div
          class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <div
            class="flex items-center justify-between px-3 py-2 cursor-pointer bg-gray-50 dark:bg-gray-800/50 select-none"
            @click="showModelSettings = !showModelSettings"
          >
            <span class="text-sm text-gray-600 dark:text-gray-400">{{
              $t('config.modelSpecificSettings')
            }}</span>
            <ChevronDown
              :class="[
                'w-4 h-4 text-gray-400 transition-transform duration-200',
                showModelSettings ? 'rotate-180' : '',
              ]"
              aria-hidden="true"
            />
          </div>
          <div
            v-if="showModelSettings"
            class="divide-y divide-gray-100 dark:divide-gray-700"
          >
            <div
              v-for="m in form.models.filter((m) => m.name.trim())"
              :key="m.name"
              class="flex items-center gap-2 px-3 py-1.5"
            >
              <span
                class="text-xs font-mono text-gray-700 dark:text-gray-300 w-36 shrink-0 truncate"
                :title="m.name"
                >{{ m.name }}</span
              >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1">
                <!-- imageInputs -->
                <div class="flex items-center gap-1">
                  <span class="text-xs text-gray-400 shrink-0">{{
                    $t('config.modelImageInputs')
                  }}</span>
                  <a-select
                    :value="m.imageInputs"
                    mode="multiple"
                    size="small"
                    style="width: 12rem"
                    allow-clear
                    :placeholder="$t('config.modelImageInputsPlaceholder')"
                    @change="
                      (v: string[]) =>
                        (m.imageInputs = v && v.length ? v : undefined)
                    "
                  >
                    <a-select-option value="url">url</a-select-option>
                    <a-select-option value="base64">base64</a-select-option>
                  </a-select>
                </div>
                <!-- temperature -->
                <div class="flex items-center gap-1">
                  <span class="text-xs text-gray-400 shrink-0"
                    >temperature</span
                  >
                  <a-select
                    style="width: 5rem"
                    :value="
                      m.temperature !== undefined
                        ? String(m.temperature)
                        : undefined
                    "
                    mode="combobox"
                    size="small"
                    class="w-20"
                    allow-clear
                    placeholder="-"
                    :options="temperatureOptions"
                    @change="
                      (v: string) => (m.temperature = parseTemperature(v))
                    "
                  />
                </div>
                <!-- maxTokens -->
                <div class="flex items-center gap-1">
                  <span class="text-xs text-gray-400 shrink-0">{{
                    $t('config.modelMaxTokens')
                  }}</span>
                  <a-select
                    :value="
                      m.maxTokens !== undefined
                        ? toKDisplay(m.maxTokens)
                        : undefined
                    "
                    style="width: 5rem"
                    mode="combobox"
                    size="small"
                    allow-clear
                    placeholder="-"
                    :options="tokenOptions"
                    @change="(v: string) => (m.maxTokens = parseKValue(v))"
                  />
                </div>
                <!-- contextWindow -->
                <div class="flex items-center gap-1">
                  <span class="text-xs text-gray-400 shrink-0">{{
                    $t('config.modelContextWindow')
                  }}</span>
                  <a-select
                    :value="
                      m.contextWindow !== undefined
                        ? toKDisplay(m.contextWindow)
                        : undefined
                    "
                    mode="combobox"
                    size="small"
                    style="width: 5rem"
                    allow-clear
                    placeholder="-"
                    :options="tokenOptions"
                    @change="(v: string) => (m.contextWindow = parseKValue(v))"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </a-form-item>

      <!-- Is Default -->
      <a-form-item :label="$t('config.providerIsDefault')" name="isDefault">
        <a-switch v-model:checked="form.isDefault" />
      </a-form-item>

      <!-- Proxy Name -->
      <a-form-item :label="$t('config.providerProxyName')" name="proxyName">
        <ProxySelector
          v-model:value="form.proxyName"
          :placeholder="$t('config.providerProxyNamePlaceholder')"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Star } from 'lucide-vue-next'
import type { ModelProviderConfig, ModelProviderModel } from '../../api/config'
import ModelIcon from '../../components/ModelIcon.vue'
import ProxySelector from '../Setting/SettingProxy/SettingProxySelector.vue'
import {
  BUILTIN_MODEL_GROUPS,
  BUILTIN_MODELS,
  normalizeProviderType,
  PROVIDER_DEFAULTS,
} from './configModelProviderConstants'

// ─── Props / Emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  open: boolean
  initialData?: ModelProviderConfig | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'submit', entry: ModelProviderConfig): void
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const { t } = useI18n()
const formRef = ref()
const submitting = ref(false)
const showModelSettings = ref(false)

type FormModel = Omit<ModelProviderConfig, 'models'> & {
  format?: string
  models: ModelProviderModel[]
}

function emptyForm(): FormModel {
  return {
    name: '',
    provider: 'openai',
    format: undefined,
    apiBase: PROVIDER_DEFAULTS['openai'] ?? '',
    apiKey: '',
    isDefault: false,
    proxyName: undefined,
    models: [],
  }
}

const form = reactive<FormModel>(emptyForm())

const isEdit = computed(() => !!props.initialData)

// Sync form when modal opens or initialData changes
watch(
  () => [props.open, props.initialData] as const,
  ([open, data]) => {
    if (!open) return
    if (data) {
      // Normalize legacy provider values when loading existing config
      const normalizedProvider = normalizeProviderType(data.provider)
      // For custom provider, default format to 'openai' if not set
      const format =
        normalizedProvider === 'custom' ? (data.format ?? 'openai') : undefined
      Object.assign(form, {
        ...data,
        provider: normalizedProvider,
        format,
        models: data.models.filter((m) => m.name.trim()),
      })
    } else {
      Object.assign(form, emptyForm())
    }
  },
  { immediate: true }
)

// ─── Computed ─────────────────────────────────────────────────────────────────

const builtinModelGroups = computed(() => {
  return BUILTIN_MODEL_GROUPS[form.provider] || []
})

const modelsRules = computed(() => [
  {
    validator: (_rule: any, _value: any) => {
      if (form.models.filter((m) => m.name.trim()).length > 0) {
        return Promise.resolve()
      }
      return Promise.reject(t('config.providerModelsRequired'))
    },
  },
])

const temperatureOptions = [0, 0.3, 0.5, 0.7, 1.0, 1.2, 1.5, 2.0].map((v) => ({
  value: String(v),
  label: String(v),
}))

function toKDisplay(n: number): string {
  if (n >= 1024 && n % 1024 === 0) return `${n / 1024}K`
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}K`
  return String(n)
}

const tokenOptions = [4096, 8192, 16384, 32768, 65536, 131072, 204800].map(
  (v) => ({
    value: toKDisplay(v),
    label: toKDisplay(v),
  })
)

function parseKValue(s: string | null | undefined): number | undefined {
  if (!s?.trim()) return undefined
  const kMatch = s.trim().match(/^(\d+(?:\.\d+)?)\s*[Kk]$/)
  if (kMatch) {
    const num = Math.round(parseFloat(kMatch[1]) * 1024)
    return num > 0 ? num : undefined
  }
  const n = parseInt(s.trim(), 10)
  return !isNaN(n) && n > 0 ? n : undefined
}

function parseTemperature(s: string | null | undefined): number | undefined {
  if (!s?.trim()) return undefined
  const n = parseFloat(s.trim())
  return !isNaN(n) && n >= 0 ? n : undefined
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultApiBase(provider: string): string {
  return PROVIDER_DEFAULTS[provider] ?? ''
}

function setAsDefaultModel(modelName: string) {
  const idx = form.models.findIndex((m) => m.name === modelName)
  if (idx < 0) return
  const [entry] = form.models.splice(idx, 1)
  form.models.unshift(entry)
}

function onModelsChange(names: string[]) {
  // Preserve existing model objects, add new ones, remove deleted
  const currentMap = new Map(form.models.map((m) => [m.name, m]))
  form.models = names.map((n) => currentMap.get(n) ?? { name: n })
}

function onProviderChange(val: string) {
  // Auto-fill default API base when provider changes
  const defaultBase = PROVIDER_DEFAULTS[val] ?? ''
  if (defaultBase) form.apiBase = defaultBase

  // Reset / init format for custom provider
  form.format = val === 'custom' ? 'openai' : undefined

  // Pre-fill model list if empty
  if (form.models.length === 0) {
    form.models = (BUILTIN_MODELS[val] ?? []).map((n) => ({ name: n }))
  }
}

async function handleOk() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  const filteredModels = form.models.filter((m) => m.name.trim())
  const entry: ModelProviderConfig = {
    name: form.name.trim(),
    provider: form.provider,
    ...(form.provider === 'custom' && form.format
      ? { format: form.format }
      : {}),
    apiBase: form.apiBase.trim() || defaultApiBase(form.provider),
    apiKey: form.apiKey,
    isDefault: form.isDefault ?? false,
    proxyName: form.proxyName || undefined,
    models: filteredModels,
  }
  emit('submit', entry)
  emit('update:open', false)
}
</script>
