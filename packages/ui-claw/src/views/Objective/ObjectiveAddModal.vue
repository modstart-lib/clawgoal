<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('claw.objective.addTitle')"
    width="min(600px, 90vw)"
    :confirm-loading="saving"
    @cancel="$emit('update:open', false)"
    @ok="handleSave"
  >
    <div class="py-2 space-y-4">
      <!-- 创建方式 TAB -->
      <a-tabs v-model:active-key="createMode" class="!-mt-1">
        <a-tab-pane key="smart">
          <template #tab>
            <span class="flex items-center gap-1">
              <Sparkles class="w-4 h-4" />
              {{ t('claw.objective.smartCreate') }}
            </span>
          </template>
          <div class="py-3">
            <template v-if="!generated">
              <AiGenerating v-if="generating" />
              <template v-else>
                <a-textarea
                  v-model:value="userPrompt"
                  :placeholder="t('claw.objective.smartPromptPlaceholder')"
                  :rows="3"
                  :maxlength="500"
                  class="mb-3"
                />
                <div class="py-2">
                  <a-button type="primary" block @click="handleGenerate">
                    <div class="inline-flex items-center gap-1">
                      <Wand2 class="w-4 h-4" aria-hidden="true" />
                      {{ t('claw.objective.aiGenerate') }}
                    </div>
                  </a-button>
                </div>
              </template>
            </template>
            <template v-else>
              <div class="space-y-4">
                <div>
                  <label
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                    >{{ $t('claw.objective.nameLabel') }}
                    <span class="text-red-500">*</span></label
                  >
                  <a-input v-model:value="form.title" class="!rounded-xl" />
                </div>
                <div>
                  <label
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                    >{{ $t('claw.objective.descriptionLabel') }}</label
                  >
                  <a-textarea
                    v-model:value="form.description"
                    :auto-size="{ minRows: 3, maxRows: 6 }"
                    class="!rounded-xl"
                  />
                </div>
                <div>
                  <label
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                    >{{ $t('claw.objective.iconStyle') }}</label
                  >
                  <IconSelector v-model="form.icon" />
                </div>
                <div>
                  <label
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                    >{{ t('claw.objective.statusLabel') }}</label
                  >
                  <a-select v-model:value="form.status" class="w-full">
                    <a-select-option value="pending">{{
                      t('claw.objective.statusPending')
                    }}</a-select-option>
                    <a-select-option value="active">{{
                      t('claw.objective.statusActive')
                    }}</a-select-option>
                    <a-select-option value="paused">{{
                      t('claw.objective.statusPaused')
                    }}</a-select-option>
                    <a-select-option value="completed">{{
                      t('claw.objective.statusCompleted')
                    }}</a-select-option>
                    <a-select-option value="failed">{{
                      t('claw.objective.statusFailed')
                    }}</a-select-option>
                  </a-select>
                </div>
                <div>
                  <label
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                    >{{ t('claw.objective.dueDateLabel') }}</label
                  >
                  <a-date-picker
                    v-model:value="form.dueAt"
                    class="!w-full"
                    :placeholder="t('claw.objective.dueDatePlaceholder')"
                    value-format="YYYY-MM-DD"
                  />
                </div>
                <div class="flex justify-end">
                  <a-button @click="generated = false">{{
                    t('claw.objective.regenerate')
                  }}</a-button>
                </div>
              </div>
            </template>
          </div>
        </a-tab-pane>

        <a-tab-pane key="manual">
          <template #tab>
            <span class="flex items-center gap-1">
              <PenLine class="w-4 h-4" />
              {{ t('claw.objective.manualCreate') }}
            </span>
          </template>
          <div class="py-3 space-y-4">
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >{{ $t('claw.objective.nameLabel') }}
                <span class="text-red-500">*</span></label
              >
              <a-input
                v-model:value="form.title"
                :placeholder="$t('claw.objective.namePlaceholder')"
                class="!rounded-xl"
              />
            </div>
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >{{ $t('claw.objective.descriptionLabel') }}</label
              >
              <a-textarea
                v-model:value="form.description"
                :placeholder="$t('claw.objective.descriptionPlaceholder')"
                :auto-size="{ minRows: 3, maxRows: 6 }"
                class="!rounded-xl"
              />
            </div>
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >{{ $t('claw.objective.iconStyle') }}</label
              >
              <IconSelector v-model="form.icon" />
            </div>
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >{{ t('claw.objective.statusLabel') }}</label
              >
              <a-select v-model:value="form.status" class="w-full">
                <a-select-option value="pending">{{
                  t('claw.objective.statusPending')
                }}</a-select-option>
                <a-select-option value="active">{{
                  t('claw.objective.statusActive')
                }}</a-select-option>
                <a-select-option value="paused">{{
                  t('claw.objective.statusPaused')
                }}</a-select-option>
                <a-select-option value="completed">{{
                  t('claw.objective.statusCompleted')
                }}</a-select-option>
                <a-select-option value="failed">{{
                  t('claw.objective.statusFailed')
                }}</a-select-option>
              </a-select>
            </div>
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >{{ t('claw.objective.dueDateLabel') }}</label
              >
              <a-date-picker
                v-model:value="form.dueAt"
                class="!w-full"
                :placeholder="t('claw.objective.dueDatePlaceholder')"
                value-format="YYYY-MM-DD"
              />
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import AiGenerating from '@/components/AiGenerating.vue'
import { addObjective, generateObjective } from '@/claw/api/objective'
import IconSelector from '@/components/IconSelector.vue'
import { getRandomIconName } from '@/components/icons/icons'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import PenLine from '~icons/lucide/pen-line'
import Sparkles from '~icons/lucide/sparkles'
import Wand2 from '~icons/lucide/wand-2'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  projectId: number
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'refresh'): void
}>()

const createMode = ref<'smart' | 'manual'>('smart')
const generated = ref(false)
const generating = ref(false)
const userPrompt = ref('')

const defaultForm = () => ({
  title: '',
  description: '',
  icon: 'Target' as string | null,
  status: 'active',
  dueAt: null as string | null,
})
const form = reactive(defaultForm())
const saving = ref(false)

onMounted(() => {
  testActionSet('modal.fillTitle', (val: string) => {
    form.title = val
  })
  testActionSet('modal.submit', () => handleSave())
  testActionSet('modal.close', () => emit('update:open', false))
})
onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})

watch(
  () => props.open,
  (val) => {
    if (val) {
      generated.value = false
      userPrompt.value = ''
    }
  }
)

async function handleGenerate() {
  generating.value = true
  try {
    const result = await generateObjective({
      projectId: props.projectId,
      userPrompt: userPrompt.value || undefined,
    })
    if (result) {
      form.title = result.title
      form.description = result.description
      form.icon = getRandomIconName()
      form.status = result.status
      form.dueAt = result.dueAt
      generated.value = true
    }
  } catch (e: any) {
    message.error(e.message || t('claw.objective.genFailed'))
  } finally {
    generating.value = false
  }
}

const handleSave = async () => {
  if (createMode.value === 'smart' && !generated.value) {
    message.warning(t('claw.objective.noGeneratedHint'))
    return
  }
  if (!form.title.trim()) {
    message.warning(t('claw.objective.namePlaceholder'))
    return
  }
  saving.value = true
  try {
    await addObjective({
      title: form.title.trim(),
      description: form.description || undefined,
      icon: form.icon ?? undefined,
      status: form.status,
      dueAt: form.dueAt || undefined,
      projectId: props.projectId,
    })
    emit('refresh')
    emit('update:open', false)
  } catch (e: any) {
    message.error(e.message || t('claw.objective.addFailed'))
  } finally {
    saving.value = false
  }
}
</script>
