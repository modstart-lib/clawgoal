<script setup lang="ts">
import { deleteChatSession, listChatSessions } from '@/claw/api/agentSession'
import type { ChatSession } from '@/claw/api/agentSession'
import EmptyState from '@/components/EmptyState.vue'
import { message, Modal } from 'ant-design-vue'
import Trash2 from '~icons/lucide/trash-2'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  agentId: number
  currentSessionId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  switch: [sessionId: number]
}>()

const PAGE_SIZE = 20
const sessions = ref<ChatSession[]>([])
const loading = ref(false)
const currentPage = ref(1)

const fetchSessions = async () => {
  loading.value = true
  try {
    sessions.value = await listChatSessions(props.agentId, { limit: 200 })
  } catch {
    message.error(t('claw.agent.sessionLoadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchSessions()
  testActionSet('list.refresh', () => fetchSessions())
})
onUnmounted(() => {
  testActionUnset('list.refresh')
})

const total = computed(() => sessions.value.length)
const pagedSessions = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return sessions.value.slice(start, start + PAGE_SIZE)
})

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleSwitch = (session: ChatSession) => {
  if (session.id === props.currentSessionId) return
  emit('switch', session.id)
  emit('update:open', false)
}

const handleDelete = (session: ChatSession) => {
  Modal.confirm({
    title: t('claw.agent.sessionDeleteTitle'),
    content: `${t('claw.agent.sessionDeleteConfirm', { title: session.title || `${t('claw.agent.sessionLabel')} #${session.id}` })}`,
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    async onOk() {
      try {
        await deleteChatSession(session.id)
        sessions.value = sessions.value.filter((s) => s.id !== session.id)
        if (currentPage.value > 1 && pagedSessions.value.length === 0) {
          currentPage.value--
        }
        message.success(t('common.deleteSuccess'))
      } catch {
        message.error(t('common.deleteFailed'))
      }
    },
  })
}
</script>

<template>
  <a-modal
    :open="open"
    :title="t('claw.agent.sessionHistoryTitle')"
    width="min(680px, 90vw)"
    :footer="null"
    destroy-on-close
    @update:open="emit('update:open', $event)"
  >
    <div style="min-height: 400px" class="flex flex-col">
      <div
        v-if="loading"
        class="flex items-center justify-center py-12 text-gray-400 text-sm"
      >
        {{ t('claw.agent.loading') }}
      </div>
      <template v-else>
        <EmptyState
          v-if="sessions.length === 0"
          :description="t('claw.agent.sessionEmpty')"
        />
        <div
          v-else
          class="flex-1 divide-y divide-gray-100 dark:divide-gray-700"
        >
          <div
            v-for="session in pagedSessions"
            :key="session.id"
            class="group flex items-center gap-3 px-2 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            :class="{
              'bg-blue-50 dark:bg-blue-900/30': session.id === currentSessionId,
            }"
            @click="handleSwitch(session)"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
              :class="
                session.id === currentSessionId
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-800/50 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              "
            >
              {{ session.id }}
            </div>
            <div class="flex-1 min-w-0">
              <div
                class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate"
              >
                {{
                  session.title ||
                  t('claw.agent.sessionDefaultTitle', { id: session.id })
                }}
              </div>
              <div
                class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2 mt-0.5"
              >
                <span>{{
                  t('claw.agent.sessionMessageCount', {
                    count: session.message_count,
                  })
                }}</span>
                <span>·</span>
                <span>{{ formatTime(session.updated_at) }}</span>
              </div>
            </div>
            <span
              v-if="session.id === currentSessionId"
              class="text-xs text-blue-500 dark:text-blue-400 shrink-0 font-medium"
              >{{ t('claw.agent.sessionCurrent') }}</span
            >
            <a-button
              v-else
              type="text"
              class="inline-flex items-center shrink-0 opacity-0 group-hover:opacity-100"
              @click.stop="handleDelete(session)"
            >
              <Trash2
                class="w-4 h-4 text-gray-400 hover:text-red-500"
                aria-hidden="true"
              />
            </a-button>
          </div>
        </div>
        <div v-if="total > PAGE_SIZE" class="flex justify-center pt-4">
          <a-pagination
            v-model:current="currentPage"
            :total="total"
            :page-size="PAGE_SIZE"
            :show-size-changer="false"
            size="small"
          />
        </div>
      </template>
    </div>
  </a-modal>
</template>
