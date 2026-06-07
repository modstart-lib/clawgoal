/**
 * WebSocket common base class
 * Provides shared message handling logic (e.g. auth) inherited by the manage and extension services.
 */
import type pino from 'pino'
import { Server, Socket } from 'socket.io'
import { config } from '../config/index.js'
import type { LocaleKey } from '../locale/index.js'
import { refreshToken, verifyToken } from '../utils/auth.js'
import { createNamedLogger } from '../utils/logger.js'
import { generateId } from '../utils/utils.js'

export abstract class BaseWebsocketService {
  protected name: string
  protected readonly logger: pino.Logger

  constructor(name: string) {
    this.name = name
    this.logger = createNamedLogger(`websocket_${name}`)
  }

  protected static readonly corsConfig = {
    origin: '*',
    methods: ['GET', 'POST'],
  }

  protected connections = new Set<string>()

  protected trackConnection(socketId: string): void {
    this.connections.add(socketId)
  }

  protected untrackConnection(socketId: string): void {
    this.connections.delete(socketId)
  }

  /**
   * Creates a Socket.IO Server and binds the connection handler.
   *
   * `destroyUpgrade: false` prevents engine.io (in each service instance) from scheduling a
   * 1-second socket.end() on upgrade requests that belong to *other* services sharing the
   * same httpServer. Without this flag every one of the four Server instances that doesn't
   * match the incoming path sets a setTimeout(socket.end, 1000), which is exactly the
   * ~1-second disconnect loop visible in the logs.
   */
  protected createServer(
    httpServer: any,
    path: string,
    handler: (socket: Socket) => void
  ): Server {
    const io = new Server(httpServer, {
      path,
      cors: BaseWebsocketService.corsConfig,
      destroyUpgrade: false,
    })
    io.on('connection', handler.bind(this))
    return io
  }

  /**
   * Handles common message types (auth / authRefresh / locale).
   * Returns true if the message was handled; subclass switch blocks can return early.
   */
  protected async handleCommonMessage(
    socket: Socket,
    msg: any
  ): Promise<boolean> {
    const { id, type, data } = msg ?? {}
    switch (type) {
      case 'auth':
        await this.handleAuth(socket, data?.token, id)
        return true
      case 'authRefresh':
        await this.handleAuthRefresh(socket, id)
        return true
      case 'locale':
        await this.handleLocale(socket, data, id)
        return true
      default:
        return false
    }
  }

  /**
   * Handles the auth message: verifies the token, writes to socket.data, and sends authSuccess/error.
   * Calls the onAuthenticated callback on success (subclasses can register connections here).
   * Automatically disconnects the socket on authentication failure.
   */
  protected async handleAuth(
    socket: Socket,
    token: string | undefined,
    requestId: string,
    onAuthenticated?: (userId: number, socket: Socket) => void
  ): Promise<void> {
    try {
      const rawToken =
        typeof token === 'string' && token.startsWith('Bearer ')
          ? token.slice(7)
          : (token ?? '')
      const decoded = verifyToken(rawToken)
      socket.data.userId = decoded.userId
      socket.data.tenantId = decoded.tenantId
      socket.data.authenticated = true

      onAuthenticated?.(decoded.userId, socket)

      const authSuccessMsg = {
        id: requestId,
        type: 'authSuccess',
        data: { userId: Number(decoded.userId) },
      }
      socket.emit('message', authSuccessMsg)
      if (socket.data.taskId) {
        this.logger.debug(
          {
            taskId: socket.data.taskId,
            socketId: socket.id,
            msg: authSuccessMsg,
          },
          `${this.name}_ws_send`
        )
      }
      this.logger.debug(
        { userId: decoded.userId, taskId: socket.data.taskId },
        'client_authenticated'
      )
    } catch {
      this.sendError(socket, requestId, 'Authentication failed')
      socket.disconnect()
    }
  }

  /**
   * Handles the authRefresh message: re-issues a token and sends authRefreshSuccess/authRefreshFailed.
   * Requires the socket to have already been authenticated.
   */
  protected async handleAuthRefresh(
    socket: Socket,
    requestId: string
  ): Promise<void> {
    if (!socket.data.authenticated) {
      this.sendError(
        socket,
        requestId,
        'Not authenticated, cannot refresh token'
      )
      return
    }
    try {
      const newToken = refreshToken(socket.data.userId, socket.data.tenantId)
      const successMsg = {
        id: requestId,
        type: 'authRefreshSuccess',
        data: { token: newToken, userId: Number(socket.data.userId) },
      }
      socket.emit('message', successMsg)
      if (socket.data.taskId) {
        this.logger.debug(
          {
            taskId: socket.data.taskId,
            socketId: socket.id,
            msg: successMsg,
          },
          `${this.name}_ws_send`
        )
      }
      this.logger.debug({ userId: socket.data.userId }, 'token_refreshed')
    } catch (err: any) {
      this.sendError(socket, requestId, 'Token refresh failed')
      this.logger.error({ error: err.message }, 'token_refresh_error')
    }
  }

  /**
   * Handles the locale message: stores the user's language preference in socket.data.locale
   * for subsequent i18n use via useWsI18n(). Can be called at any time, even repeatedly.
   * Client → Server: { type: 'locale', data: { locale: 'zh-CN' | 'en-US' } }
   * Server → Client: { type: 'localeSuccess', id, data: { locale } }
   */
  protected handleLocale(
    socket: Socket,
    data: { locale?: string } | undefined,
    requestId: string
  ): void {
    const locale = data?.locale as LocaleKey | undefined
    socket.data.locale =
      locale === 'zh-CN' || locale === 'en-US' ? locale : config.lang
    socket.emit('message', {
      id: requestId,
      type: 'localeSuccess',
      data: { locale: socket.data.locale },
    })
    this.logger.debug(
      { locale: socket.data.locale, socketId: socket.id },
      'locale_set'
    )
  }

  /**
   * Sends an error message to the socket.
   */
  protected sendError(
    socket: Socket,
    requestId: string,
    message: string
  ): void {
    const errorMsg = {
      id: requestId || generateId(),
      type: 'error',
      msg: message,
    }
    socket.emit('message', errorMsg)
    if (socket.data.taskId) {
      this.logger.debug(
        { taskId: socket.data.taskId, socketId: socket.id, msg: errorMsg },
        `${this.name}_ws_send`
      )
    }
  }

  abstract initialize(httpServer: any): void

  abstract getStats(): Record<string, any>
}
