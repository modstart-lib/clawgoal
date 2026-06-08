/**
 * Web Channel Adapter
 *
 * 处理所有 Web 前端 socket.io 通信，挂载在 AgentWebsocketService (channel/web/server.ts)。
 *
 * 消息流（非阻塞事件驱动）：
 *   1. Client → sendMsg
 *   2. Adapter 立即响应 sendMsgSuccess；同时发出 message:incoming 事件
 *   3. gateway 接收事件，创建 session（若未提供），启动 Agent 循环
 *   4. agentLog 持久化用户消息，发出 message:accepted → sendMsgAck { messageId, sessionId }
 *   5. tool:start / tool:end / tool:progress → 实时推送 stageItems（progressId 恒定，前端原地更新）
 *   6. message:outgoing (correlationId 匹配) → 广播 assistant 回复，清理 in-flight 条目
 *
 * Web 渠道特殊性：镜像显示所有其他渠道（Telegram 等）的消息；支持切换 session。
 * Session 生命周期由 gateway 统一管理，渠道层不直接写 DB。
 */

import type { Server, Socket } from 'socket.io'
import { generateId } from '../../../../backend/src/utils/utils.js'
import { config } from '../../../../backend/src/config/index.js'
import { agentManager } from '../../agent/index.js'
import {
  clawEventBus,
  type MessageAcceptedEvent,
  type IncomingMessageEvent,
  type MaxRoundsReachedEvent,
  type OutgoingMessageEvent,
  type ToolEndEvent,
  type ToolProgressEvent,
  type ToolStartEvent,
  type AsksAnsweredEvent,
} from '../../kernel/eventBus.js'
import { createLogger } from '../../kernel/logger.js'
import { clawDb } from '../../storage/store/index.js'
import type { AgentMessageContent } from '../../storage/store/types.js'
import { clawMessage } from '../../types/index.js'
import {
  processSessionCommand,
  resolveIncomingSession,
} from '../../storage/sessionManager.js'

const logger = createLogger('web-channel')

function nowTs(): string {
  return String(Date.now())
}

function parseAgentId(v: unknown): number {
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? n : 0
}

// ─── Per in-flight request ─────────────────────────────────────────────────

interface InFlightRequest {
  socketId: string
  agentId: number
  userId: number
  /** Session this request belongs to (0 = unknown until resolved) */
  sessionId: number
  /** Original user text — used for progress display */
  userText: string
}

export class WebChannelAdapter {
  private io!: Server
  /** agentId → Set<socketId> */
  private agentSubs = new Map<number, Set<string>>()
  /** socketId → agentId */
  private socketAgent = new Map<string, number>()
  private unsubscribers: Array<() => void> = []
  /** correlationId → active in-flight request */
  private _inFlightMap = new Map<string, InFlightRequest>()
  /** agentId → correlationId of the CURRENT active (most recently sent) request.
   * Used to route workflow tool events (chatId=0) to the correct session. */
  private _agentActiveCorrelation = new Map<number, string>()
  /** Non-web channel: `agentId:toolCallId` → { title, meta } for tool:end broadcast */
  private _channelToolInfo = new Map<
    string,
    { title: string; meta: Record<string, any> }
  >()

  private _requireSocketAuth(
    socket: Socket,
    requestId?: string
  ): { userId: number; tenantId: number } | null {
    const userId = Number(socket.data.userId as string | number)
    const tenantId = Number(socket.data.tenantId as string | number)
    if (userId <= 0) {
      if (requestId)
        socket.emit('message', {
          id: requestId,
          type: 'error',
          msg: 'Unauthorized',
        })
      return null
    }
    if (tenantId <= 0) {
      if (requestId)
        socket.emit('message', {
          id: requestId,
          type: 'error',
          msg: 'Unauthorized',
        })
      return null
    }
    return { userId, tenantId }
  }

  initialize(io: Server): void {
    this.io = io
    this._listenEventBus()
    logger.info('WebChannelAdapter initialized')
  }

  // ─── Socket connection handler ───────────────────────────────────────────

  /** Called by AgentWebsocketService for each new socket connection (after auth binding) */
  handleConnection(socket: Socket): void {
    logger.debug({ socketId: socket.id }, 'web_client_connected')
    socket.on('message', async (msg: any) => {
      await this.handleMessage(socket, msg)
    })
    socket.on('disconnect', () => {
      this.handleDisconnect(socket.id)
      logger.debug({ socketId: socket.id }, 'web_client_disconnected')
    })
  }

  /** Handle a single message frame — called by AgentWebsocketService after auth is confirmed */
  handleMessage(socket: Socket, msg: any): void {
    try {
      const { id, type, data } = msg ?? {}
      switch (type) {
        case 'subscribe':
          this._handleSubscribe(socket, data?.agentId)
          break
        case 'sendMsg':
          this._handleSendMsg(socket, data, id)
          break
        case 'history':
          this._handleHistory(socket, data, id)
          break
        case 'clearMsgs':
          this._handleClearMsgs(socket, data, id)
          break
        case 'newSession':
          this._handleNewSession(socket, data, id)
          break
        default:
          logger.warn({ type }, 'Unknown web channel message type')
      }
    } catch (err) {
      logger.error({ err }, 'web_channel_error')
      socket.emit('message', {
        id: generateId(),
        type: 'error',
        msg: String(err),
      })
    }
  }

  /** Called when a socket disconnects */
  handleDisconnect(socketId: string): void {
    this._cleanupSocket(socketId)
  }

  private _listenEventBus(): void {
    /** Resolve which subscribed agentId to broadcast to (falls back to supervisor) */
    const resolveSubId = (agentId: number): number => {
      if (this.agentSubs.has(agentId)) return agentId
      const sup = agentManager
        .listAll()
        .find((m) => m.roleName === 'supervisor')
      if (sup && this.agentSubs.has(sup.id)) return sup.id
      return -1
    }

    // ── Non-web channel incoming: mirror user messages to web subscribers ──

    const onIncoming = (evt: IncomingMessageEvent) => {
      if (evt.source === 'web') return
      const agentId = resolveSubId(evt.agentId)
      if (agentId === -1) return
      const content: AgentMessageContent = {
        role: 'user',
        text: evt.content.text ?? undefined,
        images: evt.content.image?.url ? [evt.content.image.url] : undefined,
        source: 'channel',
        timestamp: nowTs(),
      }
      this._broadcast(agentId, 'msg', {
        id: generateId(),
        role: 'user',
        content,
      })
    }

    // ── Non-web channel outgoing: mirror assistant replies to web subscribers ──
    // Also handles web-source outgoing without correlationId (e.g. asks tool from workflow session)

    const onOutgoing = (evt: OutgoingMessageEvent) => {
      // Skip normal web replies — they are handled by onWebOutgoing via correlationId
      if (evt.source === 'web' && evt.correlationId) return
      const agentId = resolveSubId(evt.agentId)
      if (agentId === -1) return
      // Channel tool messages are already broadcast as independent messages; no finalization needed.
      // Use dbContent if available (preserves asks/stageItems/actionView fields)
      const broadcastContent: AgentMessageContent = evt.dbContent ?? {
        role: 'assistant',
        text: evt.content.text ?? undefined,
        source: evt.source ?? 'channel',
        timestamp: nowTs(),
      }
      this._broadcast(agentId, 'msg', {
        id: evt.msgId ?? generateId(),
        role: 'assistant',
        content: broadcastContent,
      })
    }

    // ── Tool events: each call = one independent broadcast message ──

    const onChannelToolStart = (evt: ToolStartEvent) => {
      if (evt.chatId === 0) return
      const agentId = resolveSubId(evt.agentId)
      if (agentId === -1) return
      const action =
        typeof evt.params?.['action'] === 'string'
          ? (evt.params['action'] as string)
          : undefined
      const reasoning =
        typeof evt.params?.['reasoning'] === 'string'
          ? (evt.params['reasoning'] as string)
          : undefined
      const detail: Record<string, unknown> = { ...(evt.params ?? {}) }
      if (reasoning) delete detail['reasoning']
      const label = action ? `${evt.toolName}.${action}` : evt.toolName
      const title = reasoning || label
      const toolMeta: Record<string, any> = {
        toolCallId: evt.toolCallId,
        toolName: evt.toolName,
        label,
      }
      if (Object.keys(detail).length > 0)
        toolMeta.detail = JSON.stringify(detail)
      // 用 toolCallId 作为消息 ID，tool:end 时直接用同一 ID 更新，无需内存映射
      this._channelToolInfo.set(`${evt.agentId}:${evt.toolCallId}`, {
        title,
        meta: toolMeta,
      })
      this._broadcast(agentId, 'msg', {
        id: evt.toolCallId,
        role: 'assistant',
        content: {
          role: 'assistant',
          stage: { title, status: 'running' },
          meta: toolMeta,
          source: 'channel',
          timestamp: nowTs(),
        } as AgentMessageContent,
      })
    }

    const onChannelToolEnd = (evt: ToolEndEvent) => {
      if (evt.chatId === 0) return
      const agentId = resolveSubId(evt.agentId)
      if (agentId === -1) return
      const key = `${evt.agentId}:${evt.toolCallId}`
      const info = this._channelToolInfo.get(key)
      this._channelToolInfo.delete(key)
      // toolCallId 即消息 ID，直接广播更新
      this._broadcast(agentId, 'msg', {
        id: evt.toolCallId,
        role: 'assistant',
        content: {
          role: 'assistant',
          stage: {
            title: info?.title ?? evt.toolName,
            status: evt.success ? 'success' : 'error',
            success: evt.success ? (evt.result ?? undefined) : undefined,
            error: evt.success ? undefined : (evt.result ?? undefined),
          },
          meta: info?.meta,
          source: 'channel',
          timestamp: nowTs(),
        } as AgentMessageContent,
      })
    }

    const onChannelToolProgress = (_evt: ToolProgressEvent) => {
      // progress logs are stored in claw_agent_tool.logs only; no broadcast needed
    }

    // ── Web tool events: each call = one independent broadcast message ──

    const onWebToolStart = (evt: ToolStartEvent) => {
      if (evt.chatId !== 0) return
      const correlationId = this._agentActiveCorrelation.get(evt.agentId)
      if (!correlationId) return
      const req = this._inFlightMap.get(correlationId)
      if (!req || req.agentId !== evt.agentId) return
      const action =
        typeof evt.params?.['action'] === 'string'
          ? (evt.params['action'] as string)
          : undefined
      const reasoning =
        typeof evt.params?.['reasoning'] === 'string'
          ? (evt.params['reasoning'] as string)
          : undefined
      const detail: Record<string, unknown> = { ...(evt.params ?? {}) }
      if (reasoning) delete detail['reasoning']
      const label = action ? `${evt.toolName}.${action}` : evt.toolName
      const title = reasoning || label
      const toolMeta: Record<string, any> = {
        toolCallId: evt.toolCallId,
        toolName: evt.toolName,
        label,
      }
      if (Object.keys(detail).length > 0)
        toolMeta.detail = JSON.stringify(detail)
      // 用 toolCallId 作为消息 ID，tool:end 时直接用同一 ID 更新，无需内存映射
      this._broadcast(req.agentId, 'msg', {
        id: evt.toolCallId,
        role: 'assistant',
        content: {
          role: 'assistant',
          stage: { title, status: 'running' },
          meta: toolMeta,
          source: 'web',
          timestamp: nowTs(),
        } as AgentMessageContent,
      })
    }

    const onWebToolEnd = (evt: ToolEndEvent) => {
      if (evt.chatId !== 0) return
      const correlationId = this._agentActiveCorrelation.get(evt.agentId)
      if (!correlationId) return
      const req = this._inFlightMap.get(correlationId)
      if (!req || req.agentId !== evt.agentId) return
      // toolCallId 即消息 ID，直接广播更新
      this._broadcast(req.agentId, 'msg', {
        id: evt.toolCallId,
        role: 'assistant',
        content: {
          role: 'assistant',
          stage: {
            title: evt.toolName,
            status: evt.success ? 'success' : 'error',
            success: evt.success ? (evt.result ?? undefined) : undefined,
            error: evt.success ? undefined : (evt.result ?? undefined),
          },
          source: 'web',
          timestamp: nowTs(),
        } as AgentMessageContent,
      })
    }

    const onWebToolProgress = (_evt: ToolProgressEvent) => {
      // progress logs are stored in claw_agent_tool.logs only; no broadcast needed
    }

    // ── message:accepted: send real DB ID to the initiating client ──

    const onMessageAccepted = (evt: MessageAcceptedEvent) => {
      const req = this._inFlightMap.get(evt.correlationId)
      if (!req) return
      this.io.to(req.socketId).emit('message', {
        id: generateId(),
        type: 'sendMsgAck',
        data: {
          correlationId: evt.correlationId,
          messageId: evt.messageId,
          sessionId: evt.sessionId,
        },
      })
    }

    // ── message:outgoing (web source, has correlationId): resolve in-flight request ──

    const onWebOutgoing = (evt: OutgoingMessageEvent) => {
      if (evt.source !== 'web' || !evt.correlationId) return
      const req = this._inFlightMap.get(evt.correlationId)
      if (!req) return
      this._resolveInFlight(evt.correlationId, req, evt.content.text ?? '')
    }

    // ── agent:maxRoundsReached: resolve any web in-flight for this agent ──

    const onMaxRoundsReached = (evt: MaxRoundsReachedEvent) => {
      const activeCorrelationId = this._agentActiveCorrelation.get(evt.agentId)
      if (activeCorrelationId) {
        this._inFlightMap.delete(activeCorrelationId)
        this._agentActiveCorrelation.delete(evt.agentId)
      }
      const agentId = resolveSubId(evt.agentId)
      if (agentId === -1) return
      const agent = agentManager.get(evt.agentId)
      import('../../../backend/src/locale/index.js')
        .then(({ getUserLang }) => {
          const userId = agent?.userId ?? 0
          const tenantId = agent?.tenantId ?? 0
          getUserLang(tenantId, userId)
            .then((lang) => {
              const isZh = lang !== 'en-US'
              this._broadcast(agentId, 'msg', {
                id: generateId(),
                role: 'assistant',
                content: {
                  role: 'assistant',
                  text: isZh
                    ? '已达到最大工具调用轮次，任务尚未完成。发送「继续运行」继续，或发送新消息重新开始。'
                    : 'Max tool call rounds reached, task not complete. Send "continue" to resume, or send a new message to restart.',
                  suggests: [{ text: isZh ? '继续运行' : 'Continue' }],
                  source: 'channel',
                  timestamp: nowTs(),
                } as AgentMessageContent,
              })
            })
            .catch(() => {})
        })
        .catch(() => {})
    }

    const onAsksAnswered = (evt: AsksAnsweredEvent) => {
      const agentId = resolveSubId(evt.agentId)
      if (agentId === -1) return
      this._broadcast(agentId, 'msg', {
        id: String(evt.msgId),
        role: 'assistant',
        content: evt.content,
      })
    }

    clawEventBus.on('message:incoming', onIncoming)
    clawEventBus.on('message:outgoing', onOutgoing)
    clawEventBus.on('message:outgoing', onWebOutgoing)
    clawEventBus.on('agent:maxRoundsReached', onMaxRoundsReached)
    clawEventBus.on('tool:start', onChannelToolStart)
    clawEventBus.on('tool:end', onChannelToolEnd)
    clawEventBus.on('tool:progress', onChannelToolProgress)
    clawEventBus.on('tool:start', onWebToolStart)
    clawEventBus.on('tool:end', onWebToolEnd)
    clawEventBus.on('tool:progress', onWebToolProgress)
    clawEventBus.on('message:accepted', onMessageAccepted)
    clawEventBus.on('asks:answered', onAsksAnswered)

    clawEventBus.on('message:accepted', onMessageAccepted)

    this.unsubscribers.push(() => {
      clawEventBus.off('message:incoming', onIncoming)
      clawEventBus.off('message:outgoing', onOutgoing)
      clawEventBus.off('message:outgoing', onWebOutgoing)
      clawEventBus.off('agent:maxRoundsReached', onMaxRoundsReached)
      clawEventBus.off('tool:start', onChannelToolStart)
      clawEventBus.off('tool:end', onChannelToolEnd)
      clawEventBus.off('tool:progress', onChannelToolProgress)
      clawEventBus.off('tool:start', onWebToolStart)
      clawEventBus.off('tool:end', onWebToolEnd)
      clawEventBus.off('tool:progress', onWebToolProgress)
      clawEventBus.off('message:accepted', onMessageAccepted)
      clawEventBus.off('asks:answered', onAsksAnswered)
    })
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /** Finalize a completed in-flight request: broadcast reply */
  private _resolveInFlight(
    correlationId: string,
    req: InFlightRequest,
    replyText: string
  ): void {
    this._inFlightMap.delete(correlationId)
    if (this._agentActiveCorrelation.get(req.agentId) === correlationId) {
      this._agentActiveCorrelation.delete(req.agentId)
    }
    this._broadcast(req.agentId, 'msg', {
      id: generateId(),
      role: 'assistant',
      content: {
        role: 'assistant',
        text: replyText,
        source: 'web',
        timestamp: nowTs(),
      } as AgentMessageContent,
    })
    // DB persistence（含 session 消息统计）由 agentLog.ts 通过 message:outgoing 事件统一处理
  }

  // ─── Subscribe ────────────────────────────────────────────────────────────

  private _handleSubscribe(socket: Socket, rawAgentId: unknown): void {
    const agentId = parseAgentId(rawAgentId)
    this._cleanupSocket(socket.id)
    if (!this.agentSubs.has(agentId)) this.agentSubs.set(agentId, new Set())
    this.agentSubs.get(agentId)!.add(socket.id)
    this.socketAgent.set(socket.id, agentId)
    socket.emit('message', {
      id: generateId(),
      type: 'subscribeSuccess',
      data: { agentId },
    })
    logger.debug({ socketId: socket.id, agentId }, 'subscribed')
  }

  // ─── Send Msg ─────────────────────────────────────────────────────────────

  private _handleSendMsg(socket: Socket, data: any, requestId: string): void {
    const auth = this._requireSocketAuth(socket, requestId)
    if (!auth) return

    const agentId = parseAgentId(data?.agentId)
    const text: string = String(data?.text ?? '').trim()
    if (!text) {
      socket.emit('message', {
        id: requestId,
        type: 'error',
        msg: 'Message cannot be empty',
      })
      return
    }

    const agent =
      agentId === 0
        ? (agentManager.listAll().find((w) => w.roleName === 'supervisor') ??
          agentManager.listAll()[0])
        : agentManager.get(agentId)
    if (!agent) {
      socket.emit('message', {
        id: requestId,
        type: 'error',
        msg:
          config.lang !== 'en-US'
            ? `Agent ${agentId} 不存在`
            : `Agent ${agentId} not found`,
      })
      return
    }

    const userSocketId = auth.userId
    const agentIdNum = agentId || agent.id || 0

    // ── Setup in-flight tracking ──
    const correlationId = generateId()
    const req: InFlightRequest = {
      socketId: socket.id,
      agentId: agentIdNum,
      userId: userSocketId,
      sessionId: 0, // filled in after session resolution below
      userText: text,
    }
    this._inFlightMap.set(correlationId, req)
    this._agentActiveCorrelation.set(agentIdNum, correlationId)
    socket.emit('message', {
      id: requestId,
      type: 'sendMsgSuccess',
      data: { correlationId },
    })

    // ── 在 emit message:incoming 前解析 session ──
    // 命令类消息直接在此处理响应，无需 emit message:incoming。
    const sessionResult = resolveIncomingSession({
      tenantId: auth.tenantId,
      userId: auth.userId,
      agentId: agentIdNum,
      channelId: 0,
      text,
    })

    if (sessionResult.isCommand) {
      // 命令类消息：清理 in-flight 并直接响应客户端
      this._inFlightMap.delete(correlationId)
      const cr = sessionResult.commandResult!
      if (cr.type === 'list') {
        socket.emit('message', {
          id: generateId(),
          type: 'sessionList',
          data: { sessions: cr.sessions },
        })
      } else if (cr.type === 'error') {
        socket.emit('message', {
          id: generateId(),
          type: 'error',
          msg: cr.message,
        })
      } else {
        // new / switch
        socket.emit('message', {
          id: generateId(),
          type:
            cr.type === 'new' ? 'newSessionSuccess' : 'switchSessionSuccess',
          data: { sessionId: sessionResult.sessionId },
        })
      }
      if (sessionResult.sessionId > 0) {
        this._broadcast(agentIdNum, 'sessionChanged', {
          sessionId: sessionResult.sessionId,
          isNew: sessionResult.isNew,
        })
      }
      return
    }

    // ── 新建 session 时通知客户端 ──
    // 填入 sessionId（session 已在此处确定）
    req.sessionId = sessionResult.sessionId
    if (sessionResult.isNew) {
      socket.emit('message', {
        id: generateId(),
        type: 'newSessionSuccess',
        data: { sessionId: sessionResult.sessionId },
      })
      this._broadcast(agentIdNum, 'sessionChanged', {
        sessionId: sessionResult.sessionId,
        isNew: true,
      })
    }

    // ── 在 session 确定后广播用户消息，避免 sessionChanged 清空消息时用户消息已丢失 ──
    this._broadcast(agentIdNum, 'msg', {
      id: correlationId,
      role: 'user',
      content: {
        role: 'user',
        text,
        source: 'web',
        timestamp: nowTs(),
      } as AgentMessageContent,
    })

    // ── 普通消息：fire-and-forget 到事件总线 ──
    clawEventBus.emit('message:incoming', {
      agentId: agentIdNum,
      chatId: 0,
      content: clawMessage.text(text),
      userId: auth.userId,
      messageId: 0,
      timestamp: new Date(),
      source: 'web',
      sessionId: sessionResult.sessionId,
      channelId: 0,
      correlationId,
    })
  }

  // ─── History ──────────────────────────────────────────────────────────────

  private _handleHistory(socket: Socket, data: any, requestId: string): void {
    const auth = this._requireSocketAuth(socket, requestId)
    if (!auth) return
    const agentId = parseAgentId(data?.agentId)
    const taskId: number = parseInt(String(data?.taskId ?? 0), 10) || 0
    const sessionId: number = parseInt(String(data?.sessionId ?? 0), 10) || 0
    const limit = Math.min(Number(data?.limit ?? 20), 100)
    const beforeId: number | undefined =
      data?.beforeId > 0 ? Number(data.beforeId) : undefined
    const { rows, hasMore } = clawDb.listAgentMessagesBefore(
      auth.tenantId,
      auth.userId,
      agentId,
      limit,
      beforeId,
      sessionId
    )
    const messages = rows.map((row) => ({
      id: String(row.id),
      role: row.role,
      content: row.content,
    }))
    const latestSessionId =
      rows.length > 0 ? rows[rows.length - 1].sessionId : 0
    socket.emit('message', {
      id: requestId,
      type: 'msgHistory',
      data: {
        agentId,
        taskId,
        messages,
        hasMore,
        beforeId: beforeId ?? null,
        sessionId: latestSessionId,
      },
    })
  }

  // ─── Clear Messages ───────────────────────────────────────────────────────

  private _handleClearMsgs(socket: Socket, data: any, requestId: string): void {
    const auth = this._requireSocketAuth(socket, requestId)
    if (!auth) return
    const agentId = parseAgentId(data?.agentId)
    const taskId: number = parseInt(String(data?.taskId ?? 0), 10) || 0
    const sessionId: number = parseInt(String(data?.sessionId ?? 0), 10) || 0
    clawDb.clearAgentMessages(auth.tenantId, auth.userId, agentId)
    clawEventBus.emit('session:clear', { agentId, sessionId })
    this._broadcast(agentId, 'msgsCleared', { agentId, taskId })
    socket.emit('message', { id: requestId, type: 'clearMsgsSuccess' })
    logger.debug({ agentId, taskId }, 'Messages cleared')
  }

  // ─── New Session ──────────────────────────────────────────────────────────

  private _handleNewSession(
    socket: Socket,
    data: any,
    requestId: string
  ): void {
    const auth = this._requireSocketAuth(socket, requestId)
    if (!auth) return
    const agentId = parseAgentId(data?.agentId)
    const taskId: number = parseInt(String(data?.taskId ?? 0), 10) || 0
    const newCmd = processSessionCommand(
      '/new',
      auth.tenantId,
      auth.userId,
      agentId || 0,
      0
    )
    const newSessionId = newCmd.type === 'new' ? newCmd.sessionId : 0
    this._broadcast(agentId, 'sessionChanged', {
      sessionId: newSessionId,
      isNew: true,
    })
    socket.emit('message', {
      id: requestId,
      type: 'newSessionSuccess',
      data: { sessionId: newSessionId },
    })
    logger.debug({ agentId, taskId, newSessionId }, 'New session started')
  }

  // ─── Broadcast helpers ────────────────────────────────────────────────────

  _broadcast(agentId: number, type: string, data: any): void {
    const sockets = this.agentSubs.get(agentId)
    if (!sockets || sockets.size === 0) return
    const payload = { id: generateId(), type, data }
    sockets.forEach((sid) => this.io.to(sid).emit('message', payload))
  }

  private _cleanupSocket(socketId: string): void {
    const prevAgentId = this.socketAgent.get(socketId)
    if (prevAgentId !== undefined) {
      this.agentSubs.get(prevAgentId)?.delete(socketId)
      this.socketAgent.delete(socketId)
    }
  }

  getStats(): { agentConnections: number } {
    let total = 0
    this.agentSubs.forEach((s) => {
      total += s.size
    })
    return { agentConnections: total }
  }

  destroy(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._inFlightMap.clear()
    logger.info('WebChannelAdapter destroyed')
  }
}
