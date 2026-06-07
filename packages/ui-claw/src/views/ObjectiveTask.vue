<template>
  <div class="pb-10">
    <PageHeader :title="$t('claw.objective.title')">
      <template #action>
        <a-button @click="showSettingModal = true">
          <div class="inline-flex items-center gap-1">
            <Settings class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.objective.settingTitle') }}
          </div>
        </a-button>
      </template>
    </PageHeader>

    <ObjectiveSettingModal v-model:open="showSettingModal" />

    <!-- 统计卡片 -->
    <div class="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.objective.statObjectiveCount') }}
            </div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ objectiveTotalExcludePaused }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center"
          >
            <Target class="w-5 h-5 text-primary-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.objective.statInProgress') }}
            </div>
            <div class="text-2xl font-bold text-amber-500">
              {{ objectiveActive }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center"
          >
            <Activity class="w-5 h-5 text-amber-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.objective.statCompleted') }}
            </div>
            <div class="text-2xl font-bold text-green-600 dark:text-green-500">
              {{ objectiveCompleted }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center"
          >
            <CheckCircle2 class="w-5 h-5 text-green-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.objective.statTaskCount') }}
            </div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ taskTotalExcludeCanceled }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-sky-50 dark:bg-sky-900/20 rounded-lg flex items-center justify-center"
          >
            <ListTodo class="w-5 h-5 text-sky-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.objective.statPending') }}
            </div>
            <div class="text-2xl font-bold text-sky-600 dark:text-sky-500">
              {{ taskPending }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-sky-50 dark:bg-sky-900/20 rounded-lg flex items-center justify-center"
          >
            <Clock class="w-5 h-5 text-sky-500" />
          </div>
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {{ $t('claw.objective.statCompleted') }}
            </div>
            <div class="text-2xl font-bold text-green-600 dark:text-green-500">
              {{ taskCompleted }}
            </div>
          </div>
          <div
            class="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center"
          >
            <CheckCircle2 class="w-5 h-5 text-green-500" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { listObjectives } from '@/claw/api/objective'
import { getTaskStats } from '@/claw/api/task'
import PageHeader from '@/components/PageHeader.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Activity from '~icons/lucide/activity'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import Clock from '~icons/lucide/clock'
import Settings from '~icons/lucide/settings'
import Target from '~icons/lucide/target'
import ObjectiveSettingModal from './Project/ProjectDetail/Objective/ObjectiveSettingModal.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const showSettingModal = ref(false)

const objectives = ref<{ status: string }[]>([])
const taskStatusCounts = ref<Record<string, number>>({})

const loadStats = async () => {
  const [objs, counts] = await Promise.all([listObjectives(), getTaskStats()])
  objectives.value = objs
  taskStatusCounts.value = counts
}

onMounted(() => {
  loadStats()
  testActionSet('list.refresh', () => loadStats())
})

onUnmounted(() => {
  testActionUnset('list.refresh')
})

const objectiveTotalExcludePaused = computed(
  () => objectives.value.filter((o) => o.status !== 'paused').length
)
const objectiveActive = computed(
  () => objectives.value.filter((o) => o.status === 'active').length
)
const objectiveCompleted = computed(
  () => objectives.value.filter((o) => o.status === 'completed').length
)

const taskTotalExcludeCanceled = computed(() => {
  const c = taskStatusCounts.value
  return Object.entries(c)
    .filter(([k]) => k !== 'canceled')
    .reduce((sum, [, v]) => sum + v, 0)
})
const taskPending = computed(
  () =>
    (taskStatusCounts.value.draft ?? 0) + (taskStatusCounts.value.ready ?? 0)
)
const taskCompleted = computed(() => taskStatusCounts.value.success ?? 0)
</script>
