<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="
      editingItem
        ? t('claw.project.noteEditTitle')
        : t('claw.project.noteAddTitle')
    "
    :confirm-loading="saving"
    width="95vw"
    @ok="handleSave"
    @cancel="handleCancel"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-4 py-2">
      <!-- 标题 -->
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.noteTitleLabel') }}
          <span class="text-red-500">*</span>
        </div>
        <a-input
          v-model:value="form.title"
          :placeholder="t('claw.project.noteTitlePlaceholder')"
          :maxlength="200"
        />
      </div>

      <!-- 类型 -->
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.noteTypeLabel') }}
        </div>
        <a-auto-complete
          v-model:value="form.type"
          :options="typeOptions"
          :placeholder="t('claw.project.noteTypePlaceholder')"
          :filter-option="filterTypeOption"
          class="w-full"
          allow-clear
        />
      </div>

      <!-- 内容 -->
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.noteContentLabel') }}
        </div>
        <MarkdownEditor
          v-model="form.content"
          :placeholder="t('claw.project.noteContentPlaceholder')"
        />
      </div>

      <!-- Meta (JSON) -->
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
import { addNote, editNote, type Note } from '@/claw/api/note'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import MetaEditor from '@/components/MetaEditor.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  projectId: number
  editingItem: Note | null
  projectTypes?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'refresh'): void
}>()

const saving = ref(false)
const form = ref({
  title: '',
  type: undefined as string | undefined,
  content: '',
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
        type: item.type || undefined,
        content: item.content || '',
        meta: item.meta ?? null,
      }
    } else {
      form.value = { title: '', type: undefined, content: '', meta: null }
    }
  },
  { immediate: true }
)

watch(
  () => props.open,
  (val) => {
    if (!val) {
      form.value = { title: '', type: undefined, content: '', meta: null }
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
    message.warning(t('claw.project.noteTitleRequired'))
    return
  }
  saving.value = true
  try {
    if (props.editingItem) {
      await editNote(props.editingItem.id, {
        title: form.value.title,
        type: form.value.type || undefined,
        content: form.value.content || undefined,
        meta: form.value.meta ?? undefined,
      })
      message.success(t('claw.project.noteUpdated'))
    } else {
      await addNote({
        projectId: props.projectId,
        title: form.value.title,
        type: form.value.type || undefined,
        content: form.value.content || undefined,
        meta: form.value.meta ?? undefined,
      })
      message.success(t('claw.project.noteAdded'))
    }
    emit('update:open', false)
    emit('refresh')
  } catch {
    message.error(t('claw.project.noteSaveFailed'))
  } finally {
    saving.value = false
  }
}
</script>
