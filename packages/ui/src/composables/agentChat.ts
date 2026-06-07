/**
 * agentChat — Agent 对话 WebSocket composable
 * 路径: {apiBase}/websocket/agent
 *
 * @param agentId          Agent ID
 * @param initialSessionId 初始显示的会话 ID，0 表示使用最近一个会话
 */
import { io, Socket } from 'socket.io-client'
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveApiPath } from '../api/base'
import type { AgentMessage } from '../components/AgentChat/types.ts'
import { useAuth } from './auth.ts'
import { generateId } from '../utils/utils'

interface WsMsg {
  id: string
  type: string
  msg?: string
  data?: any
}

function contentToMessage(raw: any, _t: (key: string) => string): AgentMessage {
  const content = typeof raw.content === 'object' ? raw.content : {}

  return {
    id: raw.id ?? generateId(),
    role: raw.role ?? content.role ?? 'assistant',
    content: content.text ?? undefined,
    images: content.images?.map((url: string) => ({ name: '', url })),
    files: content.files?.map((url: string) => ({
      name: url.split('/').pop() || url,
      url,
      size: 0,
    })),
    stage: content.stage ?? undefined,
    meta: content.meta ?? undefined,
    asks: content.asks?.map((a: any) => ({
      id: a.id ?? '',
      question: a.question ?? '',
      options: (a.options ?? []).map((o: any) =>
        typeof o === 'string' ? o : (o.label ?? '')
      ),
      optionActive: a.answered ? 0 : -1,
      optionInput: '',
      optionSelected: a.answered ?? undefined,
    })),
    suggests: (content.suggests ?? []).map((s: any) => ({
      text: s.text ?? '',
      checked: false,
      icon: s.icon,
    })),
    actionView: content.actionView ?? undefined,
    timestamp: content.timestamp
      ? new Date(Number(content.timestamp)).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
  }
}

export function useAgentChat(agentId: number, initialSessionId = 0) {
  const { t } = useI18n()
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  const authenticated = ref(false)
  const loading = ref(false)
  const initialLoading = ref(false)
  const messages = ref<AgentMessage[]>([])
  const hasMoreHistory = ref(false)
  const historyLoading = ref(false)
  const currentSessionId = ref<number>(initialSessionId)

  const authStore = useAuth()

  const connect = () => {
    if (socket.value?.connected) return
    initialLoading.value = true

    socket.value = io(window.location.origin, {
      path: resolveApiPath('/websocket/agent'),
      transports: ['websocket', 'polling'],
    })

    socket.value.on('connect', () => {
      connected.value = true
      socket.value?.emit('message', {
        id: generateId(),
        type: 'auth',
        data: { token: authStore.getAuthHeader() },
      })
      socket.value?.emit('message', {
        id: generateId(),
        type: 'locale',
        data: { locale: localStorage.getItem('locale') || 'zh-CN' },
      })
    })

    socket.value.on('message', (msg: WsMsg) => {
      handleMessage(msg)
    })

    socket.value.on('disconnect', () => {
      connected.value = false
      authenticated.value = false
    })
  }

  const handleMessage = (msg: WsMsg) => {
    switch (msg.type) {
      case 'authSuccess':
        authenticated.value = true
        subscribe()
        break

      case 'subscribeSuccess':
        loadHistory()
        break

      case 'msg':
        addOrUpdate(contentToMessage(msg.data, t))
        break

      case 'msgRemove': {
        const removeId = msg.data?.msgId ?? msg.data?.id
        if (removeId) {
          messages.value = messages.value.filter(
            (m) => m.id !== String(removeId)
          )
        }
        break
      }

      case 'msgHistory': {
        const rows: any[] = msg.data?.messages ?? []
        const isLoadMore = msg.data?.beforeId != null
        hasMoreHistory.value = msg.data?.hasMore ?? false
        historyLoading.value = false
        if (!isLoadMore) {
          initialLoading.value = false
          // 刷新后从历史消息中恢复 sessionId
          if (currentSessionId.value === 0 && msg.data?.sessionId > 0) {
            currentSessionId.value = msg.data.sessionId
          }
        }
        if (isLoadMore) {
          // Prepend older messages, preserving existing list
          messages.value = [
            ...rows.map((r: any) => contentToMessage(r, t)),
            ...messages.value,
          ]
        } else {
          messages.value = rows.map((r: any) => contentToMessage(r, t))
        }
        break
      }

      case 'msgsCleared':
        messages.value = []
        hasMoreHistory.value = false
        break

      case 'sessionChanged': {
        const newSid = msg.data?.sessionId ?? 0
        if (newSid > 0) {
          currentSessionId.value = newSid
        }
        // Clear current messages and reload for the new session
        messages.value = []
        hasMoreHistory.value = false
        loadHistory(20, undefined, currentSessionId.value)
        break
      }

      case 'sendMsgSuccess':
        loading.value = false
        if (msg.data?.sessionId && currentSessionId.value === 0) {
          currentSessionId.value = msg.data.sessionId
        }
        break

      case 'newSessionSuccess':
        loading.value = false
        if (msg.data?.sessionId) {
          currentSessionId.value = msg.data.sessionId
          messages.value = []
          hasMoreHistory.value = false
        }
        break

      case 'switchSessionSuccess':
        loading.value = false
        if (msg.data?.sessionId) {
          currentSessionId.value = msg.data.sessionId
          messages.value = []
          hasMoreHistory.value = false
          loadHistory(20, undefined, currentSessionId.value)
        }
        break

      case 'error':
        loading.value = false
        historyLoading.value = false
        initialLoading.value = false
        console.error('[AgentChat]', msg.msg)
        break
    }
  }

  const addOrUpdate = (msg: AgentMessage) => {
    const idx = messages.value.findIndex((m) => m.id === msg.id)
    if (idx > -1) {
      messages.value[idx] = msg
    } else {
      messages.value.push(msg)
    }
  }

  const subscribe = () => {
    socket.value?.emit('message', {
      id: generateId(),
      type: 'subscribe',
      data: { agentId },
    })
  }

  const loadHistory = (limit = 20, beforeId?: number, sessionId?: number) => {
    historyLoading.value = true
    socket.value?.emit('message', {
      id: generateId(),
      type: 'history',
      data: {
        agentId,
        limit,
        ...(beforeId != null ? { beforeId } : {}),
        ...(sessionId != null && sessionId > 0 ? { sessionId } : {}),
      },
    })
  }

  const loadMoreHistory = () => {
    if (!hasMoreHistory.value || historyLoading.value) return
    // Use the ID of the oldest message as cursor
    const oldestId =
      messages.value.length > 0 ? Number(messages.value[0].id) : undefined
    loadHistory(20, oldestId, currentSessionId.value || undefined)
  }

  const sendMsg = (text: string) => {
    if (!text.trim() || !authenticated.value) return
    loading.value = true
    socket.value?.emit('message', {
      id: generateId(),
      type: 'sendMsg',
      data: {
        agentId,
        text,
        ...(currentSessionId.value > 0
          ? { sessionId: currentSessionId.value }
          : {}),
      },
    })
  }

  const clearMessages = () => {
    if (!authenticated.value) return
    socket.value?.emit('message', {
      id: generateId(),
      type: 'clearMsgs',
      data: { agentId },
    })
  }

  const newSession = () => {
    if (!authenticated.value) return
    socket.value?.emit('message', {
      id: generateId(),
      type: 'sendMsg',
      data: { agentId, text: '/new' },
    })
  }

  const switchSession = (sessionId: number) => {
    if (!authenticated.value) return
    socket.value?.emit('message', {
      id: generateId(),
      type: 'sendMsg',
      data: { agentId, text: `/session ${sessionId}` },
    })
  }

  const disconnect = () => {
    socket.value?.disconnect()
    socket.value = null
    connected.value = false
    authenticated.value = false
  }

  onBeforeUnmount(disconnect)

  return {
    connected,
    authenticated,
    loading,
    initialLoading,
    messages,
    hasMoreHistory,
    historyLoading,
    currentSessionId,
    connect,
    disconnect,
    sendMsg,
    clearMessages,
    newSession,
    switchSession,
    loadHistory,
    loadMoreHistory,
  }
}
