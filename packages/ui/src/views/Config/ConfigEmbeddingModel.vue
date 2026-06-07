<template>
  <div>
    <LoadingState :loading="loading">
      <div class="max-w-xl space-y-4">
        <!-- Type -->
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {{ $t('config.embeddingType') }}
          </label>
          <a-radio-group v-model:value="form.type" button-style="solid">
            <a-radio-button value="default">{{
              $t('config.embeddingTypeDefault')
            }}</a-radio-button>
            <a-radio-button value="openai">{{
              $t('config.embeddingTypeOpenai')
            }}</a-radio-button>
          </a-radio-group>
        </div>

        <!-- Default hint -->
        <div
          v-if="form.type === 'default'"
          class="text-sm text-gray-400 dark:text-gray-500 italic"
        >
          {{ $t('config.embeddingDefaultHint') }}
        </div>

        <!-- Remote fields -->
        <template v-if="form.type !== 'default'">
          <!-- Model Name -->
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {{ $t('config.embeddingModelName') }} *
            </label>
            <a-input
              v-model:value="form.model"
              :placeholder="$t('config.embeddingModelPlaceholder')"
            />
          </div>

          <!-- API Base (openai only) -->
          <div v-if="form.type === 'openai'">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {{ $t('config.embeddingApiBase') }}
            </label>
            <a-input
              v-model:value="form.apiBase"
              :placeholder="$t('config.providerApiBasePlaceholder')"
            />
          </div>

          <!-- API Key (openai only) -->
          <div v-if="form.type === 'openai'">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {{ $t('config.embeddingApiKey') }} *
            </label>
            <a-input-password
              v-model:value="form.apiKey"
              :placeholder="$t('config.providerApiKeyPlaceholder')"
              autocomplete="off"
            />
          </div>

          <!-- Proxy (openai only) -->
          <div v-if="form.type === 'openai'">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {{ $t('config.proxy') }}
            </label>
            <ProxySelector
              v-model:value="form.proxyName"
              :placeholder="$t('config.proxySelectorPlaceholder')"
            />
          </div>
        </template>

        <!-- Save / Test bar -->
        <div class="flex gap-2 pt-2">
          <a-button type="primary" :loading="saving" @click="save">
            {{ $t('common.save') }}
          </a-button>
          <a-button type="default" :loading="testing" @click="doTest">
            <div class="inline-flex items-center gap-1">
              <Zap class="w-4 h-4" aria-hidden="true" />
              {{ $t('config.testEmbedding') }}
            </div>
          </a-button>
        </div>
      </div>
    </LoadingState>
  </div>
</template>

<script setup lang="ts">
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import Zap from '~icons/lucide/zap'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getEmbeddingModel,
  saveEmbeddingModel,
  testEmbeddingModel,
  type EmbeddingModelConfig,
} from '../../api/config'
import ProxySelector from '../Setting/SettingProxy/SettingProxySelector.vue'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)

const form = reactive<EmbeddingModelConfig>({
  type: 'default',
  model: '',
  apiBase: '',
  apiKey: '',
  proxyName: undefined,
})

function validate(): boolean {
  if (form.type === 'default') return true
  if (!form.model?.trim()) {
    message.warning(t('config.embeddingModelRequired'))
    return false
  }
  if (form.type === 'openai' && !form.apiKey?.trim()) {
    message.warning(t('config.providerApiKeyRequired'))
    return false
  }
  return true
}

async function load() {
  loading.value = true
  try {
    const ep = (await getEmbeddingModel()) ?? { type: 'default' }
    form.type = ep.type ?? 'default'
    form.model = ep.model ?? ''
    form.apiBase = ep.apiBase ?? ''
    form.apiKey = ep.apiKey ?? ''
    form.proxyName = ep.proxyName ?? undefined
  } catch {
    message.error(t('config.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!validate()) return
  saving.value = true
  try {
    const payload: EmbeddingModelConfig = { type: form.type }
    if (form.type !== 'default') {
      payload.model = form.model
    }
    if (form.type === 'openai') {
      if (form.apiBase) payload.apiBase = form.apiBase
      if (form.apiKey) payload.apiKey = form.apiKey
      if (form.proxyName) payload.proxyName = form.proxyName
    }
    await saveEmbeddingModel(payload)
    message.success(t('config.saveSuccess'))
  } catch {
    message.error(t('config.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function doTest() {
  if (!validate()) return
  testing.value = true
  try {
    const payload: EmbeddingModelConfig = {
      type: form.type,
      model: form.model,
      apiBase: form.apiBase,
      apiKey: form.apiKey,
    }
    const result = await testEmbeddingModel(payload)
    if (result.ok) {
      message.success(t('config.testEmbeddingSuccess'))
    } else {
      message.error(
        t('config.testEmbeddingFailed', { error: result.error ?? 'unknown' })
      )
    }
  } catch (e: any) {
    message.error(
      t('config.testEmbeddingFailed', { error: e?.message ?? 'unknown' })
    )
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>
