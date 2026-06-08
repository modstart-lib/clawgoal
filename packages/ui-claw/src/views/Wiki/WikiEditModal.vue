<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="
      editingItem
        ? t('claw.project.wikiEditTitle')
        : t('claw.project.wikiAddTitle')
    "
    :confirm-loading="saving"
    width="95vw"
    @ok="handleSave"
    @cancel="handleCancel"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-4 py-2">
      <!-- 类型 -->
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.wikiTypeLabel') }}
        </div>
        <a-radio-group v-model:value="form.type" button-style="solid">
          <a-radio-button value="manual">{{
            t('claw.project.wikiTypeManual')
          }}</a-radio-button>
          <a-radio-button value="syncUrl">{{
            t('claw.project.wikiTypeSyncUrl')
          }}</a-radio-button>
          <a-radio-button value="syncPath">{{
            t('claw.project.wikiTypeSyncPath')
          }}</a-radio-button>
        </a-radio-group>
      </div>

      <!-- syncUrl 类型字段（排在标题、内容前面） -->
      <template v-if="form.type === 'syncUrl'">
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {{ t('claw.project.wikiSyncUrlLabel') }}
            <span class="text-red-500">*</span>
          </div>
          <a-input
            v-model:value="form.syncUrl"
            :placeholder="t('claw.project.wikiSyncUrlPlaceholder')"
            allow-clear
            @change="onSyncUrlChange"
          />
        </div>
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {{ t('claw.project.wikiSyncIntervalLabel') }}
          </div>
          <a-input-number
            v-model:value="form.syncInterval"
            :min="1"
            :max="365"
            :addon-after="t('claw.project.wikiSyncIntervalUnit')"
            class="w-48"
          />
        </div>
      </template>

      <!-- syncPath 类型字段 -->
      <template v-if="form.type === 'syncPath'">
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {{ t('claw.project.wikiSyncPathLabel') }}
            <span class="text-red-500">*</span>
          </div>
          <div class="flex gap-2">
            <a-input
              v-model:value="form.syncPath"
              :placeholder="t('claw.project.wikiSyncPathPlaceholder')"
              allow-clear
              class="flex-1"
            />
            <SystemDirSelectorButton @select="(p) => (form.syncPath = p)" />
          </div>
        </div>
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {{ t('claw.project.wikiSyncIntervalLabel') }}
          </div>
          <a-input-number
            v-model:value="form.syncInterval"
            :min="1"
            :max="365"
            :addon-after="t('claw.project.wikiSyncIntervalUnit')"
            class="w-48"
          />
        </div>
      </template>

      <!-- 标题 -->
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.wikiTitleLabel') }}
          <span
            v-if="form.type !== 'syncUrl' && form.type !== 'syncPath'"
            class="text-red-500"
            >*</span
          >
        </div>
        <a-input
          v-model:value="form.title"
          :placeholder="t('claw.project.wikiTitlePlaceholder')"
          :maxlength="200"
        />
      </div>

      <!-- 内容 -->
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.wikiContentLabel') }}
        </div>
        <MarkdownEditor
          v-model="form.content"
          :placeholder="t('claw.project.wikiContentPlaceholder')"
        />
      </div>

      <!-- 来源链接（排在最下面） -->
      <div>
        <div
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.wikiSourceUrlLabel') }}
        </div>
        <a-input
          v-model:value="form.sourceUrl"
          :placeholder="t('claw.project.wikiSourceUrlPlaceholder')"
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
import { addWiki, editWiki, type Wiki, type WikiType } from '@/claw/api/wiki'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import MetaEditor from '@/components/MetaEditor.vue'
import SystemDirSelectorButton from '@/components/SystemDirSelectorButton.vue'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  projectId: number
  editingItem: Wiki | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'refresh'): void
}>()

const saving = ref(false)
const form = ref({
  type: 'manual' as WikiType,
  title: '',
  content: '',
  sourceUrl: '',
  syncUrl: '',
  syncPath: '',
  syncInterval: 1,
  meta: null as Record<string, unknown> | null,
})

const resetForm = () => {
  form.value = {
    type: 'manual',
    title: '',
    content: '',
    sourceUrl: '',
    syncUrl: '',
    syncPath: '',
    syncInterval: 1,
    meta: null,
  }
}

watch(
  () => props.editingItem,
  (item) => {
    if (item) {
      form.value = {
        type: item.type || 'manual',
        title: item.title,
        content: item.content || '',
        sourceUrl: item.sourceUrl || '',
        syncUrl: item.syncUrl || '',
        syncPath: item.syncPath || '',
        syncInterval: item.syncInterval ?? 1,
        meta: item.meta ?? null,
      }
    } else {
      resetForm()
    }
  },
  { immediate: true }
)

watch(
  () => props.open,
  (val) => {
    if (!val) resetForm()
  }
)

const handleCancel = () => {
  emit('update:open', false)
}

function onSyncUrlChange() {
  // sync 模式下，来源链接自动跟随同步 URL（仅在来源链接为空或等于上一个 syncUrl 时才自动填充）
  form.value.sourceUrl = form.value.syncUrl
}

const handleSave = async () => {
  if (
    form.value.type !== 'syncUrl' &&
    form.value.type !== 'syncPath' &&
    !form.value.title.trim()
  ) {
    message.warning(t('claw.project.wikiTitleRequired'))
    return
  }
  if (form.value.type === 'syncUrl' && !form.value.syncUrl.trim()) {
    message.warning(t('claw.project.wikiSyncUrlRequired'))
    return
  }
  if (form.value.type === 'syncPath' && !form.value.syncPath.trim()) {
    message.warning(t('claw.project.wikiSyncPathRequired'))
    return
  }
  saving.value = true
  try {
    const payload = {
      title: form.value.title || form.value.syncUrl || form.value.syncPath,
      content: form.value.content || undefined,
      sourceUrl: form.value.sourceUrl || undefined,
      meta: form.value.meta ?? undefined,
      type: form.value.type,
      syncUrl:
        form.value.type === 'syncUrl'
          ? form.value.syncUrl || undefined
          : undefined,
      syncPath:
        form.value.type === 'syncPath'
          ? form.value.syncPath || undefined
          : undefined,
      syncInterval:
        form.value.type === 'syncUrl' || form.value.type === 'syncPath'
          ? form.value.syncInterval
          : undefined,
    }
    if (props.editingItem) {
      await editWiki(props.editingItem.id, payload)
      message.success(t('claw.project.wikiUpdated'))
    } else {
      await addWiki({ projectId: props.projectId, ...payload })
      message.success(t('claw.project.wikiAdded'))
    }
    emit('update:open', false)
    emit('refresh')
  } catch {
    message.error(t('claw.project.wikiSaveFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  testActionSet('modal.fillTitle', (title: string) => {
    form.value.title = title
  })
  testActionSet('modal.submit', () => handleSave())
  testActionSet('modal.close', () => emit('update:open', false))
})

onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})
</script>
