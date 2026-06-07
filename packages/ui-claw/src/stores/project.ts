import { listProjects, type ProjectItem } from '@/claw/api/project'
import { ref, watch } from 'vue'

const projects = ref<ProjectItem[]>([])
const loading = ref(false)

const changeListeners = new Set<(list: ProjectItem[]) => void>()

watch(
  projects,
  (list) => {
    changeListeners.forEach((fn) => fn(list))
  },
  { deep: true }
)

const load = async (): Promise<void> => {
  if (projects.value.length > 0 || loading.value) return
  loading.value = true
  try {
    projects.value = await listProjects()
  } finally {
    loading.value = false
  }
}

const refresh = async (): Promise<void> => {
  loading.value = true
  try {
    projects.value = await listProjects()
  } finally {
    loading.value = false
  }
}

/** 监听项目列表变化，返回取消监听函数 */
const onProjectsChange = (fn: (list: ProjectItem[]) => void): (() => void) => {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

export const useProjectStore = () => {
  load()
  return { projects, loading, refresh, onProjectsChange }
}
