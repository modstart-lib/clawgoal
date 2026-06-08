<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, ref } from 'vue'
import { getApiBase } from '../api/base'
import { useAuth } from '../composables/auth.ts'

const props = withDefaults(
  defineProps<{
    value?: string
    url?: string
    options?: string[]
    placeholder?: string
    allowClear?: boolean
  }>(),
  {
    value: '',
    url: undefined,
    options: undefined,
    placeholder: '',
    allowClear: false,
  }
)

const emit = defineEmits<{ 'update:value': [value: string] }>()

const remoteOptions = ref<string[]>([])

async function loadRemote() {
  if (!props.url) return
  try {
    const authStore = useAuth()
    const res = await axios.post(
      getApiBase() + props.url,
      {},
      { headers: { Authorization: `Bearer ${authStore.token}` } }
    )
    remoteOptions.value = res.data?.data?.records ?? []
  } catch {
    remoteOptions.value = []
  }
}

onMounted(() => {
  loadRemote()
})

const autoOptions = computed(() => {
  const merged = [...remoteOptions.value, ...(props.options ?? [])]
  const unique = [...new Set(merged)].filter(Boolean)
  return unique.map((v) => ({ value: v }))
})
</script>

<template>
  <a-auto-complete
    :value="value"
    :options="autoOptions"
    :placeholder="placeholder"
    :allow-clear="allowClear"
    class="w-full hover:!border-primary-500 focus-within:!border-primary-600 focus-within:!shadow-[0_0_0_2px_rgba(var(--primary-600),0.2)] transition-all duration-200"
    @update:value="emit('update:value', $event)"
  />
</template>
