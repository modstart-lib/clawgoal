<template>
  <div class="h-full flex flex-col">
    <!-- 页面标题 -->
    <div
      class="flex flex-wrap justify-between items-center gap-2 pb-2 shrink-0"
    >
      <div class="flex items-center gap-2">
        <a-button
          type="text"
          size="small"
          @click="router.push('/claw/project')"
        >
          <ArrowLeft
            class="w-5 h-5 text-gray-600 dark:text-gray-400"
            aria-hidden="true"
          />
        </a-button>
        <a-dropdown :trigger="['click']">
          <div
            class="flex items-center gap-1 cursor-pointer hover:opacity-75 transition-opacity"
          >
            <div
              class="text-xl md:text-2xl font-bold flex items-center gap-2"
              :style="{ color: project?.color || '#6366f1' }"
            >
              <img
                v-if="project"
                :src="project.logo || mockCoverPrefix + project.id"
                class="w-6 h-6 shrink-0 rounded object-cover"
                alt="logo"
              />
              {{ project?.title || t('common.loading') }}
            </div>
            <span
              v-if="project"
              class="text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded"
              >#{{ project.id }}</span
            >
            <ChevronDown
              class="w-4 h-4 text-gray-400 shrink-0"
              aria-hidden="true"
            />
          </div>
          <template #overlay>
            <a-menu class="!min-w-[200px]">
              <a-menu-item
                v-for="p in allProjects"
                :key="p.id"
                :class="
                  p.id === projectId
                    ? '!font-semibold !bg-gray-50 dark:!bg-gray-700'
                    : ''
                "
                @click="
                  router.push({
                    path: `/claw/project/${p.id}`,
                    query: { tab: activeTab },
                  })
                "
              >
                <div class="flex items-center gap-2 py-0.5">
                  <img
                    :src="p.logo || mockCoverPrefix + p.id"
                    class="w-5 h-5 rounded object-cover shrink-0 border border-gray-100 dark:border-gray-700"
                    alt=""
                  />
                  <span class="truncate">{{ p.title }}</span>
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>

    <!-- 主内容 -->
    <div class="flex-1 min-h-0 flex flex-col">
      <LoadingState :loading="loading">
        <div class="flex-1 min-h-0 overflow-hidden h-full">
          <a-tabs
            v-model:active-key="activeTab"
            class="h-full flex flex-col"
            :tab-bar-style="{ marginBottom: 0, overflowX: 'auto' }"
            :tab-bar-gutter="8"
          >
            <!-- 需求 Tab -->
            <a-tab-pane key="backlog">
              <template #tab>
                <span class="flex items-center">
                  <Layers class="w-4 h-4 mr-1.5" />{{
                    t('claw.project.tabBacklog')
                  }}
                </span>
              </template>
              <BacklogPanel v-if="project" :project="project" />
            </a-tab-pane>

            <!-- 目标 Tab -->
            <a-tab-pane key="objective">
              <template #tab>
                <span class="flex items-center">
                  <Target class="w-4 h-4 mr-1.5" />{{
                    t('claw.project.tabObjective')
                  }}
                </span>
              </template>
              <ObjectivePanel v-if="project" :project-id="project.id" />
            </a-tab-pane>

            <!-- 任务 Tab -->
            <a-tab-pane key="task">
              <template #tab>
                <span class="flex items-center">
                  <ListTodo class="w-4 h-4 mr-1.5" />{{
                    t('claw.project.tabTask')
                  }}
                </span>
              </template>
              <TaskPanel v-if="project" :project-id="project.id" />
            </a-tab-pane>

            <!-- 笔记 Tab -->
            <a-tab-pane key="note">
              <template #tab>
                <span class="flex items-center">
                  <FileText class="w-4 h-4 mr-1.5" />{{
                    t('claw.project.tabNotes')
                  }}
                </span>
              </template>
              <NotePanel
                v-if="project"
                :project="project"
                @refresh="loadProject"
              />
            </a-tab-pane>

            <!-- 事件 Tab -->
            <a-tab-pane key="event">
              <template #tab>
                <span class="flex items-center">
                  <Flag class="w-4 h-4 mr-1.5" />{{
                    t('claw.project.tabEvents')
                  }}
                </span>
              </template>
              <EventPanel :project="project" @refresh="loadProject" />
            </a-tab-pane>

            <!-- 指标 Tab -->
            <a-tab-pane key="metric">
              <template #tab>
                <span class="flex items-center">
                  <BarChart2 class="w-4 h-4 mr-1.5" />{{
                    t('claw.project.tabMetric')
                  }}
                </span>
              </template>
              <MetricPanel v-if="project" :project-id="project.id" />
            </a-tab-pane>

            <!-- 管理 Tab -->
            <a-tab-pane key="wiki">
              <template #tab>
                <span class="flex items-center">
                  <BookOpen class="w-4 h-4 mr-1.5" />{{
                    t('claw.project.tabWiki')
                  }}
                </span>
              </template>
              <WikiPanel v-if="project" :project-id="project.id" />
            </a-tab-pane>

            <!-- 智能体 Tab -->
            <a-tab-pane key="agent">
              <template #tab>
                <span class="flex items-center">
                  <Users class="w-4 h-4 mr-1.5" />{{
                    t('claw.project.tabAgent')
                  }}
                </span>
              </template>
              <ProjectDetailAgent v-if="project" :project-id="project.id" />
            </a-tab-pane>

            <!-- 管理 Tab -->
            <a-tab-pane key="manage">
              <template #tab>
                <span class="flex items-center">
                  <Settings class="w-4 h-4 mr-1.5" />{{
                    t('claw.project.tabManage')
                  }}
                </span>
              </template>
              <ProjectDetailManage
                :project="project"
                :summary-key="summaryKey"
                @delete="handleDelete"
                @refresh="loadProject"
              />
            </a-tab-pane>
          </a-tabs>
        </div>
      </LoadingState>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectItem } from '@/claw/api/project'
import { getProject } from '@/claw/api/project'
import { useProjectStore } from '@/claw/stores/project'
import { resolveApiPath } from '@/api/base'
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ArrowLeft from '~icons/lucide/arrow-left'
import BarChart2 from '~icons/lucide/bar-chart-2'
import BookOpen from '~icons/lucide/book-open'
import ChevronDown from '~icons/lucide/chevron-down'
import FileText from '~icons/lucide/file-text'
import Flag from '~icons/lucide/flag'
import Layers from '~icons/lucide/layers'
import ListTodo from '~icons/lucide/list-todo'
import Settings from '~icons/lucide/settings'
import Target from '~icons/lucide/target'
import Users from '~icons/lucide/users'
import { testActionSet, testActionUnset } from '@/utils/test'
import BacklogPanel from '../Backlog/BacklogPanel.vue'
import EventPanel from '../Event/EventPanel.vue'
import ProjectDetailManage from './ProjectDetail/ProjectDetailManage.vue'
import MetricPanel from '../Metric/MetricPanel.vue'
import NotePanel from '../Note/NotePanel.vue'
import ObjectivePanel from '../Objective/ObjectivePanel.vue'
import ProjectDetailAgent from './ProjectDetail/ProjectDetailAgent.vue'
import TaskPanel from '../Task/TaskPanel.vue'
import WikiPanel from '../Wiki/WikiPanel.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const mockCoverPrefix = resolveApiPath('/mock/randomCover?seed=')
const { projects: allProjects } = useProjectStore()

const projectId = ref(parseInt(route.params.id as string))
const project = ref<ProjectItem | null>(null)
const loading = ref(false)
const activeTab = ref((route.query.tab as string) || 'backlog')
const summaryKey = ref(0)

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})

const loadProject = async () => {
  loading.value = true
  project.value = null
  try {
    projectId.value = parseInt(route.params.id as string)
    project.value = await getProject(projectId.value)
    summaryKey.value += 1
  } catch (err) {
    console.error(err)
    message.error(t('claw.project.loadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProject()
  testActionSet('page.ready', () => {})
  testActionSet('tab.switch', (tab: string) => {
    activeTab.value = tab
  })
})

onUnmounted(() => {
  testActionUnset('page.ready')
  testActionUnset('tab.switch')
})

watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      loadProject()
      activeTab.value = (route.query.tab as string) || 'backlog'
    }
  }
)

const handleDelete = () => {
  message.success(t('claw.project.deleteSuccess'))
  router.push('/claw/project')
}
</script>

<style scoped>
:deep(.ant-tabs-nav) {
  margin-bottom: 0;
}
:deep(.ant-tabs-content) {
  height: 100%;
}
</style>
