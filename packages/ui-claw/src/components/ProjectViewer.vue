<script setup lang="ts">
/**
 * ProjectViewer — 项目图标 + 标题只读展示
 *
 * Props:
 *   projectId  number   项目 ID（必填）
 *   projects   ProjectItem[]  全部项目列表（父组件注入，避免重复请求）
 *
 * 如未传 projects 则组件自行请求。
 */
import { listProjects, type ProjectItem } from '@/claw/api/project'
import { resolveApiPath } from '@/api/base'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  projectId: number
  projects?: ProjectItem[]
}>()

const localProjects = ref<ProjectItem[]>([])
const mockCoverPrefix = resolveApiPath('/mock/randomCover?seed=')

onMounted(async () => {
  if (!props.projects) {
    localProjects.value = await listProjects().catch(() => [])
  }
})

const allProjects = computed(() => props.projects ?? localProjects.value)

const project = computed(() =>
  allProjects.value.find((p) => p.id === props.projectId)
)
</script>

<template>
  <span v-if="project" class="inline-flex items-center gap-1 min-w-0">
    <img
      :src="project.logo || mockCoverPrefix + project.id"
      class="w-4 h-4 rounded shrink-0 object-cover"
      alt=""
    />
    <span class="truncate text-sm">{{ project.title }}</span>
  </span>
</template>
