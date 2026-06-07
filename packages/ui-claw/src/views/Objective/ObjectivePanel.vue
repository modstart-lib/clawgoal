<template>
  <div class="py-6 px-1">
    <ListerTop
      :loading="loading"
      :total="filteredObjectives.length"
      @refresh="loadObjectives"
    >
      <LabelSelector v-model="activeFilter" :options="filters" title="" />
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="t('claw.objective.searchPlaceholder')"
        allow-clear
        style="width: 200px"
      />
      <template #actions>
        <a-button
          v-if="objectives.length > 0"
          type="primary"
          @click="showAddModal = true"
        >
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ t('claw.objective.addObjective') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <!-- 目标卡片网格 -->
    <LoadingState :loading="loading">
      <div
        v-if="filteredObjectives.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
      >
        <ObjectiveCard
          v-for="obj in pagedObjectives"
          :key="obj.id"
          :objective="obj"
          :keyword="searchKeyword"
          @click="openObjective"
          @refresh="loadObjectives"
        />
      </div>

      <!-- 底部分页 -->
      <div
        v-if="filteredObjectives.length > pageSize"
        class="flex justify-center mt-6"
      >
        <a-pagination
          v-model:current="currentPage"
          :total="filteredObjectives.length"
          :page-size="pageSize"
          :show-size-changer="false"
          size="small"
        />
      </div>

      <EmptyState
        v-else-if="objectives.length === 0"
        :loading="loading"
        :description="$t('claw.objective.noObjectives')"
      >
        <a-button type="primary" @click="showAddModal = true">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />
            {{ $t('claw.objective.addTitle') }}
          </div>
        </a-button>
      </EmptyState>

      <div
        v-else
        class="py-12 text-center text-sm text-gray-400 dark:text-gray-500"
      >
        {{ $t('claw.objective.noFilteredObjectives') }}
      </div>
    </LoadingState>

    <!-- 目标详情 Modal -->
    <ObjectiveDetailModal
      v-model:open="showDetailModal"
      :objective="selectedObjective"
      @refresh="loadObjectives"
    />

    <!-- 新建目标 Modal -->
    <ObjectiveAddModal
      v-model:open="showAddModal"
      :project-id="props.projectId"
      @refresh="loadObjectives"
    />
  </div>
</template>

<script setup lang="ts">
import { listObjectives } from '@/claw/api/objective'
import EmptyState from '@/components/EmptyState.vue'
import LabelSelector from '@/components/LabelSelector.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Activity from '~icons/lucide/activity'
import CheckCircle2 from '~icons/lucide/check-circle-2'
import Clock from '~icons/lucide/clock'
import List from '~icons/lucide/list'
import PauseCircle from '~icons/lucide/pause-circle'
import Plus from '~icons/lucide/plus'

import XCircle from '~icons/lucide/x-circle'
import ObjectiveAddModal from './ObjectiveAddModal.vue'
import ObjectiveCard from './ObjectiveCard.vue'
import ObjectiveDetailModal from './ObjectiveDetailModal.vue'
import type { Objective } from './types'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()
const props = defineProps<{ projectId: number }>()
const objectives = ref<Objective[]>([])
const loading = ref(false)

const loadObjectives = async () => {
  loading.value = true
  try {
    objectives.value = await listObjectives({ projectId: props.projectId })
    if (selectedObjective.value) {
      const updated = objectives.value.find(
        (o) => o.id === selectedObjective.value!.id
      )
      if (updated) selectedObjective.value = updated
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadObjectives()
  testActionSet('list.refresh', () => loadObjectives())
  testActionSet('list.add', () => {
    showAddModal.value = true
  })
})

onUnmounted(() => {
  testActionUnset('list.refresh')
  testActionUnset('list.add')
})

const showDetailModal = ref(false)
const showAddModal = ref(false)
const selectedObjective = ref<Objective | null>(null)
const activeFilter = ref('all')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(12)

const filters = computed(() => [
  {
    value: 'all',
    label: t('claw.objective.all'),
    count: objectives.value.length,
    icon: List,
  },
  {
    value: 'pending',
    label: t('claw.objective.pending'),
    count: objectives.value.filter((o) => o.status === 'pending').length,
    icon: Clock,
  },
  {
    value: 'active',
    label: t('claw.objective.active'),
    count: objectives.value.filter((o) => o.status === 'active').length,
    icon: Activity,
  },
  {
    value: 'paused',
    label: t('claw.objective.paused'),
    count: objectives.value.filter((o) => o.status === 'paused').length,
    icon: PauseCircle,
  },
  {
    value: 'completed',
    label: t('claw.objective.completed'),
    count: objectives.value.filter((o) => o.status === 'completed').length,
    icon: CheckCircle2,
  },
  {
    value: 'failed',
    label: t('claw.objective.failed'),
    count: objectives.value.filter((o) => o.status === 'failed').length,
    icon: XCircle,
  },
])

const filteredObjectives = computed(() => {
  let list = objectives.value
  if (activeFilter.value !== 'all') {
    list = list.filter((o) => o.status === activeFilter.value)
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim()
    const idMatch = kw.match(/^#(\d+)$/)
    if (idMatch) {
      list = list.filter((o) => o.id === Number(idMatch[1]))
    } else {
      const kwLower = kw.toLowerCase()
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(kwLower) ||
          o.description?.toLowerCase().includes(kwLower)
      )
    }
  }
  return list
})

const pagedObjectives = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredObjectives.value.slice(start, start + pageSize.value)
})

watch([activeFilter, searchKeyword], () => {
  currentPage.value = 1
})

const openObjective = (obj: Objective) => {
  selectedObjective.value = obj
  showDetailModal.value = true
}
</script>
