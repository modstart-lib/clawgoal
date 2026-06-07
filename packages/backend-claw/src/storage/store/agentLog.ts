/**
 * Agent message recorder — subscribes to clawEventBus and persists ALL
 * incoming / outgoing messages.
 *
 * 持久化职责（全事件驱动）：
 *   message:incoming  → 持久化用户消息；若 session 有未回答的 asks 消息，自动解析并回写 answered
 *   tool:start        → 创建独立工具消息（stage=running）+ 写入 claw_agent_tool（含 msg_id）
 *   tool:end          → 通过 claw_agent_tool.msg_id 更新对应消息状态（无内存依赖）
 *   tool:progress     → 追加 logs 到 claw_agent_tool（不更新消息）
 *   message:outgoing  → 持久化 assistant 回复
 *   agent:maxRoundsReached → 通过 claw_agent_tool 查找并标记 running 工具消息为 error
 */

import { z } from 'zod'
import { agentManager } from '../../agent/index.js'
import type {
  IncomingMessageEvent,
  OutgoingMessageEvent,
  ToolEndEvent,
  ToolProgressEvent,
  ToolStartEvent,
  MaxRoundsReachedEvent,
} from '../../kernel/eventBus.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import { createLogger } from '../../kernel/logger.js'
import { clawDb } from './index.js'
import type { AgentMessageContent } from './types.js'
import { getModelConfigList } from '../../../../backend/src/config/index.js'
import { modelCall } from '../../../../backend/src/model/model/index.js'

const logger = createLogger('agent-log')

function nowTimestamp(): string {
  return String(Date.now())
}

function resolveUserId(
  userId: unknown,
  channel: 'incoming' | 'outgoing',
  agentId: number,
  chatId: number
): number | null {
  const parsed = Number(userId)
  if (Number.isInteger(parsed) && parsed > 0) return parsed
  logger.warn(
    { userId, agentId, chatId },
    `Missing valid userId for ${channel} agent-log event`
  )
  return null
}

// ─── Asks 答案自动解析 ────────────────────────────────────────────────────────

const AsksAnswerSchema = z.object({
  answers: z.array(
    z.object({
      index: z.number().describe('asks 数组中的下标（0-based）'),
      answered: z.string().describe('用户选择或输入的答案文本'),
    })
  ),
})

/**
 * 在用户消息持久化后，查找该 session 最近一条含未回答 asks 的 assistant 消息，
 * 解析用户回复并回写 answered 字段。
 * - 单问题：规则匹配（选项文本相似度 / 序号）
 * - 多问题：LLM 抽取
 */
async function resolveAsksAnswers(
  sessionId: number,
  agentId: number,
  userText: string,
  tenantId: number,
  userId: number
): Promise<void> {
  if (!sessionId || !userText.trim()) return
  try {
    // 查找最近 20 条消息，找最后一条含未回答 asks 的 assistant 消息
    const { rows } = clawDb.listAgentMessagesBefore(
      tenantId,
      userId,
      agentId,
      20,
      undefined,
      sessionId
    )
    // 找最后一条 assistant 消息且含 asks 且有未回答项
    let targetRow: (typeof rows)[0] | undefined
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i]
      if (r.role !== 'assistant') continue
      const asks = (r.content as AgentMessageContent).asks
      if (asks && asks.length > 0 && asks.some((a) => !a.answered)) {
        targetRow = r
        break
      }
    }
    if (!targetRow) return

    const content = targetRow.content as AgentMessageContent
    const asks = content.asks!
    const text = userText.trim()

    let answered: string[]

    if (asks.length === 1) {
      // 单问题：规则匹配
      const ask = asks[0]!
      const options = (ask.options ?? []).map((o) =>
        typeof o === 'string' ? o : ((o as any).label ?? '')
      )
      // 尝试序号匹配（"1"、"①" 等）
      const numMatch = text.match(/^[①②③④⑤1-9]/)
      if (numMatch) {
        const idx = '①②③④⑤'.indexOf(text[0]!)
        const num = idx >= 0 ? idx : parseInt(text[0]!) - 1
        if (num >= 0 && num < options.length) {
          answered = [options[num]!]
        } else {
          answered = [text]
        }
      } else {
        // 尝试选项文本完全匹配（忽略大小写）
        const lowerText = text.toLowerCase()
        const matched = options.find((o) => o.toLowerCase() === lowerText)
        answered = [matched ?? text]
      }
    } else {
      // 多问题：LLM 抽取
      const modelConfigList = await getModelConfigList(
        userId,
        tenantId,
        'router'
      )
      const questionsDesc = asks
        .map(
          (a, i) =>
            `Q${i + 1}: ${a.question}（选项：${(a.options ?? []).map((o) => (typeof o === 'string' ? o : (o as any).label)).join('、')}）`
        )
        .join('\n')
      const result = await modelCall({
        tenantId,
        userId,
        biz: 'AsksExtract',
        bizId: String(sessionId),
        modelConfigList,
        temperature: 0.1,
        context: 'resolve_asks_answers',
        systemPrompt: `从用户回复中提取每个问题的答案。若用户未明确回答某题，用空字符串。`,
        userPrompt: `问题列表：\n${questionsDesc}\n\n用户回复：${text}`,
        schema: AsksAnswerSchema,
      })
      if (result.type === 'json') {
        const data = result.data as z.infer<typeof AsksAnswerSchema>
        answered = asks.map((_, i) => {
          const found = data.answers.find((a) => a.index === i)
          return found?.answered ?? ''
        })
      } else {
        answered = asks.map(() => text)
      }
    }

    // 回写 answered
    const updatedAsks = asks.map((ask, i) => ({
      ...ask,
      answered: answered[i] ?? '',
    }))
    const updatedContent: AgentMessageContent = {
      ...content,
      asks: updatedAsks,
    }
    clawDb.updateAgentMessage(targetRow.id, updatedContent)

    // 广播更新后的消息给所有订阅该 agent 的渠道
    void clawEventBus.emit('asks:answered', {
      agentId,
      sessionId,
      msgId: targetRow.id,
      content: updatedContent,
    })
  } catch (err) {
    logger.warn({ err }, 'resolveAsksAnswers failed')
  }
}

// ─── Per-turn context（仅存用户文本，不再缓存工具状态）────────────────────────

interface TurnContext {
  agentId: number
  tenantId: number
  userId: number
  sessionId: number
  source: string
  userText: string
}

const turnMap = new Map<string, TurnContext>()

function turnKey(agentId: number, chatId: number): string {
  return `${agentId}:${chatId}`
}

// ─── Listeners ────────────────────────────────────────────────────────────────

export function initAgentLog(): void {
  // ── Incoming: persist user message + init turn context ────────────────────
  clawEventBus.on('message:incoming', (evt: IncomingMessageEvent) => {
    try {
      const agentId = evt.agentId
      const agent = agentManager.get(agentId)
      if (!agent) {
        logger.warn({ agentId }, 'Missing agent for incoming agent-log event')
        return
      }
      const userId = resolveUserId(evt.userId, 'incoming', agentId, evt.chatId)
      if (userId == null) return

      turnMap.set(turnKey(agentId, evt.chatId), {
        agentId,
        tenantId: agent.tenantId,
        userId,
        sessionId: evt.sessionId ?? 0,
        source: evt.source ?? 'channel',
        userText: evt.content.text ?? '',
      })

      const content: AgentMessageContent = {
        role: 'user',
        text: evt.content.text ?? undefined,
        images: evt.content.image?.url ? [evt.content.image.url] : undefined,
        source: evt.source ?? 'channel',
        timestamp: nowTimestamp(),
      }
      const row = clawDb.insertAgentMessage({
        tenantId: agent.tenantId,
        userId,
        agentId,
        sessionId: evt.sessionId ?? 0,
        role: 'user',
        content,
      })

      if (evt.correlationId) {
        void clawEventBus.emit('message:accepted', {
          correlationId: evt.correlationId,
          messageId: row.id,
          sessionId: evt.sessionId ?? 0,
          agentId,
        })
      }

      // 异步解析并回写 asks 答案（不阻塞主流程）
      const sessionId = evt.sessionId ?? 0
      if (sessionId > 0 && evt.content.text) {
        void resolveAsksAnswers(
          sessionId,
          agentId,
          evt.content.text,
          agent.tenantId,
          userId
        )
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to log incoming message')
    }
  })

  // ── Tool start: create stage message, write claw_agent_tool with msg_id ──
  clawEventBus.on('tool:start', (evt: ToolStartEvent) => {
    try {
      const key = turnKey(evt.agentId, evt.chatId)
      let ctx = turnMap.get(key)
      if (!ctx) {
        const agent = agentManager.get(evt.agentId)
        if (!agent) return
        ctx = {
          agentId: evt.agentId,
          tenantId: agent.tenantId,
          userId: agent.userId,
          sessionId: 0,
          source: 'channel',
          userText: '',
        }
        turnMap.set(key, ctx)
      }

      const params = evt.params ?? {}
      const action =
        typeof params['action'] === 'string' ? params['action'] : undefined
      const reasoning =
        typeof params['reasoning'] === 'string'
          ? params['reasoning']
          : undefined
      const detailParams: Record<string, unknown> = { ...params }
      if (reasoning) delete detailParams['reasoning']

      const label = action ? `${evt.toolName}.${action}` : evt.toolName
      const title = reasoning || label
      const meta: Record<string, any> = {
        toolCallId: evt.toolCallId,
        toolName: evt.toolName,
        label,
      }
      if (Object.keys(detailParams).length > 0) {
        meta.detail = JSON.stringify(detailParams).slice(0, 500)
      }

      // 1. 先创建消息，拿到 msg_id
      let msgId = 0
      try {
        const row = clawDb.insertAgentMessage({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          agentId: evt.agentId,
          sessionId: ctx.sessionId,
          role: 'assistant',
          content: {
            role: 'assistant',
            stage: { title, status: 'running' },
            meta,
            source: ctx.source as AgentMessageContent['source'],
            timestamp: nowTimestamp(),
          },
        })
        msgId = row.id
      } catch (err) {
        logger.warn({ err }, 'Failed to insert tool stage message')
      }

      // 2. 写入 claw_agent_tool，带上 msg_id、title、meta
      try {
        clawDb.insertAgentTool({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          agentId: evt.agentId,
          sessionId: ctx.sessionId,
          toolCallId: evt.toolCallId,
          toolName: evt.toolName,
          title,
          meta,
          params: evt.params as Record<string, unknown> | undefined,
          msgId,
        })
      } catch {
        // non-blocking
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to log tool:start')
    }
  })

  // ── Tool end: look up msg_id from claw_agent_tool, update message ─────────
  clawEventBus.on('tool:end', (evt: ToolEndEvent) => {
    try {
      const toolRow = clawDb.findAgentToolByCallId(evt.toolCallId)
      if (toolRow && toolRow.msg_id > 0) {
        try {
          const ctx = turnMap.get(turnKey(evt.agentId, evt.chatId))
          // 从表里读 title 和 meta，无需内存缓存
          let parsedMeta: Record<string, any> | undefined
          try {
            parsedMeta = JSON.parse(toolRow.meta)
          } catch {
            /* ignore */
          }
          clawDb.updateAgentMessage(toolRow.msg_id, {
            role: 'assistant',
            stage: {
              title: toolRow.title || toolRow.tool_name,
              status: evt.success ? 'success' : 'error',
              success: evt.success ? (evt.result ?? undefined) : undefined,
              error: evt.success ? undefined : (evt.result ?? undefined),
            },
            meta: parsedMeta,
            source: (ctx?.source ?? 'channel') as AgentMessageContent['source'],
            timestamp: nowTimestamp(),
          } as AgentMessageContent)
        } catch (err) {
          logger.warn({ err }, 'Failed to update tool stage message')
        }
      }

      // 更新 claw_agent_tool 状态
      try {
        if (toolRow) {
          clawDb.updateAgentTool(toolRow.id, {
            status: evt.success ? 'success' : 'error',
            durationMs: evt.durationMs,
            result: (evt.result ?? '').slice(0, 2000),
          })
        }
      } catch {
        // non-blocking
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to log tool:end')
    }
  })

  // ── Tool progress: append logs to claw_agent_tool only ────────────────────
  clawEventBus.on('tool:progress', (evt: ToolProgressEvent) => {
    try {
      if (evt.stepContent) {
        try {
          const logLine = `[${evt.stepStatus}] ${evt.stepTitle}${evt.stepContent ? ': ' + evt.stepContent.slice(0, 500) : ''}`
          clawDb.appendAgentToolLog(evt.toolCallId, logLine)
        } catch {
          // non-blocking
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to log tool:progress')
    }
  })

  // ── Outgoing: persist assistant reply ─────────────────────────────────────
  clawEventBus.on('message:outgoing', (evt: OutgoingMessageEvent) => {
    try {
      const agentId = evt.agentId
      const agentObj = agentManager.get(agentId)
      if (!agentObj) {
        logger.warn({ agentId }, 'Missing agent for outgoing agent-log event')
        return
      }
      const userId = resolveUserId(evt.userId, 'outgoing', agentId, evt.chatId)
      if (userId == null) return

      const key = turnKey(agentId, evt.chatId)
      const ctx = turnMap.get(key)
      const userText = ctx?.userText ?? ''
      turnMap.delete(key)

      const content: AgentMessageContent = evt.dbContent ?? {
        role: 'assistant',
        text: evt.content.text ?? undefined,
        source: evt.source ?? 'channel',
        timestamp: nowTimestamp(),
      }
      clawDb.insertAgentMessage({
        tenantId: agentObj.tenantId,
        userId,
        agentId,
        sessionId: evt.sessionId ?? 0,
        role: 'assistant',
        content,
      })

      if ((evt.sessionId ?? 0) > 0) {
        clawDb.incrementChatSessionMessageCount(
          evt.sessionId!,
          userText.slice(0, 100)
        )
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to log outgoing message')
    }
  })

  // ── Max rounds reached: mark running tool messages as error via DB ────────
  clawEventBus.on('agent:maxRoundsReached', (evt: MaxRoundsReachedEvent) => {
    try {
      const ctx = turnMap.get(turnKey(evt.agentId, evt.chatId))
      turnMap.delete(turnKey(evt.agentId, evt.chatId))
      // 查找该 agent+session 下所有 running 的工具记录
      const runningTools = clawDb
        .listAgentTools(ctx?.tenantId ?? 0, ctx?.userId ?? 0, {
          agentId: evt.agentId,
          sessionId: ctx?.sessionId,
        })
        .filter((t) => t.status === 'running')
      for (const tool of runningTools) {
        try {
          clawDb.updateAgentTool(tool.id, {
            status: 'error',
            result: '执行超时',
          })
          if (tool.msg_id > 0) {
            clawDb.updateAgentMessage(tool.msg_id, {
              role: 'assistant',
              stage: {
                title: tool.tool_name,
                status: 'error',
                error: '执行超时',
              },
              source: (ctx?.source ??
                'channel') as AgentMessageContent['source'],
              timestamp: nowTimestamp(),
            } as AgentMessageContent)
          }
        } catch {
          /* non-blocking */
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to finalize tools on maxRoundsReached')
    }
  })

  logger.info('Agent log listener initialized')
}
