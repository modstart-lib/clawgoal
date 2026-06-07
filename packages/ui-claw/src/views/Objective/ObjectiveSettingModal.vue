<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('claw.objective.settingTitle')"
    width="min(600px, 90vw)"
    :confirm-loading="saving"
    @cancel="$emit('update:open', false)"
    @ok="handleSave"
  >
    <div class="py-2 space-y-5">
      <!-- 说明 -->
      <div
        class="flex items-start gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
      >
        <Info class="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
        <p
          class="text-sm text-primary-700 dark:text-primary-400 leading-relaxed"
        >
          {{ $t('claw.objective.settingNote') }}
        </p>
      </div>

      <!-- 工作目标输入 -->
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {{ $t('claw.objective.goalPromptLabel') }}
        </label>
        <a-textarea
          v-model:value="form.goalPrompt"
          :placeholder="$t('claw.objective.goalPromptPlaceholder')"
          :auto-size="{ minRows: 4, maxRows: 8 }"
          class="!rounded-xl"
        />
        <div class="mt-2 flex items-center gap-2">
          <p class="flex-1 text-xs text-gray-400 dark:text-gray-500">
            {{ $t('claw.objective.goalPromptHint') }}
          </p>
          <TextTemplateSelector
            v-model:model-value="form.goalPrompt"
            :templates="goalTemplates"
          />
        </div>
      </div>

      <!-- 规划偏好 -->
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {{ $t('claw.objective.planningStyleLabel') }}
        </label>
        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="style in planningStyles"
            :key="style.value"
            class="flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all"
            :class="
              form.planningStyle === style.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
            "
            @click="form.planningStyle = style.value"
          >
            <component
              :is="style.icon"
              class="w-5 h-5"
              :class="
                form.planningStyle === style.value
                  ? 'text-primary-500'
                  : 'text-gray-400'
              "
            />
            <span
              class="text-xs font-medium"
              :class="
                form.planningStyle === style.value
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              "
            >
              {{ style.label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { getObjectiveSetting, saveObjectiveSetting } from '@/claw/api/objective'
import TextTemplateSelector from '@/claw/components/TextTemplateSelector.vue'
import Gauge from '~icons/lucide/gauge'
import Info from '~icons/lucide/info'
import Layers from '~icons/lucide/layers'
import Zap from '~icons/lucide/zap'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
}>()

const planningStyles = computed(() => [
  { value: 'balanced', label: t('claw.objective.styleBalanced'), icon: Layers },
  { value: 'aggressive', label: t('claw.objective.styleQuick'), icon: Zap },
  { value: 'steady', label: t('claw.objective.styleSteady'), icon: Gauge },
])

const goalTemplates = [
  {
    label: t('claw.objective.presetIndepDev'),
    text: t('claw.objective.presetIndepDevText'),
  },
  {
    label: t('claw.objective.presetPM'),
    text: t('claw.objective.presetPMText'),
  },
  {
    label: t('claw.objective.presetTechLead'),
    text: t('claw.objective.presetTechLeadText'),
  },
  {
    label: t('claw.objective.presetContentCreator'),
    text: t('claw.objective.presetContentCreatorText'),
  },
  {
    label: t('claw.objective.presetOpsLead'),
    text: t('claw.objective.presetOpsLeadText'),
  },
]

const form = reactive({ goalPrompt: '', planningStyle: 'balanced' })
const saving = ref(false)

watch(
  () => props.open,
  async (v) => {
    if (v) {
      try {
        const s = await getObjectiveSetting()
        form.goalPrompt = s.goal || ''
        form.planningStyle = s.style || 'balanced'
      } catch {
        /* ignore */
      }
    }
  }
)

const handleSave = async () => {
  saving.value = true
  try {
    await saveObjectiveSetting({
      goal: form.goalPrompt,
      style: form.planningStyle,
    })
    message.success(t('claw.objective.settingSaved'))
    emit('update:open', false)
  } catch (e: any) {
    message.error(e.message || t('common.saveFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  testActionSet('modal.submit', () => handleSave())
  testActionSet('modal.close', () => emit('update:open', false))
})

onUnmounted(() => {
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})
</script>
