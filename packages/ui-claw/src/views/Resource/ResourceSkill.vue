<template>
  <div>
    <!-- 状态统计栏 -->
    <div class="flex items-center justify-between mb-4">
      <div
        class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"
      >
        <span>{{
          $t('claw.resource.totalSkills', { count: skills.length })
        }}</span>
        <span v-if="tagCount > 0" class="flex items-center gap-1">
          <span
            class="inline-block w-1.5 h-1.5 rounded-full bg-primary-400"
          ></span>
          {{ $t('claw.resource.tagCount', { count: tagCount }) }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <a-button
          type="default"
          :loading="loading"
          @click="() => loadSkills(true)"
        >
          <div class="inline-flex items-center gap-1">
            <RefreshCw class="w-4 h-4" aria-hidden="true" />
            {{ $t('common.refresh') }}
          </div>
        </a-button>
      </div>
    </div>

    <LoadingState :loading="loading">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ResourceSkillCard
          v-for="skill in skills"
          :key="skill.name"
          :skill="skill"
          @view="viewSkill(skill.name)"
          @delete="handleDelete(skill.name)"
        />

        <EmptyState
          v-if="skills.length === 0"
          :loading="loading"
          class="col-span-full"
          :description="$t('claw.resource.noSkills')"
        />
      </div>
    </LoadingState>

    <p class="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
      {{ $t('claw.resource.skillsHint') }}
    </p>

    <ResourceSkillDetailModal
      v-model:open="detailVisible"
      :skill="detailSkill"
    />
  </div>
</template>

<script setup lang="ts">
import type { Skill, SkillDetail } from '@/claw/api/skill'
import { deleteSkill, getSkill, listSkills } from '@/claw/api/skill'
import EmptyState from '@/components/EmptyState.vue'
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RefreshCw from '~icons/lucide/refresh-cw'
import ResourceSkillCard from './ResourceSkillCard.vue'
import ResourceSkillDetailModal from './ResourceSkillDetailModal.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const loading = ref(false)
const skills = ref<Skill[]>([])

const tagCount = computed(() => {
  const tags = new Set<string>()
  skills.value.forEach((s) => s.tags.forEach((t) => tags.add(t)))
  return tags.size
})
const detailVisible = ref(false)
const detailSkill = ref<SkillDetail | null>(null)

const loadSkills = async (showToast = false) => {
  loading.value = true
  try {
    skills.value = await listSkills()
    if (showToast) message.success(t('claw.resource.dataRefreshed'))
  } catch {
    message.error(t('claw.resource.loadSkillsFailed'))
  } finally {
    loading.value = false
  }
}

const viewSkill = async (name: string) => {
  try {
    detailSkill.value = await getSkill(name)
    detailVisible.value = true
  } catch {
    message.error(t('claw.resource.getSkillFailed'))
  }
}

const handleDelete = async (name: string) => {
  try {
    await deleteSkill(name)
    message.success(t('claw.resource.deleteSkillSuccess', { name }))
    await loadSkills()
  } catch {
    message.error(t('claw.resource.deleteSkillFailed'))
  }
}

onMounted(() => {
  loadSkills()
  testActionSet('list.refresh', () => loadSkills())
})
onUnmounted(() => {
  testActionUnset('list.refresh')
})
</script>
