<template>
  <div
    class="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 cursor-pointer group overflow-hidden"
    @click="$emit('click', project)"
  >
    <!-- 顶部色条 -->
    <div class="h-2 w-full" :style="{ background: colorBar }"></div>

    <div class="p-5">
      <!-- 标题行 -->
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <img
            :src="project.logo || mockAvatarPrefix + project.id"
            class="w-7 h-7 rounded-md object-cover shrink-0 border border-gray-100 dark:border-gray-700"
            alt="logo"
          />
          <div
            class="font-semibold text-gray-900 dark:text-gray-100 text-base leading-tight line-clamp-1"
          >
            <KeywordsMarkViewer :text="project.title" :keywords="keywords" />
          </div>
        </div>
        <span
          class="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
          :class="statusBadge"
        >
          {{ statusLabel }}
        </span>
      </div>

      <!-- 描述 -->
      <p
        v-if="project.description"
        class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2"
      >
        <KeywordsMarkViewer :text="project.description" :keywords="keywords" />
      </p>
      <div v-else class="mb-4"></div>

      <!-- 统计数字行 -->
      <div class="mb-4 grid grid-cols-7 gap-2">
        <div
          class="flex flex-col items-center gap-0.5 cursor-pointer rounded-lg px-1 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
          @click.stop="$emit('click', project, 'backlog')"
        >
          <span
            class="text-base font-bold text-amber-500 dark:text-amber-400"
            >{{ project.backlogCount ?? 0 }}</span
          >
          <span class="text-xs text-gray-400 dark:text-gray-500">{{
            t('claw.project.statsBacklogs')
          }}</span>
        </div>
        <div
          class="flex flex-col items-center gap-0.5 cursor-pointer rounded-lg px-1 py-1.5 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
          @click.stop="$emit('click', project, 'note')"
        >
          <span class="text-base font-bold text-sky-500 dark:text-sky-400">{{
            project.noteCount ?? 0
          }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{
            t('claw.project.statsNotes')
          }}</span>
        </div>
        <div
          class="flex flex-col items-center gap-0.5 cursor-pointer rounded-lg px-1 py-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          @click.stop="$emit('click', project, 'event')"
        >
          <span
            class="text-base font-bold text-primary-500 dark:text-primary-400"
            >{{ totalCount }}</span
          >
          <span class="text-xs text-gray-400 dark:text-gray-500">{{
            t('claw.project.statsEvents')
          }}</span>
        </div>
        <div
          class="flex flex-col items-center gap-0.5 cursor-pointer rounded-lg px-1 py-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          @click.stop="$emit('click', project, 'wiki')"
        >
          <span
            class="text-base font-bold text-green-500 dark:text-green-400"
            >{{ project.wikiCount ?? 0 }}</span
          >
          <span class="text-xs text-gray-400 dark:text-gray-500">{{
            t('claw.project.statsWikis')
          }}</span>
        </div>
        <div
          class="flex flex-col items-center gap-0.5 cursor-pointer rounded-lg px-1 py-1.5 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
          @click.stop="$emit('click', project, 'objective')"
        >
          <span
            class="text-base font-bold text-violet-500 dark:text-violet-400"
            >{{ project.objectiveCount ?? 0 }}</span
          >
          <span class="text-xs text-gray-400 dark:text-gray-500">{{
            t('claw.project.statsObjectives')
          }}</span>
        </div>
        <div
          class="flex flex-col items-center gap-0.5 cursor-pointer rounded-lg px-1 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
          @click.stop="$emit('click', project, 'task')"
        >
          <span class="text-base font-bold text-rose-500 dark:text-rose-400">{{
            project.taskCount ?? 0
          }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{
            t('claw.project.statsTasks')
          }}</span>
        </div>
        <div
          class="flex flex-col items-center gap-0.5 cursor-pointer rounded-lg px-1 py-1.5 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
          @click.stop="$emit('click', project, 'agent')"
        >
          <span class="text-base font-bold text-teal-500 dark:text-teal-400">{{
            project.agentCount ?? 0
          }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{
            t('claw.project.statsAgents')
          }}</span>
        </div>
      </div>

      <!-- 下一个里程碑预览 -->
      <div
        v-if="nextEvent"
        class="mb-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2"
      >
        <div
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :style="{ background: project.color || '#6366f1' }"
        ></div>
        <span class="text-xs text-gray-600 dark:text-gray-300 truncate">{{
          nextEvent.title
        }}</span>
        <span
          v-if="nextEvent.dueAt"
          class="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0"
        >
          <DatetimeViewer :value="nextEvent.dueAt" format="date" />
        </span>
      </div>

      <!-- 底部信息 -->
      <div
        class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-3 border-t border-gray-50 dark:border-gray-700"
      >
        <div class="flex items-center gap-1">
          <span
            class="font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            :title="t('claw.common.copyIdTooltip')"
            @click.stop="copyText(String(project.id))"
            >#{{ project.id }}</span
          >
          <span class="opacity-30">·</span>
          <CalendarDays class="w-3.5 h-3.5" />
          <DatetimeViewer
            :value="project.dueAt"
            :fallback="t('claw.project.noDueDate')"
            format="date"
          />
        </div>
        <div
          class="flex items-center gap-1 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
        >
          <span>{{ t('claw.project.viewDetail') }}</span>
          <ChevronRight class="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { resolveApiPath } from '@/api/base'
import type { ProjectItem } from '@/claw/api/project'
import { PROJECT_STATUS_BADGE } from '@/claw/views/Project/constant'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import KeywordsMarkViewer from '@/components/KeywordsMarkViewer.vue'
import { copyText } from '@/utils/utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CalendarDays from '~icons/lucide/calendar-days'
import ChevronRight from '~icons/lucide/chevron-right'

const mockAvatarPrefix = resolveApiPath('/mock/randomCover?seed=')

const props = defineProps<{
  project: ProjectItem
  keywords?: string | null
}>()

defineEmits<{
  (e: 'click', p: ProjectItem, tab?: string): void
}>()

const { t } = useI18n()

const totalCount = computed(() => props.project.events?.length || 0)
const nextEvent = computed(() => props.project.events?.[0])

const colorBar = computed(() => {
  const c = props.project.color || '#6366f1'
  return `linear-gradient(90deg, ${c}cc, ${c}66)`
})

const statusBadge = computed(
  () =>
    PROJECT_STATUS_BADGE[props.project.status] || PROJECT_STATUS_BADGE.active
)
const statusLabelMap: Record<string, string> = {
  planning: t('claw.project.statusPlanning'),
  active: t('claw.project.statusActive'),
  paused: t('claw.project.statusPaused'),
  done: t('claw.project.statusDone'),
}
const statusLabel = computed(
  () => statusLabelMap[props.project.status] || statusLabelMap.active
)
</script>
