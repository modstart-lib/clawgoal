<template>
  <a-modal
    width="95vw"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="
      editingItem
        ? t('claw.project.eventEditTitle')
        : t('claw.project.eventAddTitle')
    "
    :confirm-loading="saving"
    @ok="handleSave"
    @cancel="handleCancel"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-4 py-2">
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.eventTitle') }} <span class="text-red-500">*</span>
        </div>
        <a-input
          v-model:value="form.title"
          :placeholder="t('claw.project.eventTitlePlaceholder')"
          :maxlength="100"
        />
      </div>
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.eventDesc') }}
        </div>
        <MarkdownEditor
          v-model="form.description"
          :placeholder="t('claw.project.eventDescPlaceholder')"
        />
      </div>
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.eventTime') }}
        </div>
        <a-date-picker
          v-model:value="form.day"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          class="w-full"
          :placeholder="t('claw.project.eventTimePlaceholderSel')"
        />
      </div>
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.eventTypeLabel') }}
        </div>
        <a-auto-complete
          v-model:value="form.type"
          :options="typeOptions"
          :placeholder="t('claw.project.eventTypePlaceholder')"
          :filter-option="filterTypeOption"
          class="w-full"
          allow-clear
        />
      </div>
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.event.metaTitle') }}
        </div>
        <MetaEditor v-model="form.meta" />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import {
  addEvent,
  editEvent,
  type ProjectEvent,
  type ProjectItem,
} from '@/claw/api/project'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import MetaEditor from '@/components/MetaEditor.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  project: ProjectItem | null
  editingItem: ProjectEvent | null
  projectTypes?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'refresh'): void
}>()

const saving = ref(false)
const form = ref({
  title: '',
  description: '',
  day: null as string | null,
  type: undefined as string | undefined,
  meta: null as Record<string, unknown> | null,
})

const typeOptions = computed(() =>
  (props.projectTypes ?? []).map((t) => ({ value: t }))
)

const filterTypeOption = (input: string, option: { value: string }) =>
  option.value.toLowerCase().includes(input.toLowerCase())

watch(
  () => props.editingItem,
  (item) => {
    if (item) {
      form.value = {
        title: item.title,
        description: item.description || '',
        day: item.day || null,
        type: item.type || undefined,
        meta: item.meta ?? null,
      }
    } else {
      form.value = {
        title: '',
        description: '',
        day: null,
        type: undefined,
        meta: null,
      }
    }
  }
)

onMounted(() => {
  testActionSet('modal.fillTitle', (val: string) => {
    form.value.title = val
  })
  testActionSet('modal.submit', () => handleSave())
  testActionSet('modal.close', () => emit('update:open', false))
})
onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})

const handleCancel = () => {
  emit('update:open', false)
}

const handleSave = async () => {
  if (!form.value.title.trim()) {
    message.warning(t('claw.project.eventTitleRequired'))
    return
  }
  saving.value = true
  try {
    if (props.editingItem) {
      await editEvent(props.editingItem.id, {
        title: form.value.title,
        description: form.value.description,
        day: form.value.day || undefined,
        type: form.value.type || undefined,
        meta: form.value.meta ?? undefined,
      })
      message.success(t('claw.project.eventUpdated'))
    } else {
      await addEvent({
        projectId: props.project!.id,
        title: form.value.title,
        description: form.value.description,
        day: form.value.day || undefined,
        type: form.value.type || undefined,
        meta: form.value.meta ?? undefined,
      })
      message.success(t('claw.project.eventAdded'))
    }
    emit('update:open', false)
    emit('refresh')
  } catch {
    message.error(t('claw.project.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>
