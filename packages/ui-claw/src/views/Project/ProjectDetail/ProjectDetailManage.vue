<template>
  <div class="py-6 px-1">
    <!-- 概况 -->
    <div class="mb-10">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {{ t('claw.project.tabSummary') }}
      </h3>
      <div
        class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-600 max-h-[40vh] overflow-y-auto"
      >
        <LoadingState :loading="summaryLoading">
          <MarkdownViewer
            v-if="summary"
            :content="summary"
            text-size="xs"
            :switch-code="true"
          />
          <div v-else class="text-sm text-gray-400">
            {{ t('claw.project.summaryEmpty') }}
          </div>
        </LoadingState>
      </div>
    </div>

    <!-- 管理 -->
    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
      {{ t('claw.project.manageTitle') }}
    </h3>
    <div class="max-w-lg space-y-4">
      <!-- 项目 ID -->
      <div
        class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-600 flex items-center justify-between"
      >
        <div>
          <div class="font-medium text-gray-900 dark:text-gray-100">
            {{ t('claw.project.projectIdLabel') }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ t('claw.project.projectIdDesc') }}
          </div>
        </div>
        <span
          class="text-sm font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 px-3 py-1 rounded-lg"
          >#{{ project?.id }}</span
        >
      </div>

      <!-- 编辑项目 -->
      <div
        class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-600 flex items-center justify-between"
      >
        <div>
          <div class="font-medium text-gray-900 dark:text-gray-100">
            {{ t('claw.project.editCard') }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ t('claw.project.editCardDesc') }}
          </div>
        </div>
        <a-button type="default" @click="showEditModal = true">
          <div class="inline-flex items-center gap-1.5">
            <Pencil class="w-4 h-4" aria-hidden="true" />
            {{ t('claw.project.edit') }}
          </div>
        </a-button>
      </div>

      <!-- 修改状态 -->
      <div
        class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-600 flex items-center justify-between"
      >
        <div>
          <div class="font-medium text-gray-900 dark:text-gray-100">
            {{ t('claw.project.statusCard') }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ t('claw.project.currentStatus') }}
            <span class="font-medium" :class="statusColor">{{
              statusLabel
            }}</span>
          </div>
        </div>
        <a-select
          v-model:value="currentStatus"
          class="w-28"
          @change="handleStatusChange"
        >
          <a-select-option value="planning">{{
            t('claw.project.statusPlanning')
          }}</a-select-option>
          <a-select-option value="active">{{
            t('claw.project.statusActive')
          }}</a-select-option>
          <a-select-option value="paused">{{
            t('claw.project.statusPaused')
          }}</a-select-option>
          <a-select-option value="done">{{
            t('claw.project.statusDone')
          }}</a-select-option>
        </a-select>
      </div>

      <!-- 删除项目 -->
      <div
        class="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-800/30 flex items-center justify-between"
      >
        <div>
          <div class="font-medium text-red-700 dark:text-red-400">
            {{ t('claw.project.deleteCard') }}
          </div>
          <div class="text-xs text-red-500 dark:text-red-400/70 mt-0.5">
            {{ t('claw.project.deleteCardDesc') }}
          </div>
        </div>
        <a-popconfirm
          :title="t('claw.project.deleteConfirmTitle')"
          :ok-text="t('claw.project.deleteConfirmOk')"
          ok-type="danger"
          :cancel-text="t('common.cancel')"
          @confirm="handleDelete"
        >
          <a-button danger type="primary" :loading="deleteLoading">
            <div class="inline-flex items-center gap-1.5">
              <Trash2 class="w-4 h-4" />
              {{ t('claw.project.delete') }}
            </div>
          </a-button>
        </a-popconfirm>
      </div>
    </div>

    <!-- 编辑项目 Modal -->
    <a-modal
      v-model:open="showEditModal"
      width="min(600px, 90vw)"
      :keyboard="false"
      :mask-closable="false"
      :title="t('claw.project.editModalTitle')"
      :confirm-loading="saving"
      :ok-text="t('claw.project.save')"
      :cancel-text="t('claw.project.cancel')"
      @ok="handleSave"
      @cancel="showEditModal = false"
    >
      <div class="space-y-4 py-2">
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {{ t('claw.project.editNameLabel') }}
            <span class="text-red-500">*</span>
          </div>
          <a-input
            v-model:value="editForm.title"
            :placeholder="t('claw.project.editNamePlaceholder')"
            :maxlength="100"
          />
        </div>
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {{ t('claw.project.editDescLabel') }}
          </div>
          <a-textarea
            v-model:value="editForm.description"
            :placeholder="t('claw.project.editDescPlaceholder')"
            :rows="3"
            :maxlength="500"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div
              class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              {{ t('claw.project.editStartLabel') }}
            </div>
            <a-date-picker
              v-model:value="editForm.startAt"
              value-format="YYYY-MM-DD"
              class="w-full"
              :placeholder="t('claw.project.editStartPlaceholder')"
            />
          </div>
          <div>
            <div
              class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              {{ t('claw.project.editDueLabel') }}
            </div>
            <a-date-picker
              v-model:value="editForm.dueAt"
              value-format="YYYY-MM-DD"
              class="w-full"
              :placeholder="t('claw.project.editDuePlaceholder')"
            />
          </div>
        </div>
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {{ t('claw.project.editColorLabel') }}
          </div>
          <ColorSelector v-model="editForm.color" :show-custom="true" />
        </div>
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {{ t('claw.project.editLogoLabel') }}
          </div>
          <ImageCoverSelector v-model="editForm.logo" build-in-type="cover" />
        </div>
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {{ t('claw.event.metaTitle') }}
          </div>
          <MetaEditor v-model="editForm.meta" />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import {
  deleteProject,
  editProject,
  getProjectSummaryMarkdown,
  type ProjectItem,
} from '@/claw/api/project'
import { PROJECT_STATUS_COLOR } from '@/claw/views/Project/constant'
import ColorSelector from '@/components/ColorSelector.vue'
import ImageCoverSelector from '@/components/ImageCoverSelector.vue'
import MetaEditor from '@/components/MetaEditor.vue'
import LoadingState from '@/components/LoadingState.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { message } from 'ant-design-vue'
import Pencil from '~icons/lucide/pencil'
import Trash2 from '~icons/lucide/trash-2'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  project: ProjectItem | null
  summaryKey?: number
}>()
const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'refresh'): void
}>()

const summaryLoading = ref(false)
const summary = ref('')

async function loadSummary() {
  if (!props.project?.id) return
  summaryLoading.value = true
  try {
    summary.value = await getProjectSummaryMarkdown(props.project.id)
  } finally {
    summaryLoading.value = false
  }
}

watch(
  () => props.project?.id,
  (id) => {
    if (id) loadSummary()
  },
  { immediate: true }
)

watch(
  () => props.summaryKey,
  (key, oldKey) => {
    if (key !== undefined && oldKey !== undefined && key !== oldKey) {
      loadSummary()
    }
  }
)

const currentStatus = ref(props.project?.status || 'planning')
const deleteLoading = ref(false)
const saving = ref(false)
const showEditModal = ref(false)

const editForm = ref({
  title: '',
  description: '',
  startAt: null as string | null,
  dueAt: null as string | null,
  color: '#6366f1',
  logo: '',
  meta: null as Record<string, unknown> | null,
})

watch(
  () => props.project,
  (p) => {
    if (p) {
      currentStatus.value = p.status
      editForm.value = {
        title: p.title,
        description: p.description || '',
        startAt: p.startAt || null,
        dueAt: p.dueAt || null,
        color: p.color || '#6366f1',
        logo: p.logo || '',
        meta: p.meta ?? null,
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  testActionSet('manage.openEdit', () => {
    showEditModal.value = true
  })
  testActionSet('manage.refreshSummary', () => loadSummary())
})
onUnmounted(() => {
  testActionUnset('manage.openEdit')
  testActionUnset('manage.refreshSummary')
})

const statusLabelMap: Record<string, string> = {
  planning: t('claw.project.statusPlanning'),
  active: t('claw.project.statusActive'),
  paused: t('claw.project.statusPaused'),
  done: t('claw.project.statusDone'),
}
const statusLabel = computed(() => statusLabelMap[currentStatus.value] || '-')
const statusColor = computed(() => PROJECT_STATUS_COLOR[currentStatus.value])

const handleStatusChange = async (val: string) => {
  if (!props.project) return
  try {
    await editProject(props.project.id, { status: val })
    message.success(t('claw.project.statusUpdated'))
    emit('refresh')
  } catch {
    message.error(t('claw.project.updateFailed'))
    currentStatus.value = props.project.status
  }
}

const handleDelete = async () => {
  if (!props.project) return
  deleteLoading.value = true
  try {
    await deleteProject(props.project.id)
    emit('delete')
  } catch {
    message.error(t('claw.project.deleteFailed'))
  } finally {
    deleteLoading.value = false
  }
}

const handleSave = async () => {
  if (!editForm.value.title.trim()) {
    message.warning(t('claw.project.editNameRequired'))
    return
  }
  if (!props.project) return
  saving.value = true
  try {
    await editProject(props.project.id, {
      title: editForm.value.title,
      description: editForm.value.description,
      startAt: editForm.value.startAt || undefined,
      dueAt: editForm.value.dueAt || undefined,
      color: editForm.value.color,
      logo: editForm.value.logo || undefined,
      meta: editForm.value.meta ?? undefined,
    })
    message.success(t('claw.project.saved'))
    showEditModal.value = false
    emit('refresh')
  } catch {
    message.error(t('claw.project.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>
