<script setup lang="ts">
import { listProjects, type ProjectItem } from '@/claw/api/project'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    value?: number[]
    statusFilter?: string
  }>(),
  {
    value: () => [],
    statusFilter: 'active',
  }
)

const emit = defineEmits<{
  'update:value': [ids: number[]]
}>()

const { t } = useI18n()
const projects = ref<ProjectItem[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const all = await listProjects()
    projects.value = all.filter((p: ProjectItem) => p.status === 'active')
  } finally {
    loading.value = false
  }
})

const handleChange = (val: number[]) => {
  emit('update:value', val)
}
</script>

<template>
  <a-select
    mode="multiple"
    :value="value"
    :loading="loading"
    :placeholder="t('claw.compProjectMultiSelector.placeholder')"
    allow-clear
    class="w-full"
    :options="
      projects.map((p: ProjectItem) => ({ value: p.id, label: p.title }))
    "
    @change="handleChange"
  />
</template>
