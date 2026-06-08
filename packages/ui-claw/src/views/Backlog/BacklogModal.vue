<script setup lang="ts">
import type {
  BacklogPriority,
  BacklogStatus,
  BacklogItem,
} from '@/claw/api/backlog'
import { addBacklog, editBacklog } from '@/claw/api/backlog'
import { BACKLOG_PRIORITIES } from '@/claw/views/Project/constant'
import { message } from 'ant-design-vue'
import MetaEditor from '@/components/MetaEditor.vue'
import dayjs, { type Dayjs } from 'dayjs'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  projectId: number
  item?: BacklogItem | null
  backlogTypes: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [item: BacklogItem]
}>()

const saving = ref(false)

const STATUSES = computed<{ value: BacklogStatus; label: string }[]>(() => [
  { value: 'pending', label: t('claw.backlog.statusPending') },
  { value: 'active', label: t('claw.backlog.statusActive') },
  { value: 'pool', label: t('claw.backlog.statusPool') },
  { value: 'dropped', label: t('claw.backlog.statusDropped') },
  { value: 'done', label: t('claw.backlog.statusDone') },
])

const priorityLabelMap: Record<string, string> = {
  high: t('claw.backlog.priorityHigh'),
  medium: t('claw.backlog.priorityMedium'),
  low: t('claw.backlog.priorityLow'),
}
const priorityOptions = BACKLOG_PRIORITIES.map((p) => ({
  value: p,
  label: priorityLabelMap[p],
}))

const form = ref({
  title: '',
  status: 'pending' as BacklogStatus,
  priority: 'medium' as BacklogPriority,
  type: '',
  source: '',
  reason: '',
  detail: '',
  dueAt: '',
  meta: null as Record<string, unknown> | null,
})

const typeAutoCompleteOptions = computed(() =>
  props.backlogTypes.map((t) => ({ value: t }))
)

const formDueAtDayjs = computed({
  get: () =>
    (form.value.dueAt ? dayjs(form.value.dueAt) : null) as Dayjs | null,
  set: (v: Dayjs | null | string) => {
    if (!v) {
      form.value.dueAt = ''
      return
    }
    if (typeof v === 'string') {
      form.value.dueAt = v
      return
    }
    form.value.dueAt = v.format('YYYY-MM-DD')
  },
})

const modalTitle = computed(() =>
  props.item ? t('claw.backlog.editTitle') : t('claw.backlog.addTitle')
)

const isDropped = computed(() => form.value.status === 'dropped')

watch(
  () => props.open,
  (val) => {
    if (!val) return
    if (props.item) {
      form.value = {
        title: props.item.title,
        status: props.item.status,
        priority: props.item.priority ?? 'medium',
        type: props.item.type,
        source: props.item.source,
        reason: props.item.reason,
        detail: props.item.detail,
        dueAt: props.item.dueAt,
        meta: props.item.meta ?? null,
      }
    } else {
      form.value = {
        title: '',
        status: 'pending',
        priority: 'medium',
        type: '',
        source: '',
        reason: '',
        detail: '',
        dueAt: '',
        meta: null,
      }
    }
  }
)

onMounted(() => {
  testActionSet('modal.fillTitle', (val: string) => {
    form.value.title = val
  })
  testActionSet('modal.submit', () => handleOk())
  testActionSet('modal.close', () => emit('update:open', false))
})
onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})

async function handleOk() {
  if (!form.value.title.trim()) {
    message.warning(t('claw.backlog.titleRequired'))
    return
  }
  if (form.value.status === 'dropped' && !form.value.reason.trim()) {
    message.warning(t('claw.backlog.dropReasonRequired'))
    return
  }
  saving.value = true
  try {
    let result: BacklogItem
    if (props.item) {
      result = await editBacklog(props.item.id, {
        title: form.value.title.trim(),
        status: form.value.status,
        priority: form.value.priority,
        type: form.value.type.trim() || null,
        source: form.value.source.trim() || null,
        reason: form.value.reason.trim() || null,
        detail: form.value.detail.trim() || null,
        dueAt: form.value.dueAt || null,
        meta: form.value.meta ?? null,
      })
    } else {
      result = await addBacklog({
        projectId: props.projectId,
        title: form.value.title.trim(),
        status: form.value.status,
        priority: form.value.priority,
        type: form.value.type.trim() || undefined,
        source: form.value.source.trim() || undefined,
        reason: form.value.reason.trim() || undefined,
        detail: form.value.detail.trim() || undefined,
        dueAt: form.value.dueAt || undefined,
        meta: form.value.meta ?? undefined,
      })
    }
    message.success(
      props.item ? t('claw.backlog.saveSuccess') : t('claw.backlog.addSuccess')
    )
    emit('saved', result)
    emit('update:open', false)
  } catch {
    message.error(t('claw.backlog.saveFailed'))
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  emit('update:open', false)
}
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="modalTitle"
    :confirm-loading="saving"
    :ok-text="t('claw.backlog.saveBtnText')"
    :cancel-text="t('claw.backlog.cancelBtnText')"
    width="95vw"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <div class="space-y-4 py-2">
      <!-- 标题 -->
      <div>
        <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('claw.backlog.titleLabel') }}
          <span class="text-red-500">{{
            t('claw.backlog.titleRequiredMark')
          }}</span>
        </div>
        <a-input
          v-model:value="form.title"
          :placeholder="t('claw.backlog.titlePlaceholder')"
          @keydown.ctrl.enter="handleOk"
        />
      </div>

      <!-- 状态 + 优先级 + 类型 -->
      <div class="grid grid-cols-3 gap-3">
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {{ t('claw.backlog.statusLabel') }}
          </div>
          <a-select v-model:value="form.status" class="w-full">
            <a-select-option
              v-for="s in STATUSES"
              :key="s.value"
              :value="s.value"
            >
              {{ s.label }}
            </a-select-option>
          </a-select>
        </div>
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {{ t('claw.backlog.priorityLabel') }}
          </div>
          <a-select v-model:value="form.priority" class="w-full">
            <a-select-option
              v-for="p in priorityOptions"
              :key="p.value"
              :value="p.value"
            >
              {{ p.label }}
            </a-select-option>
          </a-select>
        </div>
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {{ t('claw.backlog.typeLabel') }}
          </div>
          <a-auto-complete
            v-model:value="form.type"
            :options="typeAutoCompleteOptions"
            :placeholder="t('claw.backlog.typePlaceholder')"
            allow-clear
            class="w-full"
          />
        </div>
      </div>

      <!-- 废弃原因（仅 dropped 时显示）-->
      <div v-if="isDropped">
        <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('claw.backlog.dropReasonLabel') }}
          <span class="text-red-500">{{
            t('claw.backlog.dropReasonRequiredMark')
          }}</span>
        </div>
        <a-textarea
          v-model:value="form.reason"
          :placeholder="t('claw.backlog.dropReasonPlaceholder')"
          :auto-size="{ minRows: 2, maxRows: 4 }"
        />
      </div>

      <!-- 来源 + 截止时间 -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {{ t('claw.backlog.sourceLabel') }}
          </div>
          <a-input
            v-model:value="form.source"
            :placeholder="t('claw.backlog.sourcePlaceholder')"
            allow-clear
          />
        </div>
        <div>
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {{ t('claw.backlog.dueDateLabel') }}
          </div>
          <a-date-picker
            v-model:value="formDueAtDayjs"
            value-format="YYYY-MM-DD"
            :placeholder="t('claw.backlog.dueDatePlaceholder')"
            class="w-full"
            allow-clear
          />
        </div>
      </div>

      <!-- 详细内容 -->
      <div>
        <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('claw.backlog.detailLabel') }}
        </div>
        <a-textarea
          v-model:value="form.detail"
          :placeholder="t('claw.backlog.detailPlaceholder')"
          :auto-size="{ minRows: 3, maxRows: 8 }"
        />
      </div>

      <!-- Meta (JSON) -->
      <div>
        <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('claw.backlog.metaLabel') }}
        </div>
        <MetaEditor v-model="form.meta" />
      </div>
    </div>
  </a-modal>
</template>
