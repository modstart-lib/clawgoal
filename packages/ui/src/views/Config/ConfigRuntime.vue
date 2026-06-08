<script setup lang="ts">
import {
  detectRuntimeVersion,
  getRuntimeConfigs,
  saveRuntimeConfigs,
  type RuntimeConfig,
} from '@/api/config'
import LoadingState from '@/components/LoadingState.vue'
import SystemFileSelectorButton from '@/components/SystemFileSelectorButton.vue'
import { message } from 'ant-design-vue'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)

const BUILTIN_RUNTIMES = [
  { key: 'python', label: 'Python', placeholder: '/usr/bin/python3' },
] as const

const form = ref<Record<string, { path: string; version: string }>>({
  python: { path: '', version: '' },
})

const detecting = ref<Record<string, boolean>>({ python: false })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await getRuntimeConfigs()
    for (const { key } of BUILTIN_RUNTIMES) {
      if (data[key]) {
        form.value[key] = {
          path: data[key].path,
          version: data[key].version ?? '',
        }
      }
    }
  } catch {
    message.error(t('config.runtimeLoadFailed'))
  } finally {
    loading.value = false
  }
}

async function handlePathSelect(key: string, p: string) {
  form.value[key].path = p
  if (!p) return
  detecting.value[key] = true
  try {
    form.value[key].version = await detectRuntimeVersion(p)
  } catch {
    form.value[key].version = ''
  } finally {
    detecting.value[key] = false
  }
}

async function handleSave() {
  const runtime: Record<string, RuntimeConfig> = {}
  for (const { key } of BUILTIN_RUNTIMES) {
    runtime[key] = {
      path: form.value[key].path.trim(),
      version: form.value[key].version,
    }
  }
  saving.value = true
  try {
    await saveRuntimeConfigs(runtime)
    message.success(t('config.runtimeSaveSuccess'))
  } catch {
    message.error(t('config.runtimeSaveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <LoadingState :loading="loading">
      <div class="space-y-4">
        <div
          v-for="item in BUILTIN_RUNTIMES"
          :key="item.key"
          class="rounded-xl border border-gray-100/80 dark:border-gray-700/50 bg-surface/50 dark:bg-panel/30 backdrop-blur-md p-4"
        >
          <div class="flex items-center gap-2 mb-3">
            <span class="font-medium text-sm">{{ item.label }}</span>
            <span
              v-if="form[item.key].version"
              class="text-xs text-gray-400 font-mono"
              >{{ form[item.key].version }}</span
            >
            <a-spin v-if="detecting[item.key]" size="small" />
          </div>
          <div class="flex gap-2">
            <a-input
              v-model:value="form[item.key].path"
              :placeholder="item.placeholder"
              class="flex-1 font-mono text-sm"
            />
            <SystemFileSelectorButton
              @select="(p) => handlePathSelect(item.key, p)"
            />
          </div>
        </div>
      </div>

      <div class="mt-4 flex justify-end">
        <a-button type="primary" :loading="saving" @click="handleSave">
          {{ $t('common.save') }}
        </a-button>
      </div>
    </LoadingState>
  </div>
</template>
