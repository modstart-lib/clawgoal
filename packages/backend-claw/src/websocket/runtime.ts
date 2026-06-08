/**
 * Runtime WebSocket Service
 * Path: /api/websocket/runtime
 *
 * 让 Runtime（远端设备，如安装了 opencode / claudeCode 的电脑）通过 token 接入，
 * 实现双向通信：服务端可通过此 WebSocket 向 Runtime 下发 runner 任务。
 *
 * 协议（socket.io 事件驱动，公共字段：id、timestamp）：
 *
 *   Client → Server:
 *     ping              {}                            心跳
 *     syncRunner        { runners:[{name,title},...] }   上报本地可用工具
 *     runRunnerStarted     { sessionId }
 *     runRunnerProgress    { sessionId, progressType, message?, level?, source?, fileOp?, filePath?, fileSuccess? }
 *       progressType values:
 *         prompt    — 发送给 runner 的完整提示词
 *         think     — 模型思考链内容（<think>...</think>）
 *         message   — 流式输出的普通文本内容
 *         fileRead  — 文件读取操作（fileOp=start/end）
 *         fileWrite — 文件写入操作（fileOp=start/end）
 *         diff      — 执行完成后的 git diff HEAD 内容
 *         other     — 其他未分类消息
 *     runRunnerSuccess     { sessionId, message }
 *     runRunnerFail        { sessionId, message }
 *
 *   Server → Client:
 *     connected         { runtimeId, title }
 *     pong              {}
 *     syncRunner        {}                          请求上报本地工具列表
 *     runRunner          { sessionId, name, prompt }
 */

import { safeJsonParse } from '../../../backend/src/utils/json.js'
import { randomUUID } from 'node:crypto'
import EventEmitter from 'events'
import { type Socket, Server } from 'socket.io'
import type { RunnerInfo } from '../storage/store/index.js'
import { clawDb } from '../storage/store/index.js'
import { BaseWebsocketService } from '../../../backend/src/websocket/base.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'

const logger = createLogger('ws-runtime')

export interface RunRunnerEvent {
  type: 'started' | 'progress' | 'success' | 'fail'
  sessionId: string
  message?: string
  /** progress 子类型（仅 type=progress 时有值） */
  progressType?:
    | 'message'
    | 'fileRead'
    | 'fileWrite'
    | 'think'
    | 'prompt'
    | 'other'
    | 'diff'
    | 'model'
  /** 消息级别（仅 progressType=message 时有值） */
  level?: 'log' | 'info' | 'warning' | 'error'
  /** 消息来源（仅 progressType=message 时有值） */
  source?: 'stdout' | 'stderr'
  /** 文件操作阶段（仅 progressType=fileRead/fileWrite 时有值） */
  fileOp?: 'start' | 'end'
  /** 操作文件路径（仅 progressType=fileRead/fileWrite 时有值） */
  filePath?: string
  /** 文件操作是否成功（仅 progressType=fileRead/fileWrite 且 fileOp=end 时有值） */
  fileSuccess?: boolean
}

export class RuntimeWebsocketService extends BaseWebsocketService {
  private io!: Server
  /** runtimeId → socketId */
  private runtimeSocket = new Map<number, string>()
  /** socketId → runtimeId */
  private socketRuntime = new Map<string, number>()
  /** session events emitter */
  private readonly sessionEmitter = new EventEmitter()

  constructor() {
    super('runtime')
    this.sessionEmitter.setMaxListeners(100)
  }

  initialize(httpServer: any): void {
    this.io = this.createServer(
      httpServer,
      '/api/websocket/runtime',
      this.handleConnection
    )
    logger.info('RuntimeWebSocket initialized at /api/websocket/runtime')
  }

  private handleConnection = (socket: Socket): void => {
    // 等待客户端发送 auth 事件进行认证
    socket.once('auth', (data: { token?: string }) => {
      const token = data?.token
      if (!token || typeof token !== 'string') {
        logger.warn(
          `Runtime auth rejected: missing token (socketId=${socket.id})`
        )
        socket.disconnect(true)
        return
      }

      const runtime = clawDb.findRuntimeByToken(token)
      if (!runtime) {
        logger.warn(
          `Runtime auth rejected: invalid token (socketId=${socket.id})`
        )
        socket.disconnect(true)
        return
      }

      socket.emit('authSuccess', {})

      const runtimeId = runtime.id
      logger.info(
        `Runtime auth success: id=${runtimeId} title="${runtime.title}" socketId=${socket.id}`
      )

      // 如果同一个 runtime 已有旧连接，断开旧连接
      const oldSocketId = this.runtimeSocket.get(runtimeId)
      if (oldSocketId && oldSocketId !== socket.id) {
        const oldSocket = this.io.sockets.sockets.get(oldSocketId)
        oldSocket?.disconnect(true)
      }

      this.runtimeSocket.set(runtimeId, socket.id)
      this.socketRuntime.set(socket.id, runtimeId)
      this.trackConnection(socket.id)

      clawDb.setRuntimeStatus(runtimeId, 'online')
      clawEventBus.emit('runtime:connected', {
        runtimeId,
        runtimeTitle: runtime.title,
      })

      socket.emit('connected', { runtimeId, title: runtime.title })

      // 连接后立即请求 runner 列表
      socket.emit('syncRunner', {})

      // ── 心跳 ─────────────────────────────────────────────────────────────
      socket.on('ping', () => {
        clawDb.setRuntimeStatus(runtimeId, 'online')
        socket.emit('pong', {})
      })

      // ── runner 列表同步 ────────────────────────────────────────────────────────
      socket.on('syncRunner', (data: { runners?: RunnerInfo[] }) => {
        const incoming: RunnerInfo[] = Array.isArray(data?.runners)
          ? data.runners.filter((c): c is RunnerInfo => !!(c?.name && c?.title))
          : []

        // 保留已有的 enable 设置，不被远端数据覆盖
        const existingRow = clawDb.findRuntimeById(runtimeId)
        const existingEnableMap: Record<string, boolean> = {}
        if (existingRow?.runners) {
          const existingList: RunnerInfo[] = safeJsonParse(
            existingRow.runners,
            [],
            'websocket.runtime.runners'
          )
          for (const e of existingList) {
            existingEnableMap[e.name] = e.enable !== false
          }
        }

        const merged: RunnerInfo[] = incoming.map((e) => ({
          name: e.name,
          title: e.title,
          status: e.status,
          enable:
            existingEnableMap[e.name] !== undefined
              ? existingEnableMap[e.name]
              : true,
        }))

        logger.info(
          `Runtime id=${runtimeId} reported ${merged.length} runner(s): ${merged.map((c) => c.name).join(', ')}`
        )
        clawDb.setRuntimeRunners(runtimeId, merged)
        clawEventBus.emit('runtime:runnersChanged', {
          runtimeId,
          runtimeTitle: runtime.title,
        })
      })

      // ── runRunner 生命周期事件 ─────────────────────────────────────────────
      socket.on('runRunnerStarted', (data: { sessionId: string }) => {
        logger.debug(
          `Runner started: sessionId=${data?.sessionId} runtimeId=${runtimeId}`
        )
        this.sessionEmitter.emit(`session:${data?.sessionId}`, {
          type: 'started',
          sessionId: data?.sessionId,
        } satisfies RunRunnerEvent)
      })

      socket.on(
        'runRunnerProgress',
        (data: {
          sessionId: string
          progressType?: string
          message?: string
          level?: string
          source?: string
          fileOp?: string
          filePath?: string
          fileSuccess?: boolean
        }) => {
          const progressType = (data?.progressType ??
            'other') as RunRunnerEvent['progressType']
          logger.info(
            `Runner progress [${progressType}]: sessionId=${data?.sessionId} — ${(data?.message ?? data?.filePath ?? '').slice(0, 200)}`
          )
          this.sessionEmitter.emit(`session:${data?.sessionId}`, {
            type: 'progress',
            sessionId: data?.sessionId,
            progressType,
            message: data?.message,
            level: (data?.level as RunRunnerEvent['level']) ?? 'log',
            source: (data?.source as RunRunnerEvent['source']) ?? 'stdout',
            fileOp: data?.fileOp as RunRunnerEvent['fileOp'],
            filePath: data?.filePath,
            fileSuccess: data?.fileSuccess,
          } satisfies RunRunnerEvent)
        }
      )

      socket.on(
        'runRunnerSuccess',
        (data: { sessionId: string; message?: string }) => {
          logger.info(`Runner success: sessionId=${data?.sessionId}`)
          this.sessionEmitter.emit(`session:${data?.sessionId}`, {
            type: 'success',
            sessionId: data?.sessionId,
            message: data?.message,
          } satisfies RunRunnerEvent)
        }
      )

      socket.on(
        'runRunnerFail',
        (data: { sessionId: string; message?: string }) => {
          logger.warn(
            `Runner fail: sessionId=${data?.sessionId} message=${data?.message}`
          )
          this.sessionEmitter.emit(`session:${data?.sessionId}`, {
            type: 'fail',
            sessionId: data?.sessionId,
            message: data?.message,
          } satisfies RunRunnerEvent)
        }
      )

      // ── systemInfo 响应 ────────────────────────────────────────────────────
      socket.on(
        'systemInfoResult',
        (data: { requestId: string; info?: string; error?: string }) => {
          this.sessionEmitter.emit(`req:${data?.requestId}`, data)
        }
      )

      // ── shell 响应 ─────────────────────────────────────────────────────────
      socket.on(
        'shellResult',
        (data: {
          requestId: string
          output?: string
          exitCode?: number
          error?: string
        }) => {
          this.sessionEmitter.emit(`req:${data?.requestId}`, data)
        }
      )

      // ── fileRead 响应 ──────────────────────────────────────────────────────
      socket.on(
        'fileReadResult',
        (data: { requestId: string; content?: string; error?: string }) => {
          this.sessionEmitter.emit(`req:${data?.requestId}`, data)
        }
      )

      // ── fileWrite 响应 ─────────────────────────────────────────────────────
      socket.on(
        'fileWriteResult',
        (data: { requestId: string; error?: string }) => {
          this.sessionEmitter.emit(`req:${data?.requestId}`, data)
        }
      )

      // ── grep 响应 ──────────────────────────────────────────────────────────
      socket.on(
        'grepResult',
        (data: { requestId: string; output?: string; error?: string }) => {
          this.sessionEmitter.emit(`req:${data?.requestId}`, data)
        }
      )

      socket.on('disconnect', () => {
        this._handleDisconnect(socket.id)
      })
    })
  }

  private _handleDisconnect(socketId: string): void {
    const runtimeId = this.socketRuntime.get(socketId)
    if (runtimeId === undefined) return

    logger.info(`Runtime disconnected: id=${runtimeId} socketId=${socketId}`)
    this.socketRuntime.delete(socketId)
    this.runtimeSocket.delete(runtimeId)
    this.untrackConnection(socketId)

    clawDb.setRuntimeStatus(runtimeId, 'offline')
    const disconnectedRuntime = clawDb.findRuntimeById(runtimeId)
    if (disconnectedRuntime) {
      clawEventBus.emit('runtime:disconnected', {
        runtimeId,
        runtimeTitle: disconnectedRuntime.title,
      })
    }
  }

  /** 向指定 runtime 下发 runRunner 任务 */
  sendExecute(
    runtimeId: number,
    payload: {
      sessionId: string
      name: string
      prompt: string
      sessionContinueId?: string
      cwd?: string
    }
  ): boolean {
    const socketId = this.runtimeSocket.get(runtimeId)
    if (!socketId) return false
    this.io.to(socketId).emit('runRunner', payload)
    return true
  }

  /** 请求指定 runtime 重新上报 runner 列表 */
  requestSync(runtimeId: number): boolean {
    const socketId = this.runtimeSocket.get(runtimeId)
    if (!socketId) return false
    this.io.to(socketId).emit('syncRunner', {})
    return true
  }

  /**
   * 监听某个 session 的事件流，直到 success 或 fail。
   * @param sessionId  会话 ID
   * @param onEvent    每个事件的回调
   * @param timeoutMs  超时毫秒数（默认 5min）
   */
  waitForSession(
    sessionId: string,
    onEvent: (event: RunRunnerEvent) => void,
    timeoutMs = 5 * 60_000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const key = `session:${sessionId}`
      let timer: ReturnType<typeof setTimeout> | null = null

      const cleanup = () => {
        if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
        this.sessionEmitter.removeListener(key, handler)
      }

      // eslint-disable-next-line prefer-const
      let handler: (event: RunRunnerEvent) => void
      handler = (event: RunRunnerEvent) => {
        onEvent(event)
        if (event.type === 'success' || event.type === 'fail') {
          cleanup()
          if (event.type === 'success') resolve()
          else reject(new Error(event.message ?? 'Runner run failed'))
        }
      }

      this.sessionEmitter.on(key, handler)

      timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Session ${sessionId} timed out`))
      }, timeoutMs)
    })
  }

  /** 向指定 runtime 发送通用消息（供服务端其他模块调用） */
  sendToRuntime(runtimeId: number, event: string, data: unknown): boolean {
    const socketId = this.runtimeSocket.get(runtimeId)
    if (!socketId) return false
    this.io.to(socketId).emit(event, data)
    return true
  }

  /**
   * 向指定 session 的事件监听器注入一个事件（供 LocalRuntimeController 使用）
   * 本机执行时，直接通过此方法将 runRunnerTool() 的进度注入到 waitForSession() 的回调中
   */
  emitSessionEvent(sessionId: string, event: RunRunnerEvent): void {
    this.sessionEmitter.emit(`session:${sessionId}`, event)
  }

  /** 检查指定 runtime 是否在线 */
  isOnline(runtimeId: number): boolean {
    return this.runtimeSocket.has(runtimeId)
  }

  /** 向指定运行环境请求系统信息，等待响应 */
  async requestSystemInfo(
    runtimeId: number,
    timeoutMs = 15_000
  ): Promise<{ info?: string; error?: string }> {
    const requestId = randomUUID()
    const socketId = this.runtimeSocket.get(runtimeId)
    if (!socketId) return { error: 'Runtime is offline' }

    return new Promise((resolve) => {
      const key = `req:${requestId}`
      const timer = setTimeout(() => {
        this.sessionEmitter.removeListener(key, handler)
        resolve({ error: 'Request timed out' })
      }, timeoutMs)

      const handler = (data: { info?: string; error?: string }) => {
        clearTimeout(timer)
        this.sessionEmitter.removeListener(key, handler)
        resolve(data)
      }
      this.sessionEmitter.once(key, handler)
      this.io.to(socketId).emit('systemInfoRequest', { requestId })
    })
  }

  /** 向指定运行环境发送 shell 命令，等待响应 */
  async requestShell(
    runtimeId: number,
    command: string,
    cwd: string | undefined,
    timeoutMs = 60_000
  ): Promise<{ output?: string; exitCode?: number; error?: string }> {
    const requestId = randomUUID()
    const socketId = this.runtimeSocket.get(runtimeId)
    if (!socketId) return { error: 'Runtime is offline' }

    return new Promise((resolve) => {
      const key = `req:${requestId}`
      const timer = setTimeout(() => {
        this.sessionEmitter.removeListener(key, handler)
        resolve({ error: 'Request timed out' })
      }, timeoutMs)

      const handler = (data: {
        output?: string
        exitCode?: number
        error?: string
      }) => {
        clearTimeout(timer)
        this.sessionEmitter.removeListener(key, handler)
        resolve(data)
      }
      this.sessionEmitter.once(key, handler)
      this.io.to(socketId).emit('shellRequest', { requestId, command, cwd })
    })
  }

  /** 向指定运行环境请求读取文件内容 */
  async requestFileRead(
    runtimeId: number,
    path: string,
    opts: { startLine?: number; endLine?: number; maxLimits?: number } = {},
    timeoutMs = 30_000
  ): Promise<{ content?: string; error?: string }> {
    const requestId = randomUUID()
    const socketId = this.runtimeSocket.get(runtimeId)
    if (!socketId) return { error: 'Runtime is offline' }

    return new Promise((resolve) => {
      const key = `req:${requestId}`
      const timer = setTimeout(() => {
        this.sessionEmitter.removeListener(key, handler)
        resolve({ error: 'Request timed out' })
      }, timeoutMs)

      const handler = (data: { content?: string; error?: string }) => {
        clearTimeout(timer)
        this.sessionEmitter.removeListener(key, handler)
        resolve(data)
      }
      this.sessionEmitter.once(key, handler)
      this.io.to(socketId).emit('fileReadRequest', { requestId, path, ...opts })
    })
  }

  /** 向指定运行环境请求写入文件内容 */
  async requestFileWrite(
    runtimeId: number,
    path: string,
    content: string,
    append: boolean,
    timeoutMs = 30_000
  ): Promise<{ error?: string }> {
    const requestId = randomUUID()
    const socketId = this.runtimeSocket.get(runtimeId)
    if (!socketId) return { error: 'Runtime is offline' }

    return new Promise((resolve) => {
      const key = `req:${requestId}`
      const timer = setTimeout(() => {
        this.sessionEmitter.removeListener(key, handler)
        resolve({ error: 'Request timed out' })
      }, timeoutMs)

      const handler = (data: { error?: string }) => {
        clearTimeout(timer)
        this.sessionEmitter.removeListener(key, handler)
        resolve(data)
      }
      this.sessionEmitter.once(key, handler)
      this.io
        .to(socketId)
        .emit('fileWriteRequest', { requestId, path, content, append })
    })
  }

  /** 向指定运行环境发送 grep 搜索请求，等待响应 */
  async requestGrep(
    runtimeId: number,
    pattern: string,
    path: string,
    opts: { recursive?: boolean; ignoreCase?: boolean; include?: string } = {},
    timeoutMs = 30_000
  ): Promise<{ output?: string; error?: string }> {
    const requestId = randomUUID()
    const socketId = this.runtimeSocket.get(runtimeId)
    if (!socketId) return { error: 'Runtime is offline' }

    return new Promise((resolve) => {
      const key = `req:${requestId}`
      const timer = setTimeout(() => {
        this.sessionEmitter.removeListener(key, handler)
        resolve({ error: 'Request timed out' })
      }, timeoutMs)

      const handler = (data: { output?: string; error?: string }) => {
        clearTimeout(timer)
        this.sessionEmitter.removeListener(key, handler)
        resolve(data)
      }
      this.sessionEmitter.once(key, handler)
      this.io
        .to(socketId)
        .emit('grepRequest', { requestId, pattern, path, ...opts })
    })
  }

  getStats(): { runtimeConnections: number } {
    return { runtimeConnections: this.runtimeSocket.size }
  }
}
