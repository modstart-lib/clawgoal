<script setup lang="ts">
import AgentChat from '@/components/AgentChat/index.vue'
import type { SendMessageData, ToolAction } from '@/components/AgentChat/types'
import { useAgentChat } from '@/composables/agentChat'
import type { Agent } from '@/types'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import History from '~icons/lucide/history'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Plus from '~icons/lucide/plus'
import ScrollText from '~icons/lucide/scroll-text'
import Settings from '~icons/lucide/settings'
import Trash2 from '~icons/lucide/trash-2'
import AgentDetailChatSessionModal from './AgentDetailChatSessionModal.vue'
import AgentDetailConfigModal from './AgentDetailConfigModal.vue'
import AuditViewModal from '@/claw/components/AuditViewModal.vue'
import apiClient from '@/claw/api/client'
import { getChatSessionLogUrl } from '@/claw/api/agentSession'
import { copyText } from '@/utils/utils'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    agentId: number
    agentTitle: string
    agentAvatar?: string | null
    agent?: Agent | null
    /** 初始显示的会话 ID，0 表示使用最近一个会话 */
    sessionId?: number
    /** 是否显示聊天框顶部 header，默认 true */
    showHeader?: boolean
  }>(),
  {
    sessionId: 0,
    agent: null,
    showHeader: true,
    agentAvatar: null,
  }
)

const emit = defineEmits<{ updated: [patch: Partial<Agent>] }>()

const {
  loading,
  initialLoading,
  messages,
  hasMoreHistory,
  historyLoading,
  currentSessionId,
  connect,
  sendMsg,
  loadMoreHistory,
  clearMessages,
  newSession,
  switchSession,
} = useAgentChat(props.agentId, props.sessionId)

const showSessionModal = ref(false)
const showConfigModal = ref(false)
const auditViewVisible = ref(false)
const currentAuditId = ref<number | null>(null)

const copySessionLog = async () => {
  if (!currentSessionId.value) {
    message.info(t('claw.agent.chatNoSession'))
    return
  }
  const result = await getChatSessionLogUrl(
    props.agentId,
    currentSessionId.value
  )
  if (!result.logUrl) {
    message.info(t('claw.agent.chatNoLog'))
    return
  }
  const fullUrl = `${window.location.origin}${result.logUrl}`
  await copyText(fullUrl, t('claw.agent.chatLogCopied'))
}

const handleActionView = (data: any) => {
  if (data?.auditId) {
    currentAuditId.value = Number(data.auditId)
    auditViewVisible.value = true
  }
}

const fetchToolLogs = async (
  toolCallId: string
): Promise<{ items: any[]; status?: string; durationMs?: number }> => {
  const res = await apiClient.post('/claw/agentTool/getLogs', { toolCallId })
  return {
    items: res.data.data?.items ?? [],
    status: res.data.data?.status,
    durationMs: res.data.data?.durationMs,
  }
}

const handleAuditAction = (payload: {
  type: 'approve' | 'cancel' | 'reject'
  message?: string
}) => {
  auditViewVisible.value = false
  if (payload.type === 'approve') {
    sendMsg(t('claw.agent.chatApprove'))
  } else if (payload.type === 'cancel') {
    sendMsg(t('claw.agent.chatCancel'))
  } else if (payload.type === 'reject') {
    sendMsg(
      payload.message
        ? `${t('claw.agent.chatReject')}：${payload.message}`
        : t('claw.agent.chatReject')
    )
  }
}

onMounted(() => {
  connect()
  testActionSet('chat.openConfig', () => {
    showConfigModal.value = true
  })
  testActionSet('chat.openSessions', () => {
    showSessionModal.value = true
  })
  testActionSet('chat.newSession', () => newSession())
})
onUnmounted(() => {
  testActionUnset('chat.openConfig')
  testActionUnset('chat.openSessions')
  testActionUnset('chat.newSession')
})

const toolActions = computed<ToolAction[]>(() => {
  return (props.agent?.config?.chats?.toolActions ?? []) as ToolAction[]
})

const handleChatSend = ({ content }: SendMessageData) => {
  if (!content?.trim()) return
  sendMsg(content)
}

const handleStop = () => {
  sendMsg('/stop')
}

const handleSwitchSession = (sessionId: number) => {
  switchSession(sessionId)
}

defineExpose({ handleSwitchSession, newSession, currentSessionId })
</script>

<template>
  <div class="h-full rounded-none overflow-hidden relative">
    <AgentChat
      v-model="messages"
      :loading="loading"
      :stoppable="true"
      :initial-loading="initialLoading"
      :bot-avatar="agentAvatar || undefined"
      :bot-name="showHeader ? agentTitle : undefined"
      :placeholder="t('claw.agent.chatPlaceholder')"
      :tool-actions="toolActions"
      :has-more-history="hasMoreHistory"
      :history-loading="historyLoading"
      :fetch-logs="fetchToolLogs"
      @send="handleChatSend"
      @stop="handleStop"
      @load-more="loadMoreHistory"
      @action-view="handleActionView"
    >
      <template v-if="showHeader" #header-actions>
        <div class="flex items-center gap-1">
          <a-button
            v-if="messages.length > 0"
            type="text"
            class="inline-flex items-center gap-1"
            @click="newSession"
          >
            <Plus class="w-4 h-4" aria-hidden="true" />{{
              t('claw.agent.chatNewSession')
            }}
          </a-button>
          <a-button
            type="text"
            class="inline-flex items-center gap-1"
            @click="showSessionModal = true"
          >
            <History class="w-4 h-4" aria-hidden="true" />{{
              t('claw.agent.sessionHistoryTitle')
            }}
          </a-button>
          <a-button
            type="text"
            class="inline-flex items-center gap-1"
            @click="showConfigModal = true"
          >
            <Settings class="w-4 h-4" aria-hidden="true" />{{
              t('claw.agent.settingsTitle')
            }}
          </a-button>
          <a-dropdown
            v-if="messages.length > 0"
            placement="bottomRight"
            :trigger="['click']"
          >
            <a-button type="text" class="inline-flex items-center">
              <MoreHorizontal class="w-4 h-4" aria-hidden="true" />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item key="copyLog" @click="copySessionLog">
                  <div class="flex items-center gap-2">
                    <ScrollText class="w-4 h-4" aria-hidden="true" />
                    {{ t('claw.agent.chatCopyLog') }}
                  </div>
                </a-menu-item>
                <a-menu-item key="clear" @click="clearMessages">
                  <div class="flex items-center gap-2 text-red-500">
                    <Trash2 class="w-4 h-4" />
                    {{ t('claw.agent.chatClearSession') }}
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </template>
    </AgentChat>

    <AuditViewModal
      :open="auditViewVisible"
      :audit-id="currentAuditId"
      @close="auditViewVisible = false"
      @action="handleAuditAction"
    />

    <AgentDetailChatSessionModal
      v-model:open="showSessionModal"
      :agent-id="agentId"
      :current-session-id="currentSessionId"
      @switch="handleSwitchSession"
    />

    <AgentDetailConfigModal
      v-model:open="showConfigModal"
      :agent-id="agentId"
      :agent="agent"
      @updated="emit('updated', $event)"
    />
  </div>
</template>
