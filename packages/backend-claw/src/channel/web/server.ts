/**
 * Web Channel WebSocket Service
 * Path: /api/websocket/agent
 *
 * 薄封装：创建 socket.io 服务器，处理认证，将所有业务逻辑委托给 WebChannelAdapter。
 *
 * 协议 (socket.io):
 *   Client → Server:
 *     auth       { token }
 *     subscribe  { agentId: number }
 *     sendMsg    { agentId: number, sessionId?: number, text: string }
 *     history    { agentId: number, sessionId?: number, limit?: number, beforeId?: number }
 *     clearMsgs  { agentId: number, sessionId?: number }
 *     newSession { agentId: number }
 *   Server → Client:
 *     message    { id, type: 'authSuccess'|'sendMsgSuccess'|'sendMsgAck'|'msg'|'msgHistory'|'error', data? }
 */

import type { Socket } from 'socket.io'
import { BaseWebsocketService } from '../../../../backend/src/websocket/base.js'
import { WebChannelAdapter } from './index.js'
import { createLogger } from '../../kernel/logger.js'

const logger = createLogger('ws-agent')

export class AgentWebsocketService extends BaseWebsocketService {
  private webAdapter!: WebChannelAdapter

  constructor() {
    super('agent')
  }

  initialize(httpServer: any): void {
    this.webAdapter = new WebChannelAdapter()
    const io = this.createServer(
      httpServer,
      '/api/websocket/agent',
      this._handleConnection.bind(this)
    )
    this.webAdapter.initialize(io)
    logger.info('AgentWebSocket initialized at /api/websocket/agent')
  }

  private _handleConnection(socket: Socket): void {
    this.trackConnection(socket.id)
    logger.debug({ socketId: socket.id }, 'web_client_connected')

    socket.on('message', async (msg: any) => {
      if (await this.handleCommonMessage(socket, msg)) return
      await this.webAdapter.handleMessage(socket, msg)
    })

    socket.on('disconnect', () => {
      this.webAdapter.handleDisconnect(socket.id)
      this.untrackConnection(socket.id)
      logger.debug({ socketId: socket.id }, 'web_client_disconnected')
    })
  }

  getStats(): { agentConnections: number } {
    return this.webAdapter?.getStats() ?? { agentConnections: 0 }
  }

  destroy(): void {
    this.webAdapter?.destroy()
    logger.info('AgentWebSocket destroyed')
  }
}
