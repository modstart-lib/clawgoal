/**
 * Model conversation manager for the bot system.
 * Implements the agentic loop: Model → tool call → tool result → Model → ...
 * Handles context management, tool dispatch, and memory logging.
 */

import type { BaseMessage } from '@langchain/core/messages'
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages'
import { getEncoding } from 'js-tiktoken'
import type pino from 'pino'
import type { ModelConfig } from '../../../backend/src/config'
import { getModelConfigList } from '../../../backend/src/config'
import { getUserLang } from '../../../backend/src/locale/index.js'
import {
  modelCall,
  resolveAgentModelListByRef,
} from '../../../backend/src/model/model'
import { buildSystemInfoPrompt } from '../../../backend/src/utils/env'
import { jsonStringify, logJson } from '../../../backend/src/utils/json.js'
import { getMemory, getSoul, getUser } from '../memory'
import {
  getTodayMemory,
  upsertMemory as upsertAgentDailyMemory,
} from '../memory/agentMemory.js'
import { toolRegistry } from '../tools'
import { agentManager } from '../agent/index.js'
import { clawDb } from '../storage/store/index.js'
import {
  type Agent,
  type AgentContext,
  type ClawMessage,
  clawMessage,
  type ModelRef,
  type ToolPermission,
} from '../types'
import { clawEventBus } from './eventBus.js'
import { createLogger } from './logger.js'
import { getAgentLogger } from '../utils/logger.js'
import { resolvePlaceholders } from './promptPlaceholders.js'
import { getAgentWorkspacePath } from './workspace.js'

const logger = createLogger('model')

/** Default maximum tool call rounds per user message (when not set in agent config) */
const DEFAULT_MAX_TOOL_ROUNDS = 20

/**
 * Sentinel string returned by processMessage when the agentic loop is paused due to maxToolRounds.
 * Callers (gateway, websocket) must NOT emit a message:outgoing for this value.
 */
export const MAX_ROUNDS_SENTINEL = '__MAX_ROUNDS_REACHED__' as const

/** Internal state saved when maxToolRounds is reached, keyed by `agentId:chatId` */
interface PendingRoundsState {
  agent: Agent
  chatId: number
  sessionId: number
  channelId?: number
  taskId?: number
  /** LangChain messages snapshot (history + user + intermediate tool turns) */
  appendMessages: BaseMessage[]
  modelConfigs: ModelConfig[]
  modelRef: ModelRef
  maxToolRounds: number
  allowedTools: ToolPermission[]
  allowedMcps: string[]
  /** Original inbound message — used to update the session cache when done */
  content: ClawMessage
  userText: string
  /** Reserved for future use */
}

/** Pending agentic-loop states keyed by `agentId:chatId` */
const pendingRoundsMap = new Map<string, PendingRoundsState>()

/** Returns true when an agent+chat has a paused agentic loop waiting to be continued */
export function hasPendingRounds(agentId: number, chatId: number): boolean {
  return pendingRoundsMap.has(`${agentId}:${chatId}`)
}

/**
 * Sentinel string returned by processMessage when the loop was aborted by the user.
 */
export const ABORT_SENTINEL = '__ABORT__' as const

/**
 * Sentinel string returned by processMessage when the asks tool paused the loop.
 * Callers (dispatcher) must NOT overwrite the task status when this is returned
 * (the asks tool already set it to 'asking').
 */
export const ASKS_SENTINEL = '__ASKS_WAITING__' as const

/** Pending agentic-loop state saved when the asks tool pauses execution, keyed by taskId */
interface PendingAsksState {
  agent: Agent
  chatId: number
  sessionId: number
  channelId?: number
  appendMessages: BaseMessage[]
  modelConfigs: ModelConfig[]
  modelRef: ModelRef
  maxToolRounds: number
  allowedTools: ToolPermission[]
  allowedMcps: string[]
  content: ClawMessage
  userText: string
}

/** Retrieve and remove the pending asks state for a session (used by dispatcher on resume).
 * First checks DB (survives restarts); if found, reconstructs PendingAsksState. */
export function popPendingAsksState(
  sessionId: number
): PendingAsksState | undefined {
  const row = clawDb.popAgentic(sessionId)
  if (!row) return undefined

  try {
    const d = JSON.parse(row.agentic_data ?? 'null')
    if (!d) return undefined
    const agent = agentManager.get(d.agentId)
    if (!agent) {
      logger.warn(`popPendingAsksState: agent id=${d.agentId} not found`)
      return undefined
    }
    return {
      agent,
      chatId: d.chatId,
      sessionId: row.id,
      channelId: d.channelId ?? undefined,
      appendMessages: deserializeMessages(d.messages),
      modelConfigs: d.modelConfigs,
      modelRef: d.modelRef,
      maxToolRounds: d.maxToolRounds,
      allowedTools: d.allowedTools,
      allowedMcps: d.allowedMcps,
      content: d.content,
      userText: d.userText,
    }
  } catch (e) {
    logger.error(
      { sessionId, e },
      'popPendingAsksState: failed to deserialize state'
    )
    return undefined
  }
}

/** Tracks which agentId:chatId loops are currently executing */
const processingMap = new Map<string, boolean>()
/** Abort requests keyed by `agentId:chatId` */
const abortMap = new Map<string, boolean>()

/** Workflow-level running flag keyed by `agentId:chatId` — spans entire _runGraph duration */
const workflowProcessingMap = new Map<string, boolean>()
/** Workflow cancel callbacks keyed by `agentId:chatId` */
const workflowCancelMap = new Map<string, () => void>()

/** Mark a workflow as running (called before workflowExecute in _runGraph) */
export function setWorkflowProcessing(agentId: number, chatId: number): void {
  workflowProcessingMap.set(`${agentId}:${chatId}`, true)
}

/** Clear workflow running state and cancel registration (called in finally of _runGraph) */
export function clearWorkflowProcessing(agentId: number, chatId: number): void {
  workflowProcessingMap.delete(`${agentId}:${chatId}`)
  workflowCancelMap.delete(`${agentId}:${chatId}`)
}

/** Register the workflow cancel function so abortAgentLoop can stop it immediately */
export function registerWorkflowCancel(
  agentId: number,
  chatId: number,
  cancelFn: () => void
): void {
  workflowCancelMap.set(`${agentId}:${chatId}`, cancelFn)
}

/** Returns true when an agentic loop is currently running for the given agent+chat */
export function isAgentLoopRunning(agentId: number, chatId: number): boolean {
  const key = `${agentId}:${chatId}`
  return (
    processingMap.get(key) === true || workflowProcessingMap.get(key) === true
  )
}

/** Signal a running agentic loop to abort at the next round boundary.
 *  Also immediately cancels any running workflow engine. */
export function abortAgentLoop(agentId: number, chatId: number): void {
  const key = `${agentId}:${chatId}`
  if (processingMap.get(key) || workflowProcessingMap.get(key)) {
    abortMap.set(key, true)
    logger.info(`[abort] abortMap set for agent=${agentId} chat=${chatId}`)
  }
  const cancelFn = workflowCancelMap.get(key)
  if (cancelFn) {
    logger.info(
      `[abort] calling workflow cancel for agent=${agentId} chat=${chatId}`
    )
    cancelFn()
    workflowCancelMap.delete(key)
  }
}

/**
 * Number of recent conversation turns (user + assistant pairs) to keep
 * in the in-memory session cache for short-term context continuity.
 */
const CONVERSATION_HISTORY_TURNS = 10

/**
 * 触发 refreshAgentMemory 所需的最少被淘汰消息数（即至少 N/2 轮对话）。
 * 避免每轮仅淘汰 2 条消息时也频繁调用大模型摘要。
 */
const MIN_TRIM_FOR_MEMORY_REFRESH = 6

// ─── DB-backed session history cache ─────────────────────────────────────────

/** 从数据库读取会话历史消息（自动反序列化） */
function loadSessionHistory(agentId: number, sessionId: number): BaseMessage[] {
  if (sessionId <= 0) return []
  const arr = clawDb.loadSessionHistory(sessionId)
  if (!arr) return []
  try {
    return deserializeMessages(arr as SerializedMessage[])
  } catch {
    return []
  }
}

/** 将会话历史消息持久化到数据库 */
function saveSessionHistory(
  agentId: number,
  sessionId: number,
  messages: BaseMessage[]
): void {
  if (sessionId <= 0) return
  clawDb.saveSessionHistory(sessionId, serializeMessages(messages))
}

/** 清除指定会话的历史记录 */
export function clearSessionHistory(agentId: number, sessionId: number): void {
  if (sessionId > 0) {
    clawDb.clearSessionHistory(sessionId)
  }
  logger.info(`Session history cleared: sessionId=${sessionId}`)
}

// Listen for session:clear events emitted by the /new command
clawEventBus.on('session:clear', (evt) => {
  clearSessionHistory(evt.agentId, evt.sessionId)
})

// resolveAgentModelListByRef is exported from packages/backend/src/model/model

// resolveAgentModelListByRef is exported from packages/backend/src/model/model

/**
 * Build a LangChain HumanMessage from a ClawMessage.
 * For image messages it includes the image content parts.
 */
function buildUserMessage(content: ClawMessage): HumanMessage {
  if (content.type === 'image' && content.image) {
    const caption = content.image.caption?.trim() ?? ''

    const parts: Array<Record<string, any>> = [
      { type: 'text', text: caption || 'Please analyze this image.' },
    ]
    if (content.image.url) {
      parts.push({ type: 'image_url', image_url: { url: content.image.url } })
    } else if (content.image.data && content.image.mimeType) {
      const dataUrl = `data:${content.image.mimeType};base64,${content.image.data}`
      parts.push({ type: 'image_url', image_url: { url: dataUrl } })
    }
    return new HumanMessage({ content: parts as any })
  }
  return new HumanMessage(content.text ?? '')
}

// ─── Message serialization for DB persistence ──────────────────────────────

export type SerializedMessage = {
  type: 'human' | 'ai' | 'tool' | 'system'
  content: unknown
  tool_calls?: unknown[]
  additional_kwargs?: Record<string, unknown>
  tool_call_id?: string
}

export function serializeMessages(
  messages: BaseMessage[]
): SerializedMessage[] {
  return messages.map((msg) => {
    const type = msg._getType() as SerializedMessage['type']
    const item: SerializedMessage = { type, content: msg.content }
    if (type === 'ai') {
      const ai = msg as AIMessage
      if (ai.tool_calls?.length) item.tool_calls = ai.tool_calls as unknown[]
      if (ai.additional_kwargs && Object.keys(ai.additional_kwargs).length) {
        item.additional_kwargs = ai.additional_kwargs as Record<string, unknown>
      }
    } else if (type === 'tool') {
      const tool = msg as ToolMessage
      item.tool_call_id = tool.tool_call_id
    }
    return item
  })
}

export function deserializeMessages(items: SerializedMessage[]): BaseMessage[] {
  return items.map((item) => {
    switch (item.type) {
      case 'ai':
        return new AIMessage({
          content: item.content as any,
          tool_calls: item.tool_calls as any,
          additional_kwargs: item.additional_kwargs,
        })
      case 'tool':
        return new ToolMessage({
          content: item.content as string,
          tool_call_id: item.tool_call_id!,
        })
      case 'system':
        return new SystemMessage(item.content as string)
      default:
        return new HumanMessage({ content: item.content as any })
    }
  })
}

/**
 * Build the full system prompt for a agent.
 *
 * Supports `{{placeholder}}` tokens in the per-slot systemPrompt (e.g. `{{project_list}}`).
 * Soul 和 Memory 从 paramDb 读取后注入到系统提示中。
 */
async function buildSystemPrompt(
  agent: Agent,
  soul: string,
  memory: string,
  user: string,
  dailyMemory = '',
  toolDefsForPrompt: Array<{ name: string; description: string }> = []
): Promise<string> {
  const defaultSlot = agent.config.models?.['default']
  const slotRef: ModelRef | undefined =
    typeof defaultSlot === 'string'
      ? { name: defaultSlot }
      : (defaultSlot as ModelRef | undefined)

  const parts: string[] = []

  parts.push(
    `You are "${agent.title}" (agent_id: ${agent.id}), a member of the ClawGoal team.`
  )

  // ── Agent workspace ────────────────────────────────────────────────────────
  const agentWorkspace = await getAgentWorkspacePath({ agent })
  parts.push(`## Workspace
\`${agentWorkspace}\` — use this directory for all file I/O, code generation, and temp files.`)

  // ── Soul injection ─────────────────────────────────────────────────────────
  if (soul && soul.trim()) {
    parts.push(`## Soul (核心特质/原则)
${soul.trim()}`)
  }

  // ── Tooling section ────────────────────────────────────────────────────────────
  if (toolDefsForPrompt.length > 0) {
    const toolDefsForNoneMCP = toolDefsForPrompt.filter(
      (t) => !t.name.startsWith('mcp_')
    )
    const toolLines = toolDefsForNoneMCP.map(
      (t) => `- ${t.name}: ${t.description.split('\n')[0].trim()}`
    )
    const hasMcpTools = toolDefsForPrompt.length !== toolDefsForNoneMCP.length
    if (hasMcpTools) {
      toolLines.push(
        `- mcp_: \`mcp_\` prefixed tools are extensions provided by MCP services.`
      )
    }
    parts.push(`## Available Tools (可用工具)
${toolLines.join('\n')}

> ⚠️ ONLY use tools explicitly listed above. DO NOT invent tools.
> If asked about your skills or capabilities, use the \`skills_search\` tool.`)
  }

  // ── User injection ─────────────────────────────────────────────────────────
  if (user && user.trim()) {
    parts.push(`## User Profile (用户画像)
${user.trim()}`)
  } else if (agent.roleName === 'supervisor') {
    parts.push(`## Getting to Know the User
No user info yet. Ask 1-2 questions (name, Goal, preferences), then save with \`user\` tool (action: set).`)
  }

  // ── Memory injection (param-based) ─────────────────────────────────────────
  if (memory && memory.trim()) {
    parts.push(`## General Memory (记忆)
${memory.trim()}`)
  }

  // ── Daily Memory injection (claw_agent_memory table) ───────────────────────
  if (dailyMemory && dailyMemory.trim()) {
    parts.push(`## Today's Memory (今日记忆)
${dailyMemory.trim()}`)
  }

  // ── Skills discovery hint ──────────────────────────────────────────────────
  parts.push(`## Skills
Use \`skills_search\` tool to find your Skills by keyword (omit query to list all).
Terms: Project(项目), Objective(目标), Key Result(关键结果), Task(任务).`)

  // Inject current time and user language preference
  const language = await getUserLang(agent.tenantId, agent.userId)
  parts.push(buildSystemInfoPrompt(new Date(), language))

  if (slotRef?.systemPrompt) {
    parts.push(slotRef?.systemPrompt.trim())
  }

  const prompt = await resolvePlaceholders(parts.join('\n\n'), {
    language,
    agentParam: agent.param,
  })

  return prompt
}

/**
 * 触发记忆刷新：用 Model 对即将被淘汰的对话片段进行摘要，追加到今日记忆中。
 * 整个过程异步非阻塞，失败只打日志。
 */
async function refreshAgentMemory(
  agent: Agent,
  trimmedMessages: BaseMessage[],
  agentContext: AgentContext
): Promise<void> {
  const _log = agentContext.logger
  try {
    // 将被淘汰的消息拼成纯文本供 Model 摘要
    const lines: string[] = []
    for (const msg of trimmedMessages) {
      if (msg instanceof ToolMessage) continue
      const textContent =
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? (msg.content as Array<{ type: string; text?: string }>)
                .filter((p) => p.type === 'text')
                .map((p) => p.text ?? '')
                .join(' ')
            : ''
      if (textContent.trim()) {
        const role = msg instanceof HumanMessage ? 'user' : 'assistant'
        lines.push(`[${role}]: ${textContent.trim()}`)
      }
    }
    if (lines.length === 0) return

    // 读取今日已有记忆作为上下文
    const existing = getTodayMemory(agent.tenantId, agent.userId, agent.id)
    const existingContent = existing?.content ?? ''

    const conversationText = lines.join('\n')
    const systemPrompt = `You are a Memory Management assistant. Distill the following conversation into a concise memory summary. Capture user preferences, critical info, and key conclusions as bullet points. Output format: Markdown bulleted list, max 500 characters.${existingContent ? `\n\nExisting Memory:\n${existingContent}` : ''}`
    const userPrompt = `Please summarize the following conversation and update the memory:\n\n${conversationText}`

    const callResult = await modelCall({
      tenantId: agent.tenantId,
      userId: agent.userId,
      biz: 'Session',
      bizId: String(agentContext.sessionId),
      modelConfigList: await getModelConfigList(
        agent.userId,
        agent.tenantId,
        'default'
      ),
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxRetry: 1,
      onModelCallStart: (model) => {
        _log.info({ model }, 'memory:refresh model:call')
      },
      onModelCallEnd: (model, status, duration, usage) => {
        _log.info(
          {
            model,
            status,
            duration,
            promptTokens: usage?.promptTokens,
            completionTokens: usage?.completionTokens,
            req: logJson(usage?.requestBody),
            res: logJson(usage?.responseBody),
          },
          'memory:refresh model:done'
        )
      },
    })
    const summary = callResult.type === 'text' ? callResult.content : ''
    if (!summary.trim()) return

    await upsertAgentDailyMemory(
      agent.tenantId,
      agent.userId,
      agent.id,
      summary
    )
    _log.info(
      `Agent memory refreshed: agentId=${agent.id} userId=${agent.userId}`
    )
  } catch (err) {
    _log.warn(`refreshAgentMemory failed for agent ${agent.id}: ${err}`)
  }
}

const _enc = getEncoding('cl100k_base')

/**
 * 统计消息列表的 token 数量（使用 cl100k_base 编码）。
 */
function countTokens(messages: BaseMessage[]): number {
  let total = 0
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      total += _enc.encode(msg.content).length
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as Array<{
        type: string
        text?: string
      }>) {
        if (part.type === 'text') total += _enc.encode(part.text ?? '').length
      }
    }
  }
  return total
}

/**
 * 当会话上下文超过模型 contextWindow 的 3/4 时，调用大模型压缩历史消息。
 * 压缩时不发送工具调用结果（ToolMessage 过滤掉），输出一条摘要消息。
 * 压缩后的新历史 = [摘要消息] + 最近 10 条消息。
 * 失败时返回原始消息列表（非阻塞）。
 */

/**
 * 从 modelConfigs 中解析有效的 contextWindow 大小：
 * 取第一个有值的配置，结果 = min(contextWindow, maxTokens)（两者均有时），
 * 只有其中一个时取该值，都没有则返回默认值 128000。
 */
export function resolveContextWindow(
  modelConfigs: ModelConfig[],
  defaultValue = 128000
): number {
  for (const mc of modelConfigs) {
    const cw = mc.contextWindow && mc.contextWindow > 0 ? mc.contextWindow : 0
    const mt = mc.maxTokens && mc.maxTokens > 0 ? mc.maxTokens : 0
    if (cw > 0 && mt > 0) return Math.min(cw, mt)
    if (cw > 0) return cw
    if (mt > 0) return mt
  }
  return defaultValue
}

async function compressSessionHistoryIfNeeded(
  messages: BaseMessage[],
  modelConfigs: ModelConfig[],
  agent: Agent,
  sessionId: number,
  _log: ReturnType<typeof createLogger>
): Promise<BaseMessage[]> {
  if (messages.length === 0) return messages

  const contextWindow = resolveContextWindow(modelConfigs)
  const threshold = Math.floor((contextWindow * 3) / 4)
  const estimatedTokens = countTokens(messages)
  if (estimatedTokens < threshold) return messages

  _log.info(
    { estimatedTokens, contextWindow, threshold, sessionId },
    'context window 3/4 reached — compressing session history'
  )

  try {
    // 过滤掉 ToolMessage，只保留 Human/AI 消息构建摘要
    const summaryMessages = messages.filter((m) => !(m instanceof ToolMessage))
    const lines: string[] = []
    for (const msg of summaryMessages) {
      const textContent =
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? (msg.content as Array<{ type: string; text?: string }>)
                .filter((p) => p.type === 'text')
                .map((p) => p.text ?? '')
                .join(' ')
            : ''
      if (textContent.trim()) {
        const role = msg instanceof HumanMessage ? 'user' : 'assistant'
        lines.push(`[${role}]: ${textContent.trim()}`)
      }
    }

    const conversationText = lines.join('\n')
    const callResult = await modelCall({
      tenantId: agent.tenantId,
      userId: agent.userId,
      biz: 'Session',
      bizId: String(sessionId),
      modelConfigList: modelConfigs,
      systemPrompt:
        'You are a conversation summarizer. Summarize the following conversation into concise bullet points that capture all key information, decisions, and context. Output in Markdown. Max 1000 characters.',
      userPrompt: conversationText,
      temperature: 0.3,
      maxRetry: 1,
      onModelCallStart: () => {},
      onModelCallEnd: () => {},
    })

    const summary = callResult.type === 'text' ? callResult.content : ''
    if (!summary.trim()) return messages

    // 新历史 = [摘要作为 SystemMessage] + 最近 (maxEntries-1) 条消息
    // 保留 maxEntries-1 而非 maxEntries，使压缩后总数恰好等于 maxEntries，
    // 避免后续 trim 把 summary 删掉导致压缩白做。
    const recentCount = CONVERSATION_HISTORY_TURNS * 2 - 1
    const recentMessages = messages.slice(-recentCount)
    const compressed: BaseMessage[] = [
      new SystemMessage(`[Conversation Summary]\n${summary.trim()}`),
      ...recentMessages,
    ]
    _log.info(
      { originalCount: messages.length, compressedCount: compressed.length },
      'session history compressed'
    )
    return compressed
  } catch (err) {
    _log.warn(
      { err, sessionId },
      'compressSessionHistoryIfNeeded failed, keeping original'
    )
    return messages
  }
}

/**
 * 将单条原始模型消息存储到 claw_chat_message_raw 表中（非阻塞，失败只打日志）。
 */
export function storeRawMessage(
  tenantId: number,
  userId: number,
  sessionId: number,
  msg: BaseMessage
): void {
  try {
    const type = msg._getType()
    const item: Record<string, unknown> = { type, content: msg.content }
    if (type === 'ai') {
      const ai = msg as AIMessage
      if (ai.tool_calls?.length) item.tool_calls = ai.tool_calls
    } else if (type === 'tool') {
      const tool = msg as ToolMessage
      item.tool_call_id = tool.tool_call_id
    }
    clawDb.insertAgentMessageRaw({
      tenantId,
      userId,
      sessionId,
      message: JSON.stringify(item),
    })
  } catch {
    // non-blocking
  }
}

/**
 * Process a user message through the agentic loop.
 * Returns the final assistant text response.
 *
 * @param agent        - The agent executing this turn (provides config, identity, permissions)
 * @param chatId       - Chat/conversation DB row ID used for event emission and logging
 * @param content      - Channel-agnostic message from the user
 * @param modelSlot    - Named model slot to use for this turn (defaults to 'default')
 * @param channelId    - Optional channel ID forwarded to tool:start / tool:end events
 * @param taskId       - Optional task ID stored in pendingRoundsMap for max-rounds resumption.
 *                       Note: agentContext.taskId serves a separate purpose — it is read by
 *                       tools (e.g. node.ts) and should be kept in sync by callers.
 * @param sessionId    - Session ID for in-memory history scoping (0 = legacy/no session).
 *                       Note: agentContext.sessionId is set by callers but is not currently
 *                       read inside this function; the parameter value is authoritative here.
 * @param agentContext - Execution context shared with all tool calls in this turn (logger,
 *                       tenantId, userId, agentId, taskId for tools, etc.)
 */
export async function processMessage(
  agent: Agent,
  chatId: number,
  content: ClawMessage,
  modelSlot = 'default',
  channelId?: number,
  taskId?: number,
  sessionId = 0,
  agentContext: AgentContext
): Promise<string> {
  const logger = agentContext.logger
  // For image messages: auto-upgrade to 'vision' slot if agent config has it and caller used 'default'.
  if (
    content.type === 'image' &&
    modelSlot === 'default' &&
    agent.config.models?.['vision']
  ) {
    modelSlot = 'vision'
  }
  // Extract plain text for memory search and session history.
  // For image messages we use the caption (if any) as the search key.
  const userText =
    content.type === 'image'
      ? (content.image?.caption ?? '').trim()
      : (content.text ?? '')
  const rawAllowedTools = agent.config.capabilities.tools
  const allowedTools = toolRegistry.getEffectiveAllowedTools(
    rawAllowedTools,
    agent.config.permissions
  )
  const configuredMcps: string[] = agent.config.capabilities.mcps ?? []
  const allowedMcps: string[] = configuredMcps

  // 读取 Soul 和 Memory（智能体私有优先，无则读全局）
  let soul = ''
  let memory = ''
  try {
    soul = await getSoul(agent.tenantId, agent.userId, agent.id)
    if (!soul.trim()) {
      soul = await getSoul(agent.tenantId, agent.userId)
    }
    // Fallback: use role-default soul from config.yaml if no soul is persisted
    if (!soul.trim() && agent.config.soul) {
      soul = agent.config.soul
    }
  } catch {
    // ignore
  }
  try {
    memory = await getMemory(agent.tenantId, agent.userId, agent.id)
    if (!memory.trim()) {
      memory = await getMemory(agent.tenantId, agent.userId)
    }
  } catch {
    // ignore
  }

  // 读取今日 Agent 记忆（按天持久化，embedding 索引支持语义搜索）
  let dailyMemory = ''
  try {
    const todayRow = getTodayMemory(agent.tenantId, agent.userId, agent.id)
    if (todayRow?.content.trim()) {
      dailyMemory = todayRow.content
    }
  } catch {
    // ignore
  }
  let user = ''
  try {
    user = await getUser(agent.tenantId, agent.userId)
  } catch {
    // ignore
  }

  // Get tools available to this role (built-in + MCP)
  const toolDefs = toolRegistry.getDefinitionsWithMcp(allowedTools, allowedMcps)

  // Load recent conversation history from file-backed cache for short-term context continuity.
  const historyMessages: BaseMessage[] = loadSessionHistory(agent.id, sessionId)
  if (historyMessages.length > 0) {
    logger.debug(
      `Loaded ${historyMessages.length} cached history message(s) for context continuity`
    )
  }

  const systemPromptText = await buildSystemPrompt(
    agent,
    soul,
    memory,
    user,
    dailyMemory,
    toolDefs
  )

  // Resolve model config list for this slot (modelCall handles retries internally)
  const { modelRef, modelConfigs } = await resolveAgentModelListByRef(
    agent,
    modelSlot
  )
  logger.debug(
    `Model slot="${modelSlot}" resolved to ${modelConfigs.length} config(s) for ${agent.title}`
  )

  // Build initial append messages: history + current user turn
  const appendMessages: BaseMessage[] = [
    ...historyMessages,
    buildUserMessage(content),
  ]

  const maxToolRounds =
    agent.config.model.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS
  let finalResponse = ''
  let rounds = 0

  const loopKey = `${agent.id}:${chatId}`
  processingMap.set(loopKey, true)
  abortMap.delete(loopKey)

  // 先落库 human 消息，确保原始消息顺序正确（AI 工具调用也在 loop 内落库，需在其之前写入）
  if (userText || content.type === 'image') {
    storeRawMessage(
      agent.tenantId,
      agent.userId,
      sessionId,
      buildUserMessage(content)
    )
  }

  // ── Agentic loop ─────────────────────────────────────────────────────────────────
  try {
    while (rounds < maxToolRounds) {
      if (abortMap.get(loopKey)) {
        break
      }
      rounds++
      logger.debug(
        `Agentic loop round ${rounds} for ${agent.title} chat=${chatId}`
      )

      logger.info(`[round ${rounds}] model:start`)
      const result = await modelCall({
        tenantId: agent.tenantId,
        userId: agent.userId,
        biz: 'Session',
        bizId: String(sessionId),
        modelConfigList: modelConfigs,
        systemPrompt: systemPromptText,
        appendMessages: [...appendMessages],
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        temperature: modelRef.temperature ?? agent.config.model.temperature,
        maxRetry: modelConfigs.length,
        context: `agent:${agent.id}`,
        onModelCallStart: (model) => {
          logger.info({ model }, `[round ${rounds}] model:call`)
        },
        onModelCallEnd: (model, status, duration, usage) => {
          logger.info(
            {
              model,
              status,
              duration,
              promptTokens: usage?.promptTokens,
              completionTokens: usage?.completionTokens,
              req: logJson(usage?.requestBody),
              res: logJson(usage?.responseBody),
            },
            `[round ${rounds}] model:done`
          )
        },
      })

      if (result.type === 'tools') {
        // Append AIMessage with tool calls
        appendMessages.push(result.message)
        storeRawMessage(agent.tenantId, agent.userId, sessionId, result.message)

        // Execute each tool call and collect results
        for (const tc of result.tools) {
          const argsPreview = jsonStringify(tc.args).slice(0, 300)
          logger.info({ tool: tc.name, args: argsPreview }, `→ tool:start`)

          await clawEventBus.emit('tool:start', {
            agentId: agent.id,
            chatId,
            toolName: tc.name,
            toolCallId: tc.id,
            params: tc.args as Record<string, unknown>,
            channelId,
          })

          // Track stageItem
          const tcArgs = tc.args as Record<string, unknown>
          const tcAction =
            typeof tcArgs['action'] === 'string' ? tcArgs['action'] : undefined
          const tcReasoning =
            typeof tcArgs['reasoning'] === 'string'
              ? tcArgs['reasoning']
              : undefined

          const toolStartTs = Date.now()
          const toolResult = await toolRegistry.execute(
            tc.name,
            tc.args,
            allowedTools,
            { agentContext, toolCallId: tc.id },
            allowedMcps
          )
          const durationMs = Date.now() - toolStartTs
          const toolOutput = toolResult.success
            ? toolResult.output
            : `Error: ${toolResult.error}`
          logger.info(
            {
              tool: tc.name,
              success: toolResult.success,
              durationMs,
              output: toolOutput.slice(0, 300),
            },
            `← tool:end`
          )
          await clawEventBus.emit('tool:end', {
            agentId: agent.id,
            chatId,
            toolName: tc.name,
            toolCallId: tc.id,
            success: toolResult.success,
            durationMs,
            result: toolOutput,
            channelId,
          })

          // Append tool result to messages
          const toolMsg = new ToolMessage({
            content: toolOutput,
            tool_call_id: tc.id,
          })
          appendMessages.push(toolMsg)
          storeRawMessage(agent.tenantId, agent.userId, sessionId, toolMsg)

          // If a tool paused execution in a task context, save state and break
          if (toolResult.pause && taskId) {
            logger.info(
              { taskId },
              'asks tool paused the agentic loop — saving state'
            )
            clawDb.upsertAgentic({
              tenantId: agent.tenantId,
              userId: agent.userId,
              sessionId,
              data: {
                agentId: agent.id,
                chatId,
                channelId,
                messages: serializeMessages([...appendMessages]),
                modelConfigs,
                modelRef,
                maxToolRounds,
                allowedTools,
                allowedMcps,
                content,
                userText,
              },
            })
            processingMap.delete(loopKey)
            abortMap.delete(loopKey)
            return ASKS_SENTINEL
          }
        }

        // Continue the loop to let Model process tool results
        continue
      }

      // No tool calls — we have the final text response
      finalResponse =
        result.type === 'text'
          ? result.content || '(no response)'
          : '(no response)'
      logger.info(
        { len: finalResponse.length, preview: finalResponse.slice(0, 200) },
        `[round ${rounds}] model:reply`
      )
      break
    }

    if (abortMap.get(loopKey)) {
      logger.info(
        `Agentic loop aborted by user for ${agent.title} chat=${chatId}`
      )
      processingMap.delete(loopKey)
      abortMap.delete(loopKey)
      return ABORT_SENTINEL
    }

    if (rounds >= maxToolRounds && !finalResponse) {
      // Pause the loop and ask the user whether to continue.
      logger.warn(
        `Max tool rounds (${maxToolRounds}) reached for ${agent.title} chat=${chatId}, pausing for user confirmation`
      )
      const pendingKey = `${agent.id}:${chatId}`
      pendingRoundsMap.set(pendingKey, {
        agent,
        chatId,
        sessionId,
        channelId,
        taskId,
        appendMessages: [...appendMessages],
        modelConfigs,
        modelRef: { ...modelRef },
        maxToolRounds,
        allowedTools,
        allowedMcps,
        content,
        userText,
      })
      clawEventBus.emit('agent:maxRoundsReached', {
        agentId: agent.id,
        chatId,
        channelId,
        userId: agent.userId,
      })
      return MAX_ROUNDS_SENTINEL
    }
  } catch (err) {
    processingMap.delete(loopKey)
    abortMap.delete(loopKey)
    throw err
  }

  processingMap.delete(loopKey)
  abortMap.delete(loopKey)

  // ── 后处理（完全异步，不阻塞响应返回）────────────────────────────────────
  // 先立即返回 finalResponse，再在后台完成历史压缩与记忆刷新，
  // 避免压缩模型调用延迟用户侧响应，也避免占用 API 配额影响下一条请求。
  const hasUserContent = userText || content.type === 'image'
  if (finalResponse && hasUserContent) {
    const _finalResponse = finalResponse
    const _agentContext = agentContext
    ;(async () => {
      try {
        const userMsg = buildUserMessage(content)
        const assistantMsg = new AIMessage(_finalResponse)
        // human 消息已在 loop 前落库；此处只需落库最终 AI 回复
        storeRawMessage(agent.tenantId, agent.userId, sessionId, assistantMsg)

        let cached = loadSessionHistory(agent.id, sessionId)
        cached.push(userMsg)
        cached.push(assistantMsg)

        // 若接近 contextWindow 的 3/4，压缩历史
        cached = await compressSessionHistoryIfNeeded(
          cached,
          modelConfigs,
          agent,
          sessionId,
          logger
        )

        // Keep only the most recent N turns (each turn = 1 user + 1 assistant message)
        const maxEntries = CONVERSATION_HISTORY_TURNS * 2
        if (cached.length > maxEntries) {
          const toTrim = cached.slice(0, cached.length - maxEntries)
          // 仅当被淘汰消息足够多时才调用大模型摘要，避免每轮都触发
          if (toTrim.length >= MIN_TRIM_FOR_MEMORY_REFRESH) {
            refreshAgentMemory(agent, toTrim, _agentContext).catch(() => {})
          }
          cached.splice(0, cached.length - maxEntries)
        }
        saveSessionHistory(agent.id, sessionId, cached)
      } catch (e) {
        logger.warn({ e }, 'session post-processing failed')
      }
    })().catch(() => {})
  }

  return finalResponse
}

// ── Continuation event handler ────────────────────────────────────────────────
clawEventBus.on('agent:continueRounds', async (evt) => {
  const key = `${evt.agentId}:${evt.chatId}`
  const pending = pendingRoundsMap.get(key)
  if (!pending) {
    logger.warn(`[continueRounds] No pending state found for key=${key}`)
    return
  }
  pendingRoundsMap.delete(key)

  const {
    agent,
    chatId,
    channelId,
    taskId,
    appendMessages,
    modelConfigs,
    modelRef,
    maxToolRounds,
    allowedTools,
    allowedMcps,
    content,
    userText,
    sessionId: pendingSessionId,
  } = pending
  const toolDefs = toolRegistry.getDefinitionsWithMcp(allowedTools, allowedMcps)
  const agentLog = getAgentLogger(
    agent.roleName,
    agent.id,
    String(pendingSessionId)
  )
  const agentContext: AgentContext = {
    logger: agentLog,
    tenantId: agent.tenantId,
    userId: agent.userId,
    agentId: agent.id,
    taskId,
    sessionId: pendingSessionId,
  }

  agentLog.info(
    `[continueRounds] Resuming agentic loop: agent=${agent.title} chat=${chatId} prevMsgs=${appendMessages.length}`
  )

  let finalResponse = ''
  let rounds = 0

  // Re-build the systemPrompt (it may have changed since last time)
  let systemPromptText = ''
  try {
    const soulFromDb =
      (await getSoul(agent.tenantId, agent.userId, agent.id).catch(() => '')) ||
      (await getSoul(agent.tenantId, agent.userId).catch(() => ''))
    const soul = soulFromDb || (agent.config.soul ?? '')
    const memory =
      (await getMemory(agent.tenantId, agent.userId, agent.id).catch(
        () => ''
      )) || (await getMemory(agent.tenantId, agent.userId).catch(() => ''))
    const user = await getUser(agent.tenantId, agent.userId).catch(() => '')
    const todayRow = getTodayMemory(agent.tenantId, agent.userId, agent.id)
    const dailyMemory = todayRow?.content ?? ''
    systemPromptText = await buildSystemPrompt(
      agent,
      soul,
      memory,
      user,
      dailyMemory,
      toolDefs
    )
  } catch (e) {
    agentLog.warn(`[continueRounds] Failed to build system prompt: ${e}`)
  }

  try {
    while (rounds < maxToolRounds) {
      rounds++
      agentLog.debug(
        `[continueRounds] Round ${rounds} for ${agent.title} chat=${chatId}`
      )

      agentLog.info(`[round ${rounds}] model:start [continue]`)
      const result = await modelCall({
        tenantId: agent.tenantId,
        userId: agent.userId,
        biz: 'Session',
        bizId: String(pendingSessionId),
        modelConfigList: modelConfigs,
        systemPrompt: systemPromptText,
        appendMessages: [...appendMessages],
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        temperature: modelRef.temperature ?? agent.config.model.temperature,
        maxRetry: modelConfigs.length,
        context: `agent:${agent.id}:continue`,
        onModelCallStart: (model) => {
          agentLog.info({ model }, `[round ${rounds}] model:call [continue]`)
        },
        onModelCallEnd: (model, status, duration, usage) => {
          agentLog.info(
            {
              model,
              status,
              duration,
              promptTokens: usage?.promptTokens,
              completionTokens: usage?.completionTokens,
              req: logJson(usage?.requestBody),
              res: logJson(usage?.responseBody),
            },
            `[round ${rounds}] model:done [continue]`
          )
        },
      })

      if (result.type === 'tools') {
        appendMessages.push(result.message)

        for (const tc of result.tools) {
          const argsPreview = jsonStringify(tc.args).slice(0, 300)
          agentLog.info(
            { tool: tc.name, args: argsPreview },
            `→ tool:start [continue]`
          )
          await clawEventBus.emit('tool:start', {
            agentId: agent.id,
            chatId,
            toolName: tc.name,
            toolCallId: tc.id,
            params: tc.args as Record<string, unknown>,
            channelId,
          })

          const tcArgsCont = tc.args as Record<string, unknown>
          const tcActionCont =
            typeof tcArgsCont['action'] === 'string'
              ? tcArgsCont['action']
              : undefined
          const tcReasoningCont =
            typeof tcArgsCont['reasoning'] === 'string'
              ? tcArgsCont['reasoning']
              : undefined

          const toolStartTs = Date.now()
          const toolResult = await toolRegistry.execute(
            tc.name,
            tc.args,
            allowedTools,
            { agentContext, toolCallId: tc.id },
            allowedMcps
          )
          const durationMs = Date.now() - toolStartTs
          const toolOutput = toolResult.success
            ? toolResult.output
            : `Error: ${toolResult.error}`
          agentLog.info(
            {
              tool: tc.name,
              success: toolResult.success,
              durationMs,
              output: toolOutput.slice(0, 300),
            },
            `← tool:end [continue]`
          )

          await clawEventBus.emit('tool:end', {
            agentId: agent.id,
            chatId,
            toolName: tc.name,
            toolCallId: tc.id,
            success: toolResult.success,
            durationMs,
            result: toolOutput,
            channelId,
          })

          appendMessages.push(
            new ToolMessage({ content: toolOutput, tool_call_id: tc.id })
          )
        }
        continue
      }

      // No tool calls — final text response reached
      finalResponse =
        result.type === 'text'
          ? result.content || '(no response)'
          : '(no response)'
      agentLog.info(
        { len: finalResponse.length, preview: finalResponse.slice(0, 200) },
        `[round ${rounds}] model:reply [continue]`
      )
      break
    }
  } catch (err) {
    agentLog.error(
      { err },
      `[continueRounds] Loop failed for agent=${agent.title} chat=${chatId}`
    )
    const continueLang = await getUserLang(agent.tenantId, agent.userId)
    const isZhContinue = continueLang !== 'en-US'
    clawEventBus.emit('message:outgoing', {
      agentId: agent.id,
      chatId,
      content: clawMessage.text(
        `⚠️ ${isZhContinue ? '继续运行失败' : 'Continue failed'}：${err instanceof Error ? err.message : String(err)}`
      ),
      userId: agent.userId,
      isError: true,
      channelId,
      source: 'channel',
      agentContext,
    })
    return
  }

  if (rounds >= maxToolRounds && !finalResponse) {
    // Hit the limit again — save state and emit another pause event
    agentLog.warn(
      `[continueRounds] Max tool rounds reached again for ${agent.title} chat=${chatId}`
    )
    pendingRoundsMap.set(key, {
      agent,
      chatId,
      sessionId: pendingSessionId,
      channelId,
      taskId,
      appendMessages: [...appendMessages],
      modelConfigs,
      modelRef: { ...modelRef },
      maxToolRounds,
      allowedTools,
      allowedMcps,
      content,
      userText,
    })
    clawEventBus.emit('agent:maxRoundsReached', {
      agentId: agent.id,
      chatId,
      channelId,
      userId: agent.userId,
    })
    return
  }

  if (finalResponse) {
    // Update session cache so future turns have accurate conversation history
    const hasUserContent = userText || content.type === 'image'
    if (hasUserContent) {
      const userMsg = buildUserMessage(content)
      const assistantMsg = new AIMessage(finalResponse)
      let cached = loadSessionHistory(agent.id, pendingSessionId)
      cached.push(userMsg)
      cached.push(assistantMsg)
      cached = await compressSessionHistoryIfNeeded(
        cached,
        modelConfigs,
        agent,
        pendingSessionId,
        agentLog
      )
      const maxEntries = CONVERSATION_HISTORY_TURNS * 2
      if (cached.length > maxEntries) {
        const toTrim = cached.slice(0, cached.length - maxEntries)
        // 仅当被淘汰消息足够多时才调用大模型摘要，避免每轮都触发
        if (toTrim.length >= MIN_TRIM_FOR_MEMORY_REFRESH) {
          refreshAgentMemory(agent, toTrim, agentContext).catch(() => {})
        }
        cached.splice(0, cached.length - maxEntries)
      }
      saveSessionHistory(agent.id, pendingSessionId, cached)
    }

    clawEventBus.emit('message:outgoing', {
      agentId: agent.id,
      chatId,
      content: clawMessage.text(finalResponse),
      userId: agent.userId,
      channelId,
      source: 'channel',
      agentContext,
    })
  }
})

/**
 * Resume an agentic loop that was paused by the `asks` tool.
 *
 * Injects the user's answer as a new HumanMessage, then continues the loop
 * from the point where `asks` interrupted it.  Returns the final assistant
 * text or `ASKS_SENTINEL` if the agent invokes `asks` again.
 *
 * @param pending      - Frozen loop state saved by the asks sentinel handler
 * @param userReply    - The user's answer to the asks question (from task.status_remark)
 * @param agentContext - Execution context for this resumed turn
 */
export async function resumeFromAsks(
  pending: PendingAsksState,
  userReply: string,
  agentContext: AgentContext
): Promise<string> {
  const {
    agent,
    chatId,
    channelId,
    appendMessages: savedMessages,
    modelConfigs,
    modelRef,
    maxToolRounds,
    allowedTools,
    allowedMcps,
    sessionId: pendingSessionId,
  } = pending

  const taskId = agentContext.taskId
  const agentLog = agentContext.logger

  agentLog.info(
    `[resumeFromAsks] Resuming after user reply: agent=${agent.title} chat=${chatId} taskId=${taskId}`
  )

  // Append the user's answer to the saved message chain
  const appendMessages: BaseMessage[] = [
    ...savedMessages,
    new HumanMessage(userReply || 'Continue.'),
  ]

  // Carry forward stage items from the paused turn

  const toolDefs = toolRegistry.getDefinitionsWithMcp(allowedTools, allowedMcps)

  // Re-build the system prompt (may have changed while waiting for user input)
  let systemPromptText = ''
  try {
    const soulFromDb =
      (await getSoul(agent.tenantId, agent.userId, agent.id).catch(() => '')) ||
      (await getSoul(agent.tenantId, agent.userId).catch(() => ''))
    const soul = soulFromDb || (agent.config.soul ?? '')
    const memory =
      (await getMemory(agent.tenantId, agent.userId, agent.id).catch(
        () => ''
      )) || (await getMemory(agent.tenantId, agent.userId).catch(() => ''))
    const user = await getUser(agent.tenantId, agent.userId).catch(() => '')
    const todayRow = getTodayMemory(agent.tenantId, agent.userId, agent.id)
    const dailyMemory = todayRow?.content ?? ''
    systemPromptText = await buildSystemPrompt(
      agent,
      soul,
      memory,
      user,
      dailyMemory,
      toolDefs
    )
  } catch (e) {
    agentLog.warn(`[resumeFromAsks] Failed to build system prompt: ${e}`)
  }

  let finalResponse = ''
  let rounds = 0

  try {
    while (rounds < maxToolRounds) {
      rounds++
      agentLog.debug(
        `[resumeFromAsks] Round ${rounds} for ${agent.title} chat=${chatId}`
      )

      agentLog.info(`[round ${rounds}] model:start [resumeFromAsks]`)
      const result = await modelCall({
        tenantId: agent.tenantId,
        userId: agent.userId,
        biz: 'Session',
        bizId: String(pendingSessionId),
        modelConfigList: modelConfigs,
        systemPrompt: systemPromptText,
        appendMessages: [...appendMessages],
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        temperature: modelRef.temperature ?? agent.config.model.temperature,
        maxRetry: modelConfigs.length,
        context: `agent:${agent.id}:resumeFromAsks`,
        onModelCallStart: (model) => {
          agentLog.info(
            { model },
            `[round ${rounds}] model:call [resumeFromAsks]`
          )
        },
        onModelCallEnd: (model, status, duration, usage) => {
          agentLog.info(
            {
              model,
              status,
              duration,
              promptTokens: usage?.promptTokens,
              completionTokens: usage?.completionTokens,
              req: logJson(usage?.requestBody),
              res: logJson(usage?.responseBody),
            },
            `[round ${rounds}] model:done [resumeFromAsks]`
          )
        },
      })

      if (result.type === 'tools') {
        appendMessages.push(result.message)

        for (const tc of result.tools) {
          const argsPreview = jsonStringify(tc.args).slice(0, 300)
          agentLog.info(
            { tool: tc.name, args: argsPreview },
            `→ tool:start [resumeFromAsks]`
          )
          await clawEventBus.emit('tool:start', {
            agentId: agent.id,
            chatId,
            toolName: tc.name,
            toolCallId: tc.id,
            params: tc.args as Record<string, unknown>,
            channelId,
          })

          const tcArgs = tc.args as Record<string, unknown>
          const tcAction =
            typeof tcArgs['action'] === 'string' ? tcArgs['action'] : undefined
          const tcReasoning =
            typeof tcArgs['reasoning'] === 'string'
              ? tcArgs['reasoning']
              : undefined

          const toolStartTs = Date.now()
          const toolResult = await toolRegistry.execute(
            tc.name,
            tc.args,
            allowedTools,
            { agentContext, toolCallId: tc.id },
            allowedMcps
          )
          const durationMs = Date.now() - toolStartTs
          const toolOutput = toolResult.success
            ? toolResult.output
            : `Error: ${toolResult.error}`
          agentLog.info(
            {
              tool: tc.name,
              success: toolResult.success,
              durationMs,
              output: toolOutput.slice(0, 300),
            },
            `← tool:end [resumeFromAsks]`
          )

          await clawEventBus.emit('tool:end', {
            agentId: agent.id,
            chatId,
            toolName: tc.name,
            toolCallId: tc.id,
            success: toolResult.success,
            durationMs,
            result: toolOutput,
            channelId,
          })

          appendMessages.push(
            new ToolMessage({ content: toolOutput, tool_call_id: tc.id })
          )

          // If a tool paused execution again, save state and return ASKS_SENTINEL
          if (toolResult.pause && taskId) {
            agentLog.info(
              { taskId },
              '[resumeFromAsks] nested asks — saving state again'
            )
            clawDb.upsertAgentic({
              tenantId: agent.tenantId,
              userId: agent.userId,
              sessionId: pendingSessionId,
              data: {
                agentId: agent.id,
                chatId,
                channelId,
                messages: serializeMessages([...appendMessages]),
                modelConfigs,
                modelRef,
                maxToolRounds,
                allowedTools,
                allowedMcps,
                content: pending.content,
                userText: pending.userText,
              },
            })
            return ASKS_SENTINEL
          }
        }
        continue
      }

      finalResponse =
        result.type === 'text'
          ? result.content || '(no response)'
          : '(no response)'
      agentLog.info(
        {
          len: finalResponse.length,
          preview: finalResponse.slice(0, 200),
        },
        `[round ${rounds}] model:reply [resumeFromAsks]`
      )
      break
    }
  } catch (err) {
    agentLog.error(
      { err },
      `[resumeFromAsks] Loop failed for agent=${agent.title} chat=${chatId}`
    )
    throw err
  }

  return finalResponse
}
