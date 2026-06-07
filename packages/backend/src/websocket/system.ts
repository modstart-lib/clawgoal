/**
 * System WebSocket Service
 * Path: /api/websocket/system
 *
 * 前台管理界面的实时事件推送通道。前台连接后发送 auth，认证成功后
 * 即可接收后台触发的系统事件推送。
 *
 * 协议（socket.io message 事件）：
 *
 *   Client → Server:
 *     { type: 'auth',  data: { token } }        认证
 *     { type: 'event', data: { ... } }           未来预留
 *
 *   Server → Client:
 *     { type: 'authSuccess', data: { userId } }
 *     { type: 'event', data: { name: 'Connector:Updated', connectorId } }
 *     { type: 'event', data: { name: 'Connector:ExecutorsUpdated', connectorId } }
 */

import { type Socket, Server } from 'socket.io'
import { generateId } from '../utils/utils.js'
import { BaseWebsocketService } from './base.js'

// 服务进程启动时生成唯一会话 ID，用于前端检测服务器重启
const SERVER_SESSION_ID = generateId()

export class SystemWebsocketService extends BaseWebsocketService {
  private io!: Server

  constructor() {
    super('system')
  }

  initialize(httpServer: any): void {
    this.io = this.createServer(
      httpServer,
      '/api/websocket/system',
      this.handleConnection
    )
    this.logger.info('SystemWebSocket initialized at /api/websocket/system')
  }

  broadcastEvent(name: string, data?: Record<string, unknown>): void {
    this.io.to('authenticated').emit('message', {
      id: generateId(),
      type: 'event',
      data: { name, ...data },
    })
  }

  private handleConnection = (socket: Socket): void => {
    this.trackConnection(socket.id)
    this.logger.debug({ socketId: socket.id }, 'system_client_connected')

    socket.on('message', async (msg: any) => {
      try {
        const { id, type, data } = msg ?? {}
        if (type === 'auth') {
          await this.handleAuth(socket, data?.token, id, (_userId, sock) => {
            sock.join('authenticated')
            sock.emit('message', {
              id: generateId(),
              type: 'event',
              data: {
                name: 'system:server_session',
                sessionId: SERVER_SESSION_ID,
              },
            })
          })
          return
        }
        if (type === 'authRefresh') {
          await this.handleAuthRefresh(socket, id)
          return
        }
        if (type === 'locale') {
          this.handleLocale(socket, data, id)
          return
        }
        // type === 'event' 未来预留，暂时忽略
      } catch (err) {
        this.logger.error({ err }, 'system_ws_error')
        socket.emit('message', {
          id: generateId(),
          type: 'error',
          msg: String(err),
        })
      }
    })

    socket.on('disconnect', () => {
      this.untrackConnection(socket.id)
      this.logger.debug({ socketId: socket.id }, 'system_client_disconnected')
    })
  }

  getStats(): Record<string, any> {
    return { system: this.connections.size }
  }
}
