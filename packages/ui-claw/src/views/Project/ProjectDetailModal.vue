<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    width="95vw"
    :footer="null"
    @cancel="$emit('update:open', false)"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <img
          :src="project?.logo || mockAvatarPrefix + project?.id"
          class="w-5 h-5 rounded object-cover shrink-0"
          alt="logo"
        />
        <span
          class="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-xs"
          >{{ project?.title }}</span
        >
        <span
          class="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
          :class="statusBadge"
        >
          {{ statusLabel }}
        </span>
      </div>
    </template>

    <div v-if="project" class="space-y-5">
      <!-- 描述 -->
      <p
        v-if="project.description"
        class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed"
      >
        {{ project.description }}
      </p>

      <!-- 基本信息行 -->
      <div
        class="flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500"
      >
        <span v-if="project.startAt" class="flex items-center gap-1">
          <CalendarDays class="w-3.5 h-3.5" />
          {{ t('claw.project.start')
          }}<DatetimeViewer :value="project.startAt" format="date" />
        </span>
        <span v-if="project.dueAt" class="flex items-center gap-1">
          <CalendarClock class="w-3.5 h-3.5" />
          {{ t('claw.project.due')
          }}<DatetimeViewer :value="project.dueAt" format="date" />
        </span>
        <span class="flex items-center gap-1">
          <Clock class="w-3.5 h-3.5" />
          {{ t('claw.project.created')
          }}<DatetimeViewer :value="project.createdAt" format="date" />
        </span>
      </div>

      <!-- 里程碑计数 -->
      <div
        class="bg-gray-50 dark:bg-gray-700/40 rounded-xl px-4 py-3 flex items-center gap-2"
      >
        <Milestone class="w-4 h-4 text-gray-500" />
        <span class="text-sm text-gray-600 dark:text-gray-300">{{
          t('claw.project.eventTotal', { total: totalCount })
        }}</span>
      </div>

      <!-- 里程碑列表 -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h4
            class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5"
          >
            <Flag class="w-4 h-4 text-gray-500" />
            {{ t('claw.project.eventSectionTitle') }}
          </h4>
          <a-button
            type="text"
            class="!text-primary-500 !px-2"
            @click="showAddEvent = true"
          >
            <div class="inline-flex items-center gap-1">
              <Plus class="w-3 h-3" />
              {{ t('common.add') }}
            </div>
          </a-button>
        </div>

        <!-- 快速添加里程碑 -->
        <div
          v-if="showAddEvent"
          class="mb-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2"
        >
          <a-input
            v-model:value="newEvent.title"
            :placeholder="t('claw.project.eventPlaceholder')"
            class="!rounded-lg"
            :bordered="false"
            @press-enter="addEvent"
          />
          <div class="flex items-center gap-2">
            <a-date-picker
              v-model:value="newEvent.day"
              :placeholder="t('claw.project.eventTimePlaceholder')"
              class="!rounded-lg flex-1"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
            <a-button type="primary" :loading="addingEvent" @click="addEvent">{{
              t('common.confirm')
            }}</a-button>
            <a-button type="default" @click="cancelAdd">{{
              t('common.cancel')
            }}</a-button>
          </div>
        </div>

        <!-- 里程碑为空 -->
        <div
          v-if="!project.events?.length && !showAddEvent"
          class="py-6 text-center text-sm text-gray-400 dark:text-gray-500"
        >
          {{ t('claw.project.eventEmpty') }}
        </div>

        <!-- 里程碑列表 -->
        <div class="space-y-2">
          <div
            v-for="ms in project.events"
            :key="ms.id"
            class="relative flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 transition-all group"
          >
            <!-- 内容 -->
            <div class="flex-1 min-w-0">
              <!-- 编辑模式 -->
              <div v-if="editingId === ms.id" class="space-y-2">
                <a-input
                  v-model:value="editForm.title"
                  :placeholder="t('claw.project.eventNamePlaceholder')"
                  class="!rounded-lg"
                />
                <div class="flex items-center gap-2">
                  <a-date-picker
                    v-model:value="editForm.day"
                    :placeholder="t('claw.project.eventTimeEditPlaceholder')"
                    class="!rounded-lg flex-1"
                    format="YYYY-MM-DD"
                    value-format="YYYY-MM-DD"
                  />
                  <a-button
                    type="primary"
                    :loading="savingEdit"
                    @click="saveEdit(ms.id)"
                    >{{ t('common.save') }}</a-button
                  >
                  <a-button type="default" @click="editingId = null">{{
                    t('common.cancel')
                  }}</a-button>
                </div>
              </div>
              <!-- 查看模式 -->
              <div v-else>
                <p class="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {{ ms.title }}
                </p>
                <div
                  v-if="ms.day"
                  class="flex items-center gap-1 mt-0.5 text-xs text-gray-400 dark:text-gray-500"
                >
                  <CalendarDays class="w-3 h-3" />
                  {{ ms.day }}
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <a-dropdown
              v-if="editingId !== ms.id"
              :trigger="['hover']"
              placement="bottomRight"
            >
              <a-button
                type="text"
                class="absolute! bottom-2! right-2! p-1! flex items-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                @click.stop
              >
                <MoreHorizontal
                  class="w-4 h-4 text-gray-500"
                  aria-hidden="true"
                />
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="startEdit(ms)">
                    <div class="flex items-center gap-2">
                      <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                      {{ t('common.edit') }}
                    </div>
                  </a-menu-item>
                  <a-menu-item
                    class="!text-red-500"
                    @click="confirmDeleteEvent(ms.id)"
                  >
                    <div class="flex items-center gap-2">
                      <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                      {{ t('common.delete') }}
                    </div>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </div>
      </div>

      <!-- 底部操作 -->
      <div
        class="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700"
      >
        <a-popconfirm
          :title="t('claw.project.deleteProjectConfirm')"
          :ok-text="t('common.delete')"
          :cancel-text="t('common.cancel')"
          ok-type="danger"
          @confirm="handleDelete"
        >
          <a-button danger type="text" :loading="deleting">
            <div class="inline-flex items-center gap-1">
              <Trash2 class="w-4 h-4" aria-hidden="true" />
              {{ t('claw.project.deleteProject') }}
            </div>
          </a-button>
        </a-popconfirm>
        <a-button type="primary" @click="$emit('edit', project)">
          <div class="inline-flex items-center gap-1">
            <Pencil class="w-4 h-4" aria-hidden="true" />
            {{ t('claw.project.editInfo') }}
          </div>
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { resolveApiPath } from '@/api/base'
import {
  addEvent as apiAddEvent,
  deleteEvent as apiDeleteEvent,
  editEvent,
  type ProjectEvent,
} from '@/claw/api/event'
import { deleteProject, type ProjectItem } from '@/claw/api/project'
import { PROJECT_STATUS_BADGE } from '@/claw/views/Project/constant'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import CalendarClock from '~icons/lucide/calendar-clock'
import CalendarDays from '~icons/lucide/calendar-days'
import Clock from '~icons/lucide/clock'
import Flag from '~icons/lucide/flag'
import Milestone from '~icons/lucide/milestone'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'

const { t } = useI18n()

function confirmDeleteEvent(id: number) {
  Modal.confirm({
    title: t('claw.project.deleteConfirm'),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: () => deleteEvent(id),
  })
}
const mockAvatarPrefix = resolveApiPath('/mock/randomAvatar?seed=')

const props = defineProps<{
  open: boolean
  project: ProjectItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'refresh'): void
  (e: 'edit', p: ProjectItem): void
}>()

const totalCount = computed(() => props.project?.events?.length || 0)

const statusBadge = computed(
  () =>
    PROJECT_STATUS_BADGE[props.project?.status || ''] ||
    PROJECT_STATUS_BADGE.planning
)
const statusLabelMap: Record<string, string> = {
  planning: t('claw.project.statusPlanning'),
  active: t('claw.project.statusActive'),
  paused: t('claw.project.statusPaused'),
  done: t('claw.project.statusDone'),
}
const statusLabel = computed(
  () => statusLabelMap[props.project?.status || ''] || statusLabelMap.planning
)

// ─── 里程碑操作 ───────────────────────────────────────────────────────────────

const showAddEvent = ref(false)
const addingEvent = ref(false)
const newEvent = reactive({ title: '', day: null as any })

const cancelAdd = () => {
  showAddEvent.value = false
  newEvent.title = ''
  newEvent.day = null
}

const addEvent = async () => {
  if (!newEvent.title.trim() || !props.project) return
  addingEvent.value = true
  try {
    await apiAddEvent({
      projectId: props.project.id,
      title: newEvent.title.trim(),
      day: newEvent.day ? dayjs(newEvent.day).format('YYYY-MM-DD') : undefined,
    })
    cancelAdd()
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.project.addFailed'))
  } finally {
    addingEvent.value = false
  }
}

const deleteEvent = async (id: number) => {
  try {
    await apiDeleteEvent(id)
    message.success(t('claw.project.eventDeleted'))
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.project.deleteFailed'))
  }
}

// ─── 编辑里程碑 ───────────────────────────────────────────────────────────────

const editingId = ref<number | null>(null)
const editForm = reactive({ title: '', day: null as any })
const savingEdit = ref(false)

const startEdit = (ms: ProjectEvent) => {
  editingId.value = ms.id
  editForm.title = ms.title
  editForm.day = ms.day ? dayjs(ms.day) : null
}

const saveEdit = async (id: number) => {
  if (!editForm.title.trim()) return
  savingEdit.value = true
  try {
    await editEvent(id, {
      title: editForm.title.trim(),
      day: editForm.day ? dayjs(editForm.day).format('YYYY-MM-DD') : undefined,
    })
    editingId.value = null
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.project.saveFailed'))
  } finally {
    savingEdit.value = false
  }
}

// ─── 删除项目 ─────────────────────────────────────────────────────────────────

const deleting = ref(false)

const handleDelete = async () => {
  if (!props.project) return
  deleting.value = true
  try {
    await deleteProject(props.project.id)
    message.success(t('claw.project.deleteSuccess'))
    emit('update:open', false)
    emit('refresh')
  } catch (e: any) {
    message.error(e.message || t('claw.project.deleteFailed'))
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  testActionSet('modal.addEvent', () => {
    showAddEvent.value = true
  })
  testActionSet('modal.close', () => emit('update:open', false))
})
onUnmounted(() => {
  testActionUnset('modal.addEvent')
  testActionUnset('modal.close')
})
</script>
