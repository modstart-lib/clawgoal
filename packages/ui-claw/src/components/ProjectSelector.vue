<script setup lang="ts">
import { listProjects, type ProjectItem } from '@/claw/api/project'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { modelValue = null, placeholder = undefined } = defineProps<{
  modelValue?: number | null
  placeholder?: string
}>()

const { t } = useI18n()

const emit = defineEmits<{
  'update:modelValue': [id: number | undefined]
}>()

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
</script>

<template>
  <a-select
    :value="modelValue ?? undefined"
    :loading="loading"
    :placeholder="placeholder ?? t('claw.compProjectSelector.placeholder')"
    allow-clear
    class="w-min-40"
    :options="
      projects.map((p: ProjectItem) => ({ value: p.id, label: p.title }))
    "
    @change="emit('update:modelValue', $event as number | undefined)"
  />
</template>
