<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="t('claw.objective.addKeyResult')"
    width="95vw"
    :footer="null"
    @cancel="$emit('update:open', false)"
  >
    <div class="py-2 space-y-4">
      <a-tabs v-model:active-key="createMode" class="!-mt-1">
        <!-- 智能创建 Tab -->
        <a-tab-pane key="smart">
          <template #tab>
            <span class="flex items-center gap-1">
              <Sparkles class="w-4 h-4" />
              {{ t('claw.objective.smartCreate') }}
            </span>
          </template>
          <div class="py-3">
            <template v-if="!batchGenerated">
              <AiGenerating v-if="generating" />
              <template v-else>
                <a-textarea
                  v-model:value="userPrompt"
                  :placeholder="t('claw.objective.krSmartPromptPlaceholder')"
                  :rows="3"
                  :maxlength="500"
                  class="mb-3"
                />
                <div class="py-2">
                  <a-button type="primary" block @click="handleBatchGenerate">
                    <div class="inline-flex items-center gap-1">
                      <Wand2 class="w-4 h-4" aria-hidden="true" />
                      {{ t('claw.objective.aiBatchGenerate') }}
                    </div>
                  </a-button>
                </div>
              </template>
            </template>
            <template v-else>
              <div class="space-y-3 mb-4">
                <div
                  v-for="(item, idx) in batchList"
                  :key="idx"
                  class="relative border border-gray-200 dark:border-gray-700 rounded-xl p-3 pt-7 space-y-2"
                >
                  <span
                    class="absolute top-2 left-3 text-xs font-medium text-gray-400"
                    >{{ idx + 1 }}</span
                  >
                  <div class="flex items-center gap-2">
                    <a-input
                      v-model:value="item.title"
                      :placeholder="t('claw.objective.krTitlePlaceholder')"
                      class="!rounded-lg flex-1"
                    />
                    <a-button
                      class="inline-flex items-center shrink-0"
                      danger
                      @click="batchList.splice(idx, 1)"
                    >
                      <Trash2 class="w-4 h-4" aria-hidden="true" />
                    </a-button>
                  </div>
                  <a-textarea
                    v-model:value="item.detail"
                    :auto-size="{ minRows: 2, maxRows: 4 }"
                    :placeholder="t('claw.objective.krDetailPlaceholder')"
                    class="!rounded-lg"
                  />
                  <div class="grid grid-cols-2 gap-2">
                    <a-date-picker
                      v-model:value="item.dueAt"
                      class="!w-full"
                      :placeholder="t('claw.objective.dueDatePlaceholder')"
                      value-format="YYYY-MM-DD"
                    />
                    <a-input-number
                      v-model:value="item.estimatedHours"
                      class="!w-full"
                      :min="0.5"
                      :step="0.5"
                      :placeholder="
                        t('claw.objective.estimatedHoursPlaceholder')
                      "
                    />
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <a-button @click="batchGenerated = false">{{
                  t('claw.objective.regenerate')
                }}</a-button>
                <a-button
                  type="primary"
                  :loading="saving"
                  :disabled="batchList.length === 0"
                  @click="handleBatchSave"
                >
                  <div class="inline-flex items-center gap-1">
                    <Plus class="w-4 h-4" aria-hidden="true" />
                    {{ t('claw.objective.batchAdd') }}
                  </div>
                </a-button>
              </div>
            </template>
          </div>
        </a-tab-pane>

        <!-- 手动创建 Tab -->
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
                >{{ t('claw.objective.krTitleLabel') }}
                <span class="text-red-500">*</span></label
              >
              <a-input
                v-model:value="form.title"
                :placeholder="t('claw.objective.krTitleFullPlaceholder')"
                class="!rounded-xl"
              />
            </div>
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >{{ t('claw.objective.krDetailLabel') }}</label
              >
              <a-textarea
                v-model:value="form.detail"
                :placeholder="t('claw.objective.krDetailFullPlaceholder')"
                :auto-size="{ minRows: 3, maxRows: 6 }"
                class="!rounded-xl"
              />
            </div>
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >{{ t('claw.objective.initialStatusLabel') }}</label
              >
              <a-select v-model:value="form.status" class="w-full">
                <a-select-option value="running">{{
                  t('claw.objective.statusRunning')
                }}</a-select-option>
                <a-select-option value="done">{{
                  t('claw.objective.statusDone')
                }}</a-select-option>
                <a-select-option value="canceled">{{
                  t('claw.objective.statusCanceled')
                }}</a-select-option>
              </a-select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >{{ t('claw.objective.dueDateLabel') }}</label
                >
                <a-date-picker
                  v-model:value="form.dueAt"
                  class="!w-full"
                  :placeholder="t('claw.objective.dueDateSelectPlaceholder')"
                  value-format="YYYY-MM-DD"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >{{ t('claw.objective.estimatedHoursLabel') }}</label
                >
                <a-input-number
                  v-model:value="form.estimatedHours"
                  class="!w-full"
                  :min="0.5"
                  :step="0.5"
                  :placeholder="t('claw.objective.estimatedHoursPlaceholder')"
                />
              </div>
            </div>
            <div class="flex justify-end">
              <a-button type="primary" :loading="saving" @click="handleSave">
                <div class="inline-flex items-center gap-1">
                  <Plus class="w-4 h-4" aria-hidden="true" />
                  {{ t('common.add') }}
                </div>
              </a-button>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import AiGenerating from '@/components/AiGenerating.vue'
import { addKeyResult, batchGenerateKeyResults } from '@/claw/api/objective'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { testActionSet, testActionUnset } from '@/utils/test'
import PenLine from '~icons/lucide/pen-line'
import Plus from '~icons/lucide/plus'
import Sparkles from '~icons/lucide/sparkles'
import Trash2 from '~icons/lucide/trash-2'
import Wand2 from '~icons/lucide/wand-2'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  objectiveId: number
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'refresh'): void
}>()

const createMode = ref<'smart' | 'manual'>('smart')
const batchGenerated = ref(false)
const generating = ref(false)
const userPrompt = ref('')
const batchList = ref<
  {
    title: string
    detail: string
    dueAt: string | null
    estimatedHours: number | null
  }[]
>([])

const defaultForm = () => ({
  title: '',
  detail: '',
  status: 'running',
  dueAt: null as string | null,
  estimatedHours: null as number | null,
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
      batchGenerated.value = false
      batchList.value = []
      userPrompt.value = ''
    }
  }
)

async function handleBatchGenerate() {
  generating.value = true
  try {
    const results = await batchGenerateKeyResults({
      objectiveId: props.objectiveId,
      userPrompt: userPrompt.value || undefined,
    })
    batchList.value = results.map((r) => ({
      title: r.title,
      detail: r.detail,
      dueAt: r.dueAt || null,
      estimatedHours: r.estimatedHours || null,
    }))
    batchGenerated.value = true
  } catch (e: any) {
    message.error(e.message || t('claw.objective.genFailed'))
  } finally {
    generating.value = false
  }
}

async function handleBatchSave() {
  const valid = batchList.value.filter((item) => item.title.trim())
  if (valid.length === 0) {
    message.warning(t('claw.objective.batchMinOne'))
    return
  }
  saving.value = true
  try {
    for (const item of valid) {
      await addKeyResult({
        objectiveId: props.objectiveId,
        title: item.title.trim(),
        detail: item.detail?.trim() || undefined,
        status: 'running',
        dueAt: item.dueAt || undefined,
        estimatedHours: item.estimatedHours ?? undefined,
      })
    }
    message.success(
      t('claw.objective.batchAddSuccess', { count: valid.length })
    )
    emit('refresh')
    emit('update:open', false)
  } catch (e: any) {
    message.error(e.message || t('claw.objective.batchAddFailed'))
  } finally {
    saving.value = false
  }
}

const handleSave = async () => {
  if (!form.title.trim()) {
    message.warning(t('claw.objective.krTitleRequired'))
    return
  }
  saving.value = true
  try {
    await addKeyResult({
      objectiveId: props.objectiveId,
      title: form.title.trim(),
      detail: form.detail.trim() || undefined,
      status: form.status,
      dueAt: form.dueAt || undefined,
      estimatedHours: form.estimatedHours ?? undefined,
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
