/**
 * SessionManager — 管理每个用户+Agent+Channel 的"当前会话 ID"。
 *
 * key 格式: `${tenantId}:${userId}:${agentId}:${channelId}`
 * channelId = 0 表示 web 渠道或无特定渠道；非零为实际渠道 ID（Telegram 等）。
 *
 * 所有 channel adapter 在 emit message:incoming 之前，必须先调用 resolveIncomingSession()
 * 完成 session 的创建/切换，确保 sessionId 始终非零。
 */

import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import { modelCall } from '../../../backend/src/model/model/index.js'
import { getModelConfigList } from '../../../backend/src/config/index.js'
import type { AgentSessionRow as ChatSessionRow } from './store/agentSession.js'
import { clawDb } from './store/index.js'

const logger = createLogger('session-manager')

/** 内存中记录用户当前会话，key = `${tenantId}:${userId}:${agentId}:${channelId}` */
const currentSessionMap = new Map<string, number>()

function makeKey(
  tenantId: number,
  userId: number,
  agentId: number,
  channelId: number
): string {
  return `${tenantId}:${userId}:${agentId}:${channelId}`
}

/**
 * 创建一个新会话，设置为当前会话并返回 ID。
 * @param title 会话标题；若为空且提供了 text 则异步调用 LLM 生成标题
 * @param text  首条消息内容，用于触发 LLM 标题提取（title 为空时有效）
 */
export function createNewSession(
  tenantId: number,
  userId: number,
  agentId: number,
  channelId: number,
  title = '',
  text?: string
): number {
  const key = makeKey(tenantId, userId, agentId, channelId)
  const session = clawDb.insertChatSession({ tenantId, userId, agentId, title })
  currentSessionMap.set(key, session.id)
  logger.debug(
    { sessionId: session.id, agentId, userId, channelId },
    'New session created'
  )
  if (!title && text) {
    _generateSessionTitleAsync(session.id, text, tenantId, userId)
  }
  return session.id
}

/**
 * 获取当前会话 ID。如果不存在则自动创建一个新会话并返回。
 */
export function getOrCreateCurrentSession(
  tenantId: number,
  userId: number,
  agentId: number,
  channelId: number,
  text?: string
): number {
  const key = makeKey(tenantId, userId, agentId, channelId)
  const existing = currentSessionMap.get(key)
  if (existing) return existing
  return createNewSession(tenantId, userId, agentId, channelId, '', text)
}

/**
 * 切换到指定会话 ID（用于 /session <id> 命令）。
 * 若 session 不存在或不属于该用户则返回 false。
 */
export function switchSession(
  tenantId: number,
  userId: number,
  agentId: number,
  channelId: number,
  sessionId: number
): boolean {
  const row = clawDb.findChatSessionById(sessionId)
  if (
    !row ||
    row.tenant_id !== tenantId ||
    row.user_id !== userId ||
    row.agent_id !== agentId
  ) {
    return false
  }
  const key = makeKey(tenantId, userId, agentId, channelId)
  currentSessionMap.set(key, sessionId)
  logger.debug({ sessionId, agentId, userId, channelId }, 'Session switched')
  return true
}

/**
 * 获取当前会话 ID，若无则返回 0（不自动创建）。
 */
export function getCurrentSession(
  tenantId: number,
  userId: number,
  agentId: number,
  channelId: number
): number {
  return (
    currentSessionMap.get(makeKey(tenantId, userId, agentId, channelId)) ?? 0
  )
}

/**
 * 清除某用户 agent 的当前会话（不删除 DB 记录）。
 */
export function clearCurrentSession(
  tenantId: number,
  userId: number,
  agentId: number,
  channelId: number
): void {
  currentSessionMap.delete(makeKey(tenantId, userId, agentId, channelId))
}

/**
 * 列出某用户 agent 的所有会话（从数据库查询）。
 */
export function listSessionsForUser(
  tenantId: number,
  userId: number,
  agentId: number
): ReturnType<typeof clawDb.listChatSessions> {
  return clawDb.listChatSessions(tenantId, userId, agentId)
}

// ─── 统一会话命令处理 ─────────────────────────────────────────────────────────

export type SessionCommandResult =
  | { type: 'new'; sessionId: number }
  | { type: 'switch'; sessionId: number }
  | { type: 'list'; sessions: ChatSessionRow[] }
  | { type: 'error'; message: string }
  | { type: 'none' }

/**
 * 处理会话命令（/new、/session、/session <id>）。
 * 包含会话创建/切换和 session:clear 事件发送，供所有渠道统一调用。
 * 返回结果类型，由各渠道自行处理响应输出。
 */
export function processSessionCommand(
  text: string,
  tenantId: number,
  userId: number,
  agentId: number,
  channelId: number
): SessionCommandResult {
  if (text.trim() === '/new') {
    const sessionId = createNewSession(tenantId, userId, agentId, channelId)
    void clawEventBus.emit('session:clear', { agentId, sessionId })
    return { type: 'new', sessionId }
  }

  const sessionMatch = text.trim().match(/^\/session(?:\s+(\d+))?$/)
  if (sessionMatch) {
    const arg = sessionMatch[1]
    if (!arg) {
      const sessions = listSessionsForUser(tenantId, userId, agentId)
      return { type: 'list', sessions }
    }
    const targetId = parseInt(arg, 10)
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return { type: 'error', message: '请输入有效的会话 ID，例如：/session 5' }
    }
    const ok = switchSession(tenantId, userId, agentId, channelId, targetId)
    if (!ok) {
      return { type: 'error', message: `找不到会话 ID: ${targetId}` }
    }
    void clawEventBus.emit('session:clear', { agentId, sessionId: targetId })
    return { type: 'switch', sessionId: targetId }
  }

  return { type: 'none' }
}

// ─── 统一消息入口：session 解析 ───────────────────────────────────────────────

export interface ResolveSessionContext {
  tenantId: number
  userId: number
  agentId: number
  /** channelId = 0 表示 web 渠道或无特定渠道；非零为实际渠道 ID */
  channelId: number
  /** 消息文本，用于检测 session 命令及 LLM 标题生成 */
  text?: string
}

export interface ResolveSessionResult {
  /** 保证 > 0 */
  sessionId: number
  isNew: boolean
  /** true 表示本条消息是 session 命令，调用方不应 emit message:incoming */
  isCommand: boolean
  commandResult?: SessionCommandResult
}

/**
 * 在 emit message:incoming 之前统一调用，完成以下处理：
 * 1. 若 text 是 session 命令（/new、/session）→ 执行命令，返回 isCommand=true
 * 2. 否则 → 确保当前 session 存在（不存在则新建），返回 isCommand=false
 *
 * 返回的 sessionId 保证 > 0。
 * Session 变更通知由各 channel 自行处理（无需事件总线）。
 */
export function resolveIncomingSession(
  ctx: ResolveSessionContext
): ResolveSessionResult {
  const { tenantId, userId, agentId, channelId, text = '' } = ctx

  // ── 检测 session 命令 ──
  const trimmed = text.trim()
  const isSessionCmd =
    trimmed === '/new' || /^\/session(\s+\d+)?$/.test(trimmed)

  if (isSessionCmd) {
    const commandResult = processSessionCommand(
      trimmed,
      tenantId,
      userId,
      agentId,
      channelId
    )
    const sessionId =
      commandResult.type === 'new' || commandResult.type === 'switch'
        ? commandResult.sessionId
        : getCurrentSession(tenantId, userId, agentId, channelId)
    return {
      sessionId: sessionId > 0 ? sessionId : 0,
      isNew: commandResult.type === 'new',
      isCommand: true,
      commandResult,
    }
  }

  // ── 普通消息：确保 session 存在 ──
  const key = makeKey(tenantId, userId, agentId, channelId)
  const existing = currentSessionMap.get(key)
  if (existing) {
    return { sessionId: existing, isNew: false, isCommand: false }
  }

  // 新建 session
  const sessionId = createNewSession(
    tenantId,
    userId,
    agentId,
    channelId,
    '',
    text || undefined
  )
  return { sessionId, isNew: true, isCommand: false }
}

// ─── LLM 标题生成（fire-and-forget）─────────────────────────────────────────

function _generateSessionTitleAsync(
  sessionId: number,
  text: string,
  tenantId: number,
  userId: number
): void {
  getModelConfigList(userId, tenantId, 'default')
    .then((modelConfigList) => {
      return modelCall({
        tenantId,
        userId,
        biz: 'Session',
        bizId: String(sessionId),
        modelConfigList,
        systemPrompt:
          '你是会话标题生成助手。根据用户首条消息，生成一个简洁的会话标题（不超过20个字）。只返回标题文字，不加引号或其他说明。',
        userPrompt: text.slice(0, 500),
        temperature: 0.3,
        maxRetry: 1,
      })
    })
    .then((result) => {
      const title =
        result.type === 'text' ? result.content.trim().slice(0, 50) : ''
      if (title) {
        clawDb.updateChatSession(sessionId, { title })
        logger.debug({ sessionId, title }, 'Session title generated')
      }
    })
    .catch((err) => {
      logger.warn({ err, sessionId }, 'Failed to generate session title')
    })
}
