<template>
  <a-modal
    :open="open"
    :title="t('claw.compAuditViewModal.title')"
    width="95vw"
    :footer="null"
    :body-style="{
      padding: 0,
      height: 'calc(90vh - 110px)',
      display: 'flex',
      flexDirection: 'column',
    }"
    @cancel="$emit('close')"
  >
    <div class="flex flex-col h-full overflow-hidden">
      <!-- 头部信息 -->
      <div
        class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0"
      >
        <a-tag :color="statusColor">{{ statusText }}</a-tag>
        <span class="text-sm text-gray-500 flex-1 truncate">{{ summary }}</span>
      </div>

      <!-- Diff 查看器 -->
      <div class="flex-1 overflow-hidden">
        <AuditDiffViewer v-if="content" :diffs="content.diffs" />
        <div
          v-else-if="loading"
          class="flex items-center justify-center h-full"
        >
          <a-spin />
        </div>
      </div>

      <!-- 底部操作（仅 pending 状态显示） -->
      <div
        v-if="status === 'pending'"
        class="flex flex-col gap-2 px-4 py-3 border-t border-gray-100 shrink-0 bg-gray-50"
      >
        <a-textarea
          v-model:value="rejectMessage"
          :placeholder="t('claw.compAuditViewModal.rejectPlaceholder')"
          :rows="2"
          class="text-sm"
        />
        <div class="flex items-center gap-2">
          <a-button @click="handleCancel">{{
            t('claw.compAuditViewModal.cancelMerge')
          }}</a-button>
          <a-button danger @click="handleReject">{{
            t('claw.compAuditViewModal.reject')
          }}</a-button>
          <a-button type="primary" @click="handleApprove">{{
            t('claw.compAuditViewModal.approve')
          }}</a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import apiClient from '@/claw/api/client'
import AuditDiffViewer from '@/claw/components/AuditDiffViewer.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

interface AuditContent {
  diffs: Record<string, string>
  summary: string
  review?: { rejectMessage: string }
}

const props = withDefaults(
  defineProps<{
    open: boolean
    auditId?: number | null
  }>(),
  {
    auditId: null,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:open', val: boolean): void
  (
    e: 'action',
    payload: { type: 'approve' | 'cancel' | 'reject'; message?: string }
  ): void
}>()

const loading = ref(false)
const status = ref<'pending' | 'approved' | 'rejected' | 'cancelled'>('pending')
const content = ref<AuditContent | null>(null)
const { t } = useI18n()
const rejectMessage = ref('')

const summary = computed(() => content.value?.summary ?? '')

const statusColor = computed(() => {
  if (status.value === 'approved') return 'success'
  if (status.value === 'rejected') return 'error'
  if (status.value === 'cancelled') return 'default'
  return 'processing'
})

const statusText = computed(() => {
  if (status.value === 'approved')
    return t('claw.compAuditViewModal.statusApproved')
  if (status.value === 'rejected')
    return t('claw.compAuditViewModal.statusRejected')
  if (status.value === 'cancelled')
    return t('claw.compAuditViewModal.statusCancelled')
  return t('claw.compAuditViewModal.statusPending')
})

watch(
  () => props.open,
  async (val) => {
    if (val && props.auditId) {
      await fetchAudit()
    } else {
      content.value = null
      status.value = 'pending'
      rejectMessage.value = ''
    }
  }
)

async function fetchAudit() {
  if (!props.auditId) return
  loading.value = true
  try {
    const res = await apiClient.post('/claw/agentAudit/get', {
      auditId: props.auditId,
    })
    const audit = res.data.data?.audit
    if (audit) {
      status.value = audit.status
      content.value = audit.content
    }
  } catch {
    message.error(t('claw.compAuditViewModal.loadFailed'))
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  emit('action', { type: 'cancel' })
  emit('close')
}

function handleApprove() {
  emit('action', { type: 'approve' })
  emit('close')
}

function handleReject() {
  emit('action', { type: 'reject', message: rejectMessage.value || undefined })
  emit('close')
}

onMounted(() => {
  testActionSet('audit.approve', () => handleApprove())
  testActionSet('audit.reject', () => handleReject())
  testActionSet('audit.cancel', () => handleCancel())
})
onUnmounted(() => {
  testActionUnset('audit.approve')
  testActionUnset('audit.reject')
  testActionUnset('audit.cancel')
})
</script>
