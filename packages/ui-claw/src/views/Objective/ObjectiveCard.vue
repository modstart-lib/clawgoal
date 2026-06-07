<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 cursor-pointer group overflow-hidden"
    @click="$emit('click', objective)"
  >
    <!-- 顶部色块 -->
    <div class="h-2 w-full" :class="colorBar"></div>

    <div class="p-5">
      <!-- 标题行 -->
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <component
            :is="iconComp"
            class="w-5 h-5 shrink-0"
            :class="iconColor"
          />
          <h3
            class="font-semibold text-gray-900 dark:text-gray-100 text-base leading-tight truncate"
          >
            <TextHighlight :text="objective.title" :keyword="keyword" />
          </h3>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <span
            class="text-xs px-2 py-0.5 rounded-full font-medium"
            :class="statusBadge"
          >
            {{ statusLabel }}
          </span>
          <!-- 更多操作按钮（hover时显示） -->
          <a-dropdown :trigger="['hover']">
            <div
              class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              @click.stop
            >
              <MoreHorizontal
                class="w-4 h-4 text-gray-500"
                aria-hidden="true"
              />
            </div>
            <template #overlay>
              <a-menu>
                <a-menu-item @click.stop="showEdit = true">
                  <div class="flex items-center gap-2">
                    <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('common.edit') }}
                  </div>
                </a-menu-item>
                <a-menu-item class="!text-red-500" @click.stop="handleDelete">
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

      <!-- 描述 -->
      <p
        v-if="objective.description"
        class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2"
      >
        <TextHighlight :text="objective.description" :keyword="keyword" />
      </p>

      <!-- 时间信息 -->
      <div
        v-if="objective.startAt || objective.endAt"
        class="flex flex-wrap gap-3 text-xs text-gray-400 dark:text-gray-500 mb-4"
      >
        <span v-if="objective.startAt"
          >{{ t('claw.objective.startLabel')
          }}<DatetimeViewer :value="objective.startAt" format="date"
        /></span>
        <span v-if="objective.endAt"
          >{{ t('claw.objective.dueLabel')
          }}<DatetimeViewer :value="objective.endAt" format="date"
        /></span>
      </div>

      <!-- 底部信息 -->
      <div
        class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-3 border-t border-gray-50 dark:border-gray-700"
      >
        <span
          class="font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
          :title="t('common.copyId')"
          @click.stop="copyText(String(objective.id))"
          >#{{ objective.id }}</span
        >
        <div
          class="flex items-center gap-1 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
        >
          <span>{{ $t('claw.objective.viewDetail') }}</span>
          <ChevronRight class="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  </div>

  <ObjectiveEditModal
    v-model:open="showEdit"
    :objective="objective"
    @refresh="emit('refresh')"
  />
</template>

<script setup lang="ts">
import type { Objective } from '@/claw/api/objective'
import { deleteObjective } from '@/claw/api/objective'
import { OBJECTIVE_STATUS_BADGE, OBJECTIVE_STATUS_LABEL } from './constant'
import ObjectiveEditModal from './ObjectiveEditModal.vue'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import TextHighlight from '@/components/TextHighlight.vue'
import { getIconComponent } from '@/components/icons/icons'
import { copyText } from '@/utils/utils'
import { message, Modal } from 'ant-design-vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ChevronRight from '~icons/lucide/chevron-right'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Target from '~icons/lucide/target'
import Trash2 from '~icons/lucide/trash-2'

const { t } = useI18n()

const props = defineProps<{
  objective: Objective
  keyword?: string
}>()

const emit = defineEmits<{
  (e: 'click', obj: Objective): void
  (e: 'refresh'): void
}>()

const showEdit = ref(false)

const handleDelete = () => {
  Modal.confirm({
    title: t('common.deleteTitle'),
    content: t('claw.objective.deleteConfirm', {
      title: props.objective.title,
    }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await deleteObjective(props.objective.id)
      message.success(t('common.deleteSuccess'))
      emit('refresh')
    },
  })
}

const statusLabel = computed(
  () =>
    OBJECTIVE_STATUS_LABEL[props.objective.status] ||
    OBJECTIVE_STATUS_LABEL.active
)
const statusBadge = computed(
  () =>
    OBJECTIVE_STATUS_BADGE[props.objective.status] ||
    OBJECTIVE_STATUS_BADGE.active
)

const colorBar = computed(() => {
  const m: Record<string, string> = {
    pending: 'bg-gradient-to-r from-gray-300 to-gray-400',
    active: 'bg-gradient-to-r from-primary-500 to-primary-500',
    paused: 'bg-gradient-to-r from-amber-400 to-yellow-400',
    completed: 'bg-gradient-to-r from-green-400 to-teal-500',
    failed: 'bg-gradient-to-r from-red-400 to-orange-400',
  }
  return m[props.objective.status] || m.active
})

const iconComp = computed(() => {
  const icon = props.objective.icon
  if (!icon) return Target
  const name = icon.charAt(0).toUpperCase() + icon.slice(1)
  return getIconComponent(name) || Target
})

const iconColor = computed(() => {
  const m: Record<string, string> = {
    pending: 'text-gray-400',
    active: 'text-primary-500',
    paused: 'text-amber-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
  }
  return m[props.objective.status] || m.active
})
</script>
