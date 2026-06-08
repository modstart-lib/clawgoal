<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles } from 'lucide-vue-next'
import { getProviderList, type UnifiedProvider } from '@/api/model'
import ModelIcon from '../../components/ModelIcon.vue'
import {
  PROVIDER_COLORS,
  PROVIDER_LABELS,
} from './configModelProviderConstants'

const { t } = useI18n()

withDefaults(
  defineProps<{
    value?: string
    placeholder?: string
    size?: 'small' | 'middle' | 'large'
    disabled?: boolean
    allowClear?: boolean
  }>(),
  {
    value: undefined,
    placeholder: '',
    size: 'middle',
    disabled: false,
    allowClear: true,
  }
)

const emit = defineEmits<{
  'update:value': [value: string]
}>()

const providers = ref<UnifiedProvider[]>([])
const loading = ref(false)

const customProviders = computed(() =>
  providers.value.filter((p) => !p._builtIn)
)
const builtinProvider = computed(
  () => providers.value.find((p) => p._builtIn) ?? null
)
const builtinVisibleModels = computed(() => {
  if (!builtinProvider.value) return []
  return builtinProvider.value.models.filter((m) => m.visible !== false)
})

const fetchProviders = async () => {
  loading.value = true
  try {
    providers.value = await getProviderList()
  } catch {
    providers.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetchProviders)

const filterOption = (input: string, option: any) => {
  return option.value.toLowerCase().includes(input.toLowerCase())
}

const handleChange = (val: string) => {
  emit('update:value', val)
}

defineExpose({ refresh: fetchProviders })

function getProviderLabel(provider: string): string {
  const i18nKey = `config.provider${provider.charAt(0).toUpperCase() + provider.slice(1)}`
  const translated = t(i18nKey)
  if (translated === i18nKey) {
    return PROVIDER_LABELS[provider] ?? provider
  }
  return translated
}
</script>

<template>
  <a-select
    :value="value"
    :placeholder="placeholder || t('config.modelSelectorPlaceholder')"
    :size="size"
    :disabled="disabled"
    :allow-clear="allowClear"
    :loading="loading"
    show-search
    option-label-prop="label"
    :filter-option="filterOption"
    class="w-full"
    @change="handleChange"
  >
    <!-- 默认模型 -->
    <a-select-option value="default" label="default">
      <span class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            class="shrink-0"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" stroke="#10B981" stroke-width="2" />
            <path
              d="M8 12l3 3 5-5"
              stroke="#10B981"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="font-mono text-xs">default</span>
        </span>
        <a-tag
          color="green"
          class="text-xs! m-0! px-1! py-0! leading-4! shrink-0"
        >
          {{ t('config.modelDefault') }}
        </a-tag>
      </span>
    </a-select-option>

    <!-- 内置模型分组 -->
    <a-select-opt-group v-if="builtinVisibleModels.length > 0" key="builtin">
      <template #label>
        <span class="flex items-center gap-1.5">
          <Sparkles
            class="w-3.5 h-3.5 text-violet-500 shrink-0"
            aria-hidden="true"
          />
          <span class="font-medium text-violet-600 dark:text-violet-400">{{
            t('config.builtinGroupLabel')
          }}</span>
        </span>
      </template>
      <a-select-option
        v-for="m in builtinVisibleModels"
        :key="`builtin|${m.builtinId ?? m.name}`"
        :value="`builtin|${m.builtinId ?? m.name}`"
        :label="m.name"
      >
        <span class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1.5">
            <Sparkles
              class="w-3 h-3 text-violet-400 shrink-0"
              aria-hidden="true"
            />
            <span class="font-mono text-xs">{{ m.name }}</span>
          </span>
          <span v-if="m.builtinRate" class="text-xs text-gray-400 shrink-0"
            >×{{ m.builtinRate }}</span
          >
        </span>
      </a-select-option>
    </a-select-opt-group>

    <!-- 自定义提供商模型分组 -->
    <template v-if="customProviders.length > 0">
      <a-select-opt-group v-for="p in customProviders" :key="p.name">
        <template #label>
          <span class="flex items-center gap-1.5">
            <ModelIcon :provider="p.provider" :size="15" class="shrink-0" />
            <a-tag
              :color="PROVIDER_COLORS[p.provider] || 'default'"
              class="text-xs! m-0! px-1! py-0! leading-4!"
            >
              {{ getProviderLabel(p.provider) }}
            </a-tag>
            <span
              class="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              {{ p.name }}
            </span>
          </span>
        </template>
        <a-select-option
          v-for="(m, mi) in p.models"
          :key="`${p.name}|${m.name}`"
          :value="`${p.name}|${m.name}`"
          :label="m.name"
        >
          <span class="flex items-center justify-between gap-2">
            <span class="font-mono text-xs">{{ m.name }}</span>
            <a-tag
              v-if="mi === 0"
              color="blue"
              class="text-xs! m-0! px-1! py-0! leading-4! shrink-0"
            >
              {{ t('config.modelDefault') }}
            </a-tag>
          </span>
        </a-select-option>
      </a-select-opt-group>
    </template>
    <template v-else-if="!loading">
      <a-select-option disabled value="">
        <span class="text-xs text-gray-400">{{
          t('config.modelNoProviders')
        }}</span>
      </a-select-option>
    </template>
  </a-select>
</template>
