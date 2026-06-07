/**
 * WebSocket Composable
 * For connecting and managing WebSocket communication for Agent tasks.
 */
import { io, Socket } from 'socket.io-client'
import { onBeforeUnmount, ref } from 'vue'
import { resolveApiPath } from '../api/base'
import { generateId } from '../utils/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content?: string
  images?: string[]
  files?: string[]
  tools?: Array<{
    id: string
    toolName: string
    label?: string
    title: string
    status: 'running' | 'success' | 'error'
    detail?: string
    success?: string
    error?: string
  }>
  asks?: MessageAsk[]
  timestamp: string
}

export interface MessageAsk {
  id: string
  question: string
  options?: Array<{ label: string; value: string }>
}

export interface WebSocketMessage {
  id: string
  type:
    | 'msg'
    | 'msgRemove'
    | 'authSuccess'
    | 'sendMsgSuccess'
    | 'error'
    | 'history'
    | 'runSuccess'
    | 'custom'
  msg?: string
  data?: any
}

export function useWebSocket() {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  const authenticated = ref(false)
  const messages = ref<ChatMessage[]>([])
  const lastCustomEvent = ref<{ type: string; data: any } | null>(null)

  /**
   * Connect WebSocket
   */
  const connect = (_wsUrl: string, taskId: string, token: string) => {
    if (socket.value?.connected) {
      console.warn('WebSocket already connected')
      return
    }

    const baseUrl = window.location.origin

    socket.value = io(baseUrl, {
      path: resolveApiPath('/websocket/manage'),
      query: { taskId },
      transports: ['websocket', 'polling'],
    })

    socket.value.on('connect', () => {
      console.log('WebSocket connected')
      connected.value = true

      socket.value?.emit('message', {
        id: generateId(),
        type: 'auth',
        data: { token },
      })
      const locale = localStorage.getItem('locale') || 'zh-CN'
      socket.value?.emit('message', {
        id: generateId(),
        type: 'locale',
        data: { locale },
      })
    })

    socket.value.on('message', (msg: WebSocketMessage) => {
      console.log('WebSocket message received:', msg)
      handleMessage(msg)
    })

    socket.value.on('disconnect', () => {
      console.log('WebSocket disconnected')
      connected.value = false
      authenticated.value = false
    })

    socket.value.on('error', (error: any) => {
      console.error('WebSocket error:', error)
    })
  }

  /**
   * Handle received messages
   */
  const handleMessage = (msg: WebSocketMessage) => {
    switch (msg.type) {
      case 'authSuccess':
        authenticated.value = true
        console.log('WebSocket authenticated')
        requestHistory()
        break

      case 'error':
        console.error('WebSocket error message:', msg.msg)
        if (!authenticated.value) {
          disconnect()
        }
        break

      case 'msg': {
        const chatMsg = msg.data as ChatMessage
        addOrUpdateMessage(chatMsg)
        break
      }

      case 'msgRemove': {
        const removeId = msg.data?.msgId as string
        if (removeId) {
          messages.value = messages.value.filter((m) => m.id !== removeId)
        }
        break
      }

      case 'history': {
        const historyMessages = msg.data.messages as ChatMessage[]
        messages.value = historyMessages
        break
      }

      case 'sendMsgSuccess':
        break

      case 'runSuccess':
        console.log('ScheduleTask execution started')
        break

      case 'custom':
        lastCustomEvent.value = msg.data as { type: string; data: any }
        break
    }
  }

  /**
   * Add or update a message
   */
  const addOrUpdateMessage = (msg: ChatMessage) => {
    const index = messages.value.findIndex((m) => m.id === msg.id)
    if (index > -1) {
      messages.value[index] = msg
    } else {
      messages.value.push(msg)
    }
  }

  /**
   * Request message history
   */
  const requestHistory = (maxId: number = -1) => {
    if (!socket.value || !authenticated.value) {
      console.warn('WebSocket not ready')
      return
    }

    socket.value.emit('message', {
      id: generateId(),
      type: 'history',
      data: { maxId },
    })
  }

  /**
   * Send a message
   */
  const sendMessage = (data: {
    text?: string
    images?: string[]
    files?: string[]
    meta?: import('../components/AgentChat/types').AgentMessageMeta
  }) => {
    if (!socket.value || !authenticated.value) {
      console.warn('WebSocket not ready')
      return Promise.reject(new Error('WebSocket not ready'))
    }

    return new Promise<void>((resolve, reject) => {
      const requestId = generateId()

      socket.value?.emit('message', {
        id: requestId,
        type: 'sendMsg',
        data,
      })

      const timeout = setTimeout(() => {
        reject(new Error('Send message timeout'))
      }, 5000)

      const handler = (msg: WebSocketMessage) => {
        if (msg.id === requestId && msg.type === 'sendMsgSuccess') {
          clearTimeout(timeout)
          socket.value?.off('message', handler)
          resolve()
        }
      }

      socket.value?.on('message', handler)
    })
  }

  /**
   * Execute task (send run command)
   */
  const runTask = () => {
    if (!socket.value || !authenticated.value) {
      console.warn('WebSocket not ready')
      return Promise.reject(new Error('WebSocket not ready'))
    }

    return new Promise<void>((resolve, reject) => {
      const requestId = generateId()
      socket.value?.emit('message', {
        id: requestId,
        type: 'run',
        data: {},
      })
      const timeout = setTimeout(() => {
        reject(new Error('Run task timeout'))
      }, 5000)
      const handler = (msg: WebSocketMessage) => {
        if (msg.id === requestId) {
          if (msg.type === 'runSuccess') {
            clearTimeout(timeout)
            socket.value?.off('message', handler)
            resolve()
          } else if (msg.type === 'error') {
            clearTimeout(timeout)
            socket.value?.off('message', handler)
            reject(new Error(msg.msg || 'Run task failed'))
          }
        }
      }

      socket.value?.on('message', handler)
    })
  }

  /**
   * Disconnect
   */
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    connected.value = false
    authenticated.value = false
  }

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    socket,
    connected,
    authenticated,
    messages,
    lastCustomEvent,
    connect,
    disconnect,
    sendMessage,
    runTask,
    requestHistory,
  }
}
