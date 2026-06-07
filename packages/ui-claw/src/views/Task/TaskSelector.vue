<script setup lang="ts">
import { listChildTasks } from '@/claw/api/task'
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  parentId?: number
  excludeId?: number
  /** 批量创建时，其他待创建的任务（用于选择 $N 引用） */
  batchTasks?: { index: number; title: string }[]
}>()

const modelValue = defineModel<string[]>({ default: () => [] })

interface Option {
  value: string
  label: string
}

const siblingOptions = ref<Option[]>([])
const loading = ref(false)

async function load() {
  if (!props.parentId) {
    siblingOptions.value = []
    return
  }
  loading.value = true
  try {
    const tasks = await listChildTasks(props.parentId)
    siblingOptions.value = tasks
      .filter((t) => t.id !== props.excludeId)
      .map((t) => ({ value: String(t.id), label: `#${t.id} ${t.title}` }))
  } catch {
    siblingOptions.value = []
  } finally {
    loading.value = false
  }
}

const allOptions = computed<Option[]>(() => [
  ...(props.batchTasks ?? []).map((b) => ({
    value: `$${b.index}`,
    label: `$${b.index} ${b.title}`,
  })),
  ...siblingOptions.value,
])

watch(() => props.parentId, load, { immediate: false })
onMounted(load)
</script>

<template>
  <a-select
    v-model:value="modelValue"
    mode="multiple"
    :loading="loading"
    :options="allOptions"
    :placeholder="$t('claw.task.prerequisitesPlaceholder')"
    allow-clear
    :filter-option="
      (input: string, opt: Option) =>
        opt.label.toLowerCase().includes(input.toLowerCase())
    "
  />
</template>
