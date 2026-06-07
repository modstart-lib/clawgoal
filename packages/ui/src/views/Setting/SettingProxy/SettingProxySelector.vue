<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProxyConfigs } from '../../../api/config'

const { t } = useI18n()

withDefaults(
  defineProps<{
    value?: string | null
    placeholder?: string
    allowClear?: boolean
  }>(),
  {
    value: null,
    placeholder: '',
    allowClear: true,
  }
)

const emit = defineEmits<{
  'update:value': [value: string | undefined]
}>()

const options = ref<{ label: string; value: string }[]>([])
const loading = ref(false)

const fetchProxies = async () => {
  loading.value = true
  try {
    const proxies = await getProxyConfigs()
    options.value = [
      { label: t('settingProxy.noProxy'), value: '' },
      ...proxies.map((p) => ({ label: p.name, value: p.name })),
    ]
  } catch {
    options.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetchProxies)

const handleChange = (val: string) => {
  emit('update:value', val || undefined)
}

defineExpose({ refresh: fetchProxies })
</script>

<template>
  <a-select
    :value="value"
    :placeholder="placeholder || t('config.proxySelectorPlaceholder')"
    :allow-clear="allowClear"
    :loading="loading"
    :options="options"
    class="w-full"
    @change="handleChange"
  />
</template>
