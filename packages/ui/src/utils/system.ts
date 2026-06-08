/**
 * System WebSocket 工具
 * 连接后台 /api/websocket/system，接收系统级事件推送（如 Connector 状态变更）。
 *
 * 用法：
 *   import { systemWs } from '@/utils/system'
 *   // 在 App.vue 或路由守卫中初始化
 *   systemWs.connect(token)
 *   // 监听事件（命名格式：xxx:aaaBbb:cccDdd）
 *   systemWs.on('ops:machine:remoteStatusChanged', (data) => { ... })
 *   systemWs.off('ops:machine:remoteStatusChanged', handler)
 */

import { io, type Socket } from 'socket.io-client'
import { ref } from 'vue'
import { resolveApiPath } from '../api/base'
import { generateId } from '../utils/utils'

type EventHandler = (data: Record<string, unknown>) => void

export type WsStatus = 'connected' | 'connecting' | 'disconnected'

class SystemWebSocket {
  private socket: Socket | null = null
  private listeners = new Map<string, Set<EventHandler>>()
  private throttledHandlers = new Map<string, Map<EventHandler, EventHandler>>()
  private _serverSessionId: string | null = null

  readonly status = ref<WsStatus>('disconnected')

  private sendLocale(): void {
    const locale = localStorage.getItem('locale') || 'zh-CN'
    this.socket?.emit('message', {
      id: generateId(),
      type: 'locale',
      data: { locale },
    })
  }

  connect(token: string): void {
    if (this.socket?.connected) return

    this.status.value = 'connecting'
    const baseUrl = window.location.origin
    this.socket = io(baseUrl, {
      path: resolveApiPath('/websocket/system'),
      transports: ['websocket', 'polling'],
    })

    this.socket.on('connect', () => {
      const wasDisconnected = this.status.value !== 'connected'
      this.status.value = 'connected'
      this.socket?.emit('message', {
        id: generateId(),
        type: 'auth',
        data: { token },
      })
      this.sendLocale()
      // 重连后通知组件刷新数据，避免状态不一致
      if (wasDisconnected) {
        this._dispatch('system:reconnect', {})
      }
    })

    this.socket.on('message', (msg: { type: string; data?: any }) => {
      if (msg?.type === 'event' && msg.data?.name === 'system:server_session') {
        const sessionId = msg.data.sessionId as string
        if (this._serverSessionId && this._serverSessionId !== sessionId) {
          // 服务器已重启，刷新页面
          window.location.reload()
          return
        }
        this._serverSessionId = sessionId
        return
      }
      if (msg?.type === 'event' && msg.data?.name) {
        this._dispatch(msg.data.name, msg.data)
      }
    })

    this.socket.on('disconnect', () => {
      this.status.value = 'disconnected'
      // socket.io 会自动重连
    })

    this.socket.on('connect_error', () => {
      this.status.value = 'disconnected'
    })
  }

  disconnect(): void {
    this.socket?.disconnect()
    this.socket = null
  }

  on(eventName: string, handler: EventHandler): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }
    this.listeners.get(eventName)!.add(handler)
  }

  off(eventName: string, handler: EventHandler): void {
    this.listeners.get(eventName)?.delete(handler)
  }

  // 注册限流事件处理器，同一事件在 delay 毫秒内最多触发一次
  onThrottle(eventName: string, handler: EventHandler, delay = 1000): void {
    if (!this.throttledHandlers.has(eventName)) {
      this.throttledHandlers.set(eventName, new Map())
    }
    const map = this.throttledHandlers.get(eventName)!
    if (map.has(handler)) return
    let lastRun = 0
    const throttled: EventHandler = (data) => {
      const now = Date.now()
      if (now - lastRun >= delay) {
        lastRun = now
        handler(data)
      }
    }
    map.set(handler, throttled)
    this.on(eventName, throttled)
  }

  offThrottle(eventName: string, handler: EventHandler): void {
    const map = this.throttledHandlers.get(eventName)
    if (!map) return
    const throttled = map.get(handler)
    if (!throttled) return
    this.off(eventName, throttled)
    map.delete(handler)
  }

  private _dispatch(eventName: string, data: Record<string, unknown>): void {
    const handlers = this.listeners.get(eventName)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        handler(data)
      } catch {
        /* ignore */
      }
    }
  }
}

export const systemWs = new SystemWebSocket()
