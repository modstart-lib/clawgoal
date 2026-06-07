<script setup lang="ts">
import { getProviderList, type UnifiedProvider } from '@/api/model'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles } from 'lucide-vue-next'
import ModelIcon from './ModelIcon.vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    value?: string
    disabled?: boolean
    size?: 'small' | 'middle' | 'large'
  }>(),
  {
    value: undefined,
    disabled: false,
    size: 'middle',
  }
)

const emit = defineEmits<{
  'update:value': [value: string]
}>()

const providers = ref<UnifiedProvider[]>([])

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

function handleChange(val: string) {
  emit('update:value', val)
}

onMounted(async () => {
  try {
    providers.value = await getProviderList()
    // 如果没有选中值，且有可用模型，不自动选择（保持 default）
    if (!props.value) {
      emit('update:value', 'default')
    }
  } catch {
    // ignore
  }
})
</script>

<template>
  <a-select
    :value="value"
    :disabled="disabled"
    :size="size"
    class="w-full"
    @change="handleChange"
  >
    <a-select-option value="default">
      <div class="flex items-center gap-2">
        <span class="text-gray-400">{{ t('modelSelector.defaultModel') }}</span>
      </div>
    </a-select-option>

    <!-- 内置模型分组 -->
    <a-select-opt-group v-if="builtinVisibleModels.length > 0" key="builtin">
      <template #label>
        <div class="flex items-center gap-1.5">
          <Sparkles class="w-3.5 h-3.5 text-violet-500" aria-hidden="true" />
          <span class="font-medium text-violet-600 dark:text-violet-400">{{
            t('modelSelector.builtinLabel')
          }}</span>
        </div>
      </template>
      <a-select-option
        v-for="m in builtinVisibleModels"
        :key="`builtin|${m.builtinId ?? m.name}`"
        :value="`builtin|${m.builtinId ?? m.name}`"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <Sparkles class="w-3 h-3 text-violet-400" aria-hidden="true" />
            <span>{{ m.name }}</span>
          </div>
          <span v-if="m.builtinRate" class="text-xs text-gray-400 shrink-0"
            >×{{ m.builtinRate }}</span
          >
        </div>
      </a-select-option>
    </a-select-opt-group>

    <!-- 自定义提供商模型分组 -->
    <a-select-opt-group v-for="p in customProviders" :key="p.name">
      <template #label>
        <div class="flex items-center gap-1.5">
          <model-icon
            :provider="p.provider"
            :model="p.models[0]?.name"
            :size="14"
          />
          <span class="font-medium capitalize">{{ p.name }}</span>
        </div>
      </template>
      <a-select-option
        v-for="m in p.models"
        :key="`${p.name}|${m.name}`"
        :value="`${p.name}|${m.name}`"
      >
        <div class="flex items-center gap-2">
          <model-icon :provider="p.provider" :model="m.name" :size="14" />
          <span>{{ m.name }}</span>
        </div>
      </a-select-option>
    </a-select-opt-group>
  </a-select>
</template>
