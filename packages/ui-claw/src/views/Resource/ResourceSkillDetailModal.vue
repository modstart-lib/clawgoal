<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('claw.resource.skillDetailTitle', { name: skill?.name })"
    :footer="null"
    width="95vw"
    @cancel="emit('update:open', false)"
  >
    <div v-if="skill" class="space-y-3 py-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-500">{{
          $t('claw.resource.skillVersion')
        }}</span>
        <span class="text-sm font-mono">v{{ skill.version }}</span>
      </div>
      <div class="border-t border-gray-100 dark:border-gray-700 pt-3">
        <p class="text-sm text-gray-500 mb-1">
          {{ $t('claw.resource.skillDescription') }}
        </p>
        <p class="text-sm text-gray-700 dark:text-gray-300">
          {{ skill.description }}
        </p>
      </div>
      <div v-if="skill.tags.length" class="flex items-center justify-between">
        <span class="text-sm text-gray-500">{{
          $t('claw.resource.skillTags')
        }}</span>
        <div class="flex gap-1">
          <a-tag
            v-for="tag in skill.tags"
            :key="tag"
            color="arcoblue"
            class="text-xs"
            >{{ tag }}</a-tag
          >
        </div>
      </div>
      <div
        v-if="skill.requiredTools.length"
        class="flex items-start justify-between"
      >
        <span class="text-sm text-gray-500">{{
          $t('claw.resource.skillRequiredTools')
        }}</span>
        <div class="flex gap-1 flex-wrap justify-end">
          <a-tag
            v-for="tool in skill.requiredTools"
            :key="tool"
            class="text-xs"
            >{{ tool }}</a-tag
          >
        </div>
      </div>
      <div class="border-t border-gray-100 dark:border-gray-700 pt-3">
        <p class="text-sm text-gray-500 mb-2">
          {{ $t('claw.resource.skillPromptContext') }}
        </p>
        <div
          class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto"
        >
          {{ skill.promptContext || $t('claw.resource.skillNoPromptContext') }}
        </div>
      </div>
      <div class="border-t border-gray-100 dark:border-gray-700 pt-3">
        <p class="text-sm text-gray-500 mb-1">
          {{ $t('claw.resource.skillDir') }}
        </p>
        <p class="text-xs font-mono text-gray-400 dark:text-gray-500 break-all">
          {{ skill.skillDir }}
        </p>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { SkillDetail } from '@/claw/api/skill'
import { useI18n } from 'vue-i18n'

useI18n()

defineProps<{
  open: boolean
  skill: SkillDetail | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()
</script>
