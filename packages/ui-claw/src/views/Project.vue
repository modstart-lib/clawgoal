<template>
  <div class="pb-10">
    <PageHeader :title="t('claw.project.title')" />

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ t('claw.project.statsProjects') }}
            </div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ projects.length }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center"
          >
            <Folder class="w-5 h-5 text-primary-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ t('claw.project.statsBacklogs') }}
            </div>
            <div class="text-2xl font-bold text-amber-500">
              {{ totalBacklogCount }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center"
          >
            <Layers class="w-5 h-5 text-amber-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ t('claw.project.statsNotes') }}
            </div>
            <div class="text-2xl font-bold text-sky-600 dark:text-sky-500">
              {{ totalNoteCount }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-sky-50 dark:bg-sky-900/20 rounded-lg flex items-center justify-center"
          >
            <FileText class="w-5 h-5 text-sky-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ t('claw.project.statsEvents') }}
            </div>
            <div
              class="text-2xl font-bold text-primary-600 dark:text-primary-500"
            >
              {{ totalEventCount }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center"
          >
            <Milestone class="w-5 h-5 text-primary-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ t('claw.project.statsWikis') }}
            </div>
            <div class="text-2xl font-bold text-green-600 dark:text-green-500">
              {{ totalWikiCount }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center"
          >
            <BookOpen class="w-5 h-5 text-green-500" />
          </div>
        </div>
      </div>
    </div>
    <ListerTop
      :loading="loading"
      :total="projects.length"
      @refresh="loadProjects"
    >
      <LabelSelector
        v-model="activeFilter"
        :options="filters"
        :title="t('claw.project.filterTitle')"
      />
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="t('claw.project.searchPlaceholder')"
        allow-clear
        class="!max-w-xs"
      />
      <template #actions>
        <a-button
          v-if="projects.length > 0"
          type="primary"
          @click="showAddModal = true"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ t('common.add') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <LoadingState :loading="loading">
      <div
        v-if="filteredProjects.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 gap-5"
      >
        <ProjectCard
          v-for="p in filteredProjects"
          :key="p.id"
          :project="p"
          :keywords="searchKeyword || null"
          @click="(p, tab) => openProject(p, tab)"
        />
      </div>

      <EmptyState
        v-else-if="projects.length === 0"
        :loading="loading"
        :description="t('claw.project.emptyDesc')"
      >
        <a-button type="primary" @click="showAddModal = true">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ t('common.add') }}
          </div>
        </a-button>
      </EmptyState>

      <div
        v-else
        class="py-12 text-center text-sm text-gray-400 dark:text-gray-500"
      >
        {{ t('claw.project.filterEmpty') }}
      </div>
    </LoadingState>

    <!-- 新建 / 编辑 Modal -->
    <ProjectAddModal
      v-model:open="showAddModal"
      :project="editingProject"
      @refresh="loadProjects"
    />
  </div>
</template>

<script setup lang="ts">
import { listProjects, type ProjectItem } from '@/claw/api/project'
import EmptyState from '@/components/EmptyState.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { testActionSet, testActionUnset } from '@/utils/test'
import Activity from '~icons/lucide/activity'
import BookOpen from '~icons/lucide/book-open'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import FileText from '~icons/lucide/file-text'
import Folder from '~icons/lucide/folder'
import Layers from '~icons/lucide/layers'
import Lightbulb from '~icons/lucide/lightbulb'
import List from '~icons/lucide/list'
import Milestone from '~icons/lucide/milestone'
import PauseCircle from '~icons/lucide/pause-circle'
import Plus from '~icons/lucide/plus'

import ProjectAddModal from './Project/ProjectAddModal.vue'
import ProjectCard from './Project/ProjectCard.vue'

const { t } = useI18n()
const router = useRouter()
const projects = ref<ProjectItem[]>([])
const loading = ref(false)

const loadProjects = async () => {
  loading.value = true
  try {
    projects.value = await listProjects()
  } finally {
    loading.value = false
  }
}

onMounted(loadProjects)

onMounted(() => {
  testActionSet('list.refresh', () => loadProjects())
  testActionSet('list.add', () => {
    showAddModal.value = true
  })
  testActionSet('list.search', (kw: string) => {
    searchKeyword.value = kw
  })
})
onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
  testActionUnset('list.search')
})

const showAddModal = ref(false)
const editingProject = ref<ProjectItem | null>(null)
const activeFilter = ref('all')
const searchKeyword = ref('')

const openProject = (p: ProjectItem, tab?: string) => {
  router.push({
    path: `/claw/project/${p.id}`,
    query: tab ? { tab } : undefined,
  })
}

watch(showAddModal, (v) => {
  if (!v) editingProject.value = null
})

const filters = computed(() => [
  {
    value: 'all',
    label: t('claw.project.filterAll'),
    count: projects.value.length,
    icon: List,
  },
  {
    value: 'planning',
    label: t('claw.project.filterPlanning'),
    count: projects.value.filter((p) => p.status === 'planning').length,
    icon: Lightbulb,
  },
  {
    value: 'active',
    label: t('claw.project.filterActive'),
    count: projects.value.filter((p) => p.status === 'active').length,
    icon: Activity,
  },
  {
    value: 'paused',
    label: t('claw.project.filterPaused'),
    count: projects.value.filter((p) => p.status === 'paused').length,
    icon: PauseCircle,
  },
  {
    value: 'done',
    label: t('claw.project.filterDone'),
    count: projects.value.filter((p) => p.status === 'done').length,
    icon: CheckCircle2,
  },
])

const filteredProjects = computed(() => {
  let list =
    activeFilter.value === 'all'
      ? projects.value
      : projects.value.filter((p) => p.status === activeFilter.value)
  const kw = searchKeyword.value.trim()
  if (kw) {
    const idMatch = kw.match(/^#(\d+)$/)
    if (idMatch) {
      list = list.filter((p) => p.id === Number(idMatch[1]))
    } else {
      const kwLower = kw.toLowerCase()
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(kwLower) ||
          (p.description || '').toLowerCase().includes(kwLower)
      )
    }
  }
  return list
})

const totalBacklogCount = computed(() =>
  projects.value.reduce((sum, p) => sum + (p.backlogCount ?? 0), 0)
)
const totalNoteCount = computed(() =>
  projects.value.reduce((sum, p) => sum + (p.noteCount ?? 0), 0)
)
const totalEventCount = computed(() =>
  projects.value.reduce((sum, p) => sum + (p.events?.length ?? 0), 0)
)
const totalWikiCount = computed(() =>
  projects.value.reduce((sum, p) => sum + (p.wikiCount ?? 0), 0)
)
</script>
