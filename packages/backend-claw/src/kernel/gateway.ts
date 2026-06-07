/**
 * claw gateway: manages all TelegramAdapters and coordinates agent lifecycle.
 * Acts as the central hub between agents and their Telegram bots.
 *
 * Responsibilities:
 * - Start / stop individual member bots
 * - Route proactive messages to the right adapter
 * - Monitor overall system health
 * - Publish lifecycle and message events on clawEventBus
 * - Resolve and own session lifecycle for all incoming messages
 *
 * Event-driven flow:
 *   clawEventBus 'message:incoming'  ─► (gateway) calls processMessage()
 *   gateway                         ─► emits 'message:typing'  (adapter sends typing action)
 *   gateway                         ─► emits 'message:outgoing' (adapter sends the reply)
 *   gateway                         ─► emits 'agent:started' / 'agent:stopped'
 *   gateway                         ─► emits 'bot:error'
 */

import { TelegramAdapter } from '../channel/telegram/index.js'
import type {
  AdapterStatus,
  ClawMessage,
  Agent,
  AgentContext,
} from '../types/index.js'
import { clawMessage } from '../types/index.js'
import { agentManager } from '../agent/index.js'
import { getAgentLogger } from '../utils/logger.js'
import {
  clawEventBus,
  type IncomingMessageEvent,
  type OutgoingMessageEvent,
  type TypingEvent,
  type TaskPausedEvent,
} from './eventBus.js'
import {
  MAX_ROUNDS_SENTINEL,
  ABORT_SENTINEL,
  ASKS_SENTINEL,
  popPendingAsksState,
  resumeFromAsks,
  processMessage,
} from './model.js'
import {
  abortAgentLoop,
  hasPendingRounds,
  isAgentLoopRunning,
} from './model.js'
import { getUserLang } from '../../../backend/src/locale/index.js'
import {
  runAgentMessage,
  AgentAgentRunner,
  agentHasAgentGraph,
} from './agent.js'
import { createLogger } from './logger.js'
import {
  getSessionWorkflow,
  setWorkflowIdle,
  pushWorkflowStack,
  popWorkflowStack,
  findPausedWorkflowSession,
} from './sessionWorkflow.js'
import { detectIntent } from './intentDetector.js'
import { clawDb } from '../storage/store/index.js'
import type { WorkflowPausedContext } from './sessionWorkflow.js'

import {
  detectCancelIntent,
  detectContinueIntent,
} from '../../../backend/src/agent/util/cancelContinueIntent.js'

const logger = createLogger('gateway')

export class BotGateway {
  /** Active Telegram adapters keyed by agentId */
  private adapters = new Map<number, TelegramAdapter>()

  constructor() {
    // Subscribe to incoming messages emitted by channel adapters
    clawEventBus.on('message:incoming', (evt) => this._handleIncoming(evt))
    // Route outgoing messages and typing indicators to the correct per-agent adapter
    clawEventBus.on('message:outgoing', (evt) => this._dispatchOutgoing(evt))
    clawEventBus.on('message:typing', (evt) => this._dispatchTyping(evt))
  }

  // ─── Incoming message handler ─────────────────────────────────────────────
  private _dispatchOutgoing(evt: OutgoingMessageEvent): void {
    if (evt.source === 'web' || evt.source === 'task_job') return
    const adapter = this.adapters.get(evt.agentId)
    if (!adapter) return
    adapter.deliverOutgoing(evt.chatId, evt.content.text ?? '')
  }

  private _dispatchTyping(evt: TypingEvent): void {
    const adapter = this.adapters.get(evt.agentId)
    if (!adapter) return
    adapter.deliverTyping(evt.chatId)
  }
  /**
   * Central handler for ALL incoming messages regardless of source (channel, web, cron …).
   * Emits typing → runs Model agentic loop → emits outgoing reply (or error).
   * Source is propagated from the incoming event so each channel listener can filter its own replies.
   */
  private async _handleIncoming(evt: IncomingMessageEvent): Promise<void> {
    // cron, agent_call sources manage their own processMessage calls;
    // if they emit message:incoming it is only for DB persistence via agentLog.ts.
    // task_job is handled below (goes through the full agent loop).
    if (evt.source === 'cron' || evt.source === 'agent_call') {
      return
    }

    const { agentId, chatId, content, channelId, userId } = evt

    let agent = agentManager.get(agentId)
    if (!agent) {
      // 找不到目标 agent，转交 supervisor 接管
      const supervisor = agentManager
        .listAll()
        .find((m) => m.roleName === 'supervisor')
      if (!supervisor) {
        logger.warn(
          `message:incoming for unknown agent ${agentId} — ignoring (no supervisor found)`
        )
        return
      }
      logger.warn(
        `message:incoming for unknown agent ${agentId} — routing to supervisor`
      )
      agent = supervisor
    }
    if (!agent) {
      return
    }

    // Use the actual agent's id for all downstream events (may differ from incoming agentId
    // if the original agent was not found and we routed to supervisor).
    const effectiveAgentId = agent.id

    // Create agent logger early so intent detection logs go to logs/agent/ as well.
    const sessionId = evt.sessionId ?? 0
    const agentLogger = getAgentLogger(
      agent.roleName,
      agent.id,
      String(sessionId)
    )

    // ── Continuation / cancel intent ──────────────────────────────────────
    // Applies to all non-background sources (cron/agent_call already returned above).
    if (evt.source !== 'task_job') {
      const text = evt.content.text ?? ''

      // Only detect continue intent when there are actually pending rounds to resume.
      if (hasPendingRounds(effectiveAgentId, chatId)) {
        const continueResult = await detectContinueIntent(
          text,
          evt.source === 'web' ? evt.userId : agent.userId,
          agent.tenantId,
          { logger: agentLogger }
        )
        if (continueResult.shouldContinue) {
          clawEventBus.emit('agent:continueRounds', {
            agentId: effectiveAgentId,
            chatId,
            channelId,
          })
          return
        }
      }

      if (isAgentLoopRunning(effectiveAgentId, chatId)) {
        // Fast-path: /stop command directly aborts without AI inference
        if (text.trim() === '/stop') {
          abortAgentLoop(effectiveAgentId, chatId)
          return
        }
        const contextUserForCancel =
          evt.source === 'web' ? evt.userId : agent.userId
        const cancelResult = await detectCancelIntent(
          text,
          contextUserForCancel,
          agent.tenantId,
          { logger: agentLogger }
        )
        if (cancelResult.shouldCancel && cancelResult.confidence >= 0.7) {
          abortAgentLoop(effectiveAgentId, chatId)
        }
        return
      }
    }

    // Signal typing immediately (non-blocking) — skip for background task_job
    if (evt.source !== 'task_job') {
      clawEventBus.emit('message:typing', {
        agentId: effectiveAgentId,
        chatId,
        channelId,
      })
    }

    const contextUserId = evt.source === 'web' ? evt.userId : agent.userId
    const agentContext: AgentContext = {
      logger: agentLogger,
      tenantId: agent.tenantId,
      userId: contextUserId,
      agentId: agent.id,
      sessionId,
      ...(evt.taskId ? { taskId: evt.taskId } : {}),
    }

    // Propagate source and correlationId so each channel listener can match its own messages.
    const source = evt.source ?? 'channel'
    const { correlationId } = evt

    // Run the agentic loop asynchronously — fire-and-forget; replies surface via message:outgoing
    ;(async () => {
      try {
        let response: string

        if (evt.source === 'task_job' && (evt.taskId ?? 0) > 0) {
          // Task-job: check for pending asks state (resume) or start fresh
          const taskId = evt.taskId!
          const pendingAsks = popPendingAsksState(sessionId)
          if (pendingAsks) {
            response = await resumeFromAsks(
              pendingAsks,
              content.text ?? '',
              agentContext
            )
          } else {
            response = await processMessage(
              agent,
              chatId,
              content,
              'default',
              channelId,
              taskId,
              sessionId,
              agentContext
            )
          }
        } else {
          // ── Intent-based routing for non-task messages ──────────────────────
          response = await _routeByIntent(
            agent,
            agentContext,
            content,
            chatId,
            channelId,
            sessionId,
            source
          )
        }

        // MAX_ROUNDS: processMessage already emits 'agent:maxRoundsReached'.
        // Reply will come later via 'agent:continueRounds'. Do not emit outgoing.
        if (response === MAX_ROUNDS_SENTINEL) return
        // ASKS_SENTINEL: workflow paused — suppress outgoing (asks message already emitted by tool).
        if (response === ASKS_SENTINEL) {
          if (evt.source === 'task_job' && (evt.taskId ?? 0) > 0) {
            void clawEventBus.emit('task:paused', {
              taskId: evt.taskId!,
              agentId: effectiveAgentId,
              sessionId,
            } satisfies TaskPausedEvent)
          }
          return
        }
        // ABORT: translate sentinel to a user-facing message before persisting / routing.
        const userLang = await getUserLang(agent.tenantId, contextUserId)
        const isZh = userLang !== 'en-US'
        const replyText =
          response === ABORT_SENTINEL
            ? isZh
              ? '⏹️ 任务已被用户中止'
              : '⏹️ Task aborted by user'
            : response
        clawEventBus.emit('message:outgoing', {
          agentId: effectiveAgentId,
          chatId,
          content: clawMessage.text(replyText),
          userId,
          channelId,
          source,
          correlationId,
          sessionId,
          agentContext,
        })
      } catch (err) {
        const rawErrorMsg = err instanceof Error ? err.message : String(err)
        const isNotConfigured =
          rawErrorMsg === 'Model.NotConfigured' ||
          rawErrorMsg === 'Model.CallFailed'
        const userLangErr = await getUserLang(agent.tenantId, contextUserId)
        const isZhErr = userLangErr !== 'en-US'
        const errorMsg = isNotConfigured
          ? isZhErr
            ? '请先前往「设置 → 模型」配置可用的 AI 模型后再试。'
            : 'Please configure an AI model in Settings → Model before proceeding.'
          : rawErrorMsg.length > 200
            ? rawErrorMsg.slice(0, 200) + '...'
            : rawErrorMsg
        agentContext.logger.error(
          { err },
          `processMessage failed for ${agent.title} chat=${chatId}`
        )
        clawEventBus.emit('bot:error', {
          agentId: effectiveAgentId,
          chatId,
          error: errorMsg,
        })
        clawEventBus.emit('message:outgoing', {
          agentId: effectiveAgentId,
          chatId,
          content: clawMessage.text(errorMsg),
          userId,
          isError: true,
          channelId,
          source,
          correlationId,
          sessionId,
          agentContext,
        })
      }
    })()
  }

  // ─── Member lifecycle ─────────────────────────────────────────────────────

  /**
   * Start a bot for a specific agent.
   * Validates the token, registers handlers, and begins long-polling.
   */
  async startAgent(agent: Agent): Promise<void> {
    if (this.adapters.has(agent.id)) {
      logger.warn(`Agent ${agent.title} (${agent.id}) is already running`)
      return
    }

    logger.info(
      `Starting bot for agent "${agent.title}" (role: ${agent.roleName})`
    )

    const adapter = new TelegramAdapter(agent)

    // Validate token before committing
    try {
      await adapter.validate()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`Token validation failed for "${agent.title}": ${msg}`)
      throw new Error(`Invalid Telegram token for "${agent.title}": ${msg}`)
    }

    await adapter.start()
    this.adapters.set(agent.id, adapter)
    agentManager.setActive(agent.id, true)

    clawEventBus.emit('agent:started', {
      agentId: agent.id,
      agentTitle: agent.title,
    })
    logger.info(`✅ Agent "${agent.title}" is now running`)
  }

  /**
   * Stop a specific agent's bot.
   */
  async stopAgent(agentId: number): Promise<void> {
    const adapter = this.adapters.get(agentId)
    if (!adapter) {
      logger.warn(`No active adapter found for agent ${agentId}`)
      return
    }

    const agent = agentManager.get(agentId)
    const agentTitle = agent?.title ?? String(agentId)

    await adapter.stop()
    this.adapters.delete(agentId)
    agentManager.setActive(agentId, false)

    clawEventBus.emit('agent:stopped', {
      agentId: agentId,
      agentTitle: agentTitle,
    })
    logger.info(`Agent "${agentTitle}" stopped`)
  }

  /**
   * Start all registered agents.
   * Failed starts are logged but do not abort the others.
   */
  async startAll(): Promise<void> {
    const agents = agentManager.listAll()
    logger.info(`Starting ${agents.length} agents...`)

    const results = await Promise.allSettled(
      agents.map((w) => this.startAgent(w))
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    const started = results.length - failed
    logger.info(`Gateway ready: ${started} started, ${failed} failed`)
  }

  /**
   * Stop all running bots gracefully.
   */
  async stopAll(): Promise<void> {
    const agentIds = [...this.adapters.keys()]
    logger.info(`Stopping ${agentIds.length} agents...`)

    await Promise.allSettled(agentIds.map((id) => this.stopAgent(id)))
    logger.info('All bots stopped')
  }

  // ─── Proactive messaging ──────────────────────────────────────────────────

  /**
   * Send a proactive message to a specific chat through a member's bot.
   * For reactive replies triggered by the Model loop use clawEventBus 'message:outgoing' instead.
   */
  async sendMessage(
    agentId: number,
    chatId: number,
    content: ClawMessage
  ): Promise<void> {
    const adapter = this.adapters.get(agentId)
    if (!adapter) {
      throw new Error(`No active adapter for agent ${agentId}`)
    }
    const agent = agentManager.get(agentId)
    if (!agent) {
      throw new Error(`No agent found for agentId ${agentId}`)
    }
    await adapter.sendMessage(chatId, content.text ?? '')
    const agentContext: AgentContext = {
      logger: getAgentLogger(agent.roleName, agent.id, '0'),
      tenantId: agent.tenantId,
      userId: agent.userId,
      agentId: agent.id,
      sessionId: 0,
    }
    clawEventBus.emit('message:outgoing', {
      agentId,
      chatId,
      content,
      userId: agent.userId,
      source: 'channel',
      agentContext,
    })
  }

  // ─── Health / observability ───────────────────────────────────────────────

  /**
   * Get the status of all running adapters.
   */
  getStatuses(): AdapterStatus[] {
    return [...this.adapters.values()].map((a) => a.getStatus())
  }

  /**
   * Print a human-readable health report.
   */
  healthReport(): string {
    const statuses = this.getStatuses()
    if (statuses.length === 0) {
      return '⚠️  No active bots'
    }
    const lines = statuses.map((s) => {
      const icon = s.running ? '🟢' : '🔴'
      const bot = s.botUsername ? `@${s.botUsername}` : '(no username)'
      const last = s.lastActivity
        ? s.lastActivity.toLocaleTimeString()
        : 'never'
      return `  ${icon} ${s.agentTitle} — ${bot} | errors: ${s.errorCount} | last: ${last}`
    })
    return `claw Gateway Status (${statuses.length} bots):\n${lines.join('\n')}`
  }
}

/** Singleton gateway */
export const botGateway = new BotGateway()

// ─── Intent-based routing ─────────────────────────────────────────────────────

/**
 * Route a non-task_job message based on the current session workflow state and intent detection.
 *
 * Routing table:
 *   chat                      → processMessage (standard LLM chat)
 *   start_workflow            → pushWorkflowStack + AgentAgentRunner._runGraph
 *   continue_workflow         → resumeWorkflow from paused state
 *   terminate_workflow        → clear state + processMessage with context
 *   restore_previous_workflow → pop stack + resumeWorkflow
 */
async function _routeByIntent(
  agent: Agent,
  agentContext: AgentContext,
  content: ClawMessage,
  chatId: number,
  channelId: number | undefined,
  sessionId: number,
  source: string
): Promise<string> {
  const log = agentContext.logger

  // Agents without a workflow graph always use chat mode
  if (!agentHasAgentGraph(agent)) {
    return processMessage(
      agent,
      chatId,
      content,
      'default',
      channelId,
      undefined,
      sessionId,
      agentContext
    )
  }

  const wfState = getSessionWorkflow(sessionId)
  const userText = content.text ?? ''

  const action = await detectIntent(agent, agentContext, userText, wfState)

  log.info({ action, wfMode: wfState.mode }, '[gateway] intent detected')

  if (action === 'chat') {
    return processMessage(
      agent,
      chatId,
      content,
      'default',
      channelId,
      undefined,
      sessionId,
      agentContext
    )
  }

  const runner = new AgentAgentRunner(agent)

  if (action.type === 'start_workflow') {
    // Push any current paused state onto the stack and start the new pipeline
    pushWorkflowStack(sessionId, action.pipelineKey)
    return runAgentMessage(agent, agentContext, content, {
      chatId,
      channelId,
      sessionId,
      pipelineKey: action.pipelineKey,
    })
  }

  if (action.type === 'continue_workflow') {
    let pausedCtx = wfState.pausedContext
    let resumeContext = agentContext
    if (!pausedCtx) {
      // Current session has no paused workflow. Search other sessions of this agent.
      const found = findPausedWorkflowSession(
        effectiveAgentId,
        agent.tenantId,
        contextUserId
      )
      if (found) {
        log.info(
          { fromSession: sessionId, toSession: found.sessionId },
          '[gateway] cross-session continue_workflow: found paused workflow in another session'
        )
        pausedCtx = found.pausedContext
        resumeContext = { ...agentContext, sessionId: found.sessionId }
      }
    }
    if (!pausedCtx) {
      log.warn(
        '[gateway] continue_workflow but no pausedContext — falling back to chat'
      )
      return processMessage(
        agent,
        chatId,
        content,
        'default',
        channelId,
        undefined,
        sessionId,
        agentContext
      )
    }
    // Check if post-coder set nextPipeline — start a fresh pipeline instead of resuming.
    const nextPipeline = pausedCtx.context?.nextPipeline as string | undefined
    if (nextPipeline) {
      const nextPipelineDef = agent.config.agents?.[nextPipeline]
      if (nextPipelineDef) {
        log.info(
          { nextPipeline },
          '[gateway] nextPipeline redirect — starting new pipeline'
        )
        const resolvedSessionId = resumeContext.sessionId ?? sessionId
        setWorkflowIdle(resolvedSessionId)
        pushWorkflowStack(resolvedSessionId, nextPipeline)
        const syntheticPausedCtx = {
          pipelineKey: nextPipeline,
          executedNodes: [] as string[],
          messages: [] as unknown[],
          context: { ...pausedCtx.context, nextPipeline: undefined },
        }
        const pipelineResult = await runner.resumeWorkflow(
          resumeContext,
          nextPipeline,
          syntheticPausedCtx as typeof pausedCtx,
          content,
          chatId,
          channelId
        )

        // Auto-chain: if restorer set autoResumeNextPipeline, start next pipeline immediately
        const savedData = clawDb.getSessionData(resolvedSessionId)
        const chainPipeline =
          savedData?.autoResumeNextPipeline &&
          typeof savedData?.nextPipeline === 'string'
            ? (savedData.nextPipeline as string)
            : undefined
        if (chainPipeline && agent.config.agents?.[chainPipeline]) {
          log.info({ chainPipeline }, '[gateway] auto-chaining after rejection')
          const cleanContext: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(savedData)) {
            if (
              k !== '_workflow' &&
              k !== 'autoResumeNextPipeline' &&
              k !== 'nextPipeline'
            ) {
              cleanContext[k] = v
            }
          }
          clawDb.updateSessionData(resolvedSessionId, cleanContext)
          pushWorkflowStack(resolvedSessionId, chainPipeline)
          const chainedCtx: WorkflowPausedContext = {
            pipelineKey: chainPipeline,
            executedNodes: [],
            messages: [],
            context: cleanContext,
            pausedAt: new Date().toISOString(),
            autoChained: true,
          }
          return runner.resumeWorkflow(
            resumeContext,
            chainPipeline,
            chainedCtx,
            content,
            chatId,
            channelId
          )
        }

        return pipelineResult
      }
      log.warn(
        { nextPipeline },
        '[gateway] nextPipeline not found in agent config — ignoring'
      )
    }
    return runner.resumeWorkflow(
      resumeContext,
      pausedCtx.pipelineKey,
      pausedCtx,
      content,
      chatId,
      channelId
    )
  }

  if (action.type === 'terminate_workflow') {
    setWorkflowIdle(sessionId)
    const terminateLang = await getUserLang(agent.tenantId, agentContext.userId)
    const isZhTerminate = terminateLang !== 'en-US'
    const context = wfState.pipelineKey
      ? `(${isZhTerminate ? '已退出工作流' : 'Exited workflow'}: ${wfState.pipelineKey})\n\n`
      : ''
    const adjustedContent = {
      ...content,
      text: context + (content.text ?? ''),
    } as typeof content
    return processMessage(
      agent,
      chatId,
      adjustedContent,
      'default',
      channelId,
      undefined,
      sessionId,
      agentContext
    )
  }

  if (action.type === 'restore_previous_workflow') {
    const restoredCtx = popWorkflowStack(sessionId)
    if (!restoredCtx) {
      log.warn(
        '[gateway] restore_previous_workflow but stack is empty — using chat'
      )
      return processMessage(
        agent,
        chatId,
        content,
        'default',
        channelId,
        undefined,
        sessionId,
        agentContext
      )
    }
    return runner.resumeWorkflow(
      agentContext,
      restoredCtx.pipelineKey,
      restoredCtx,
      content,
      chatId,
      channelId
    )
  }

  // Fallback
  return processMessage(
    agent,
    chatId,
    content,
    'default',
    channelId,
    undefined,
    sessionId,
    agentContext
  )
}
