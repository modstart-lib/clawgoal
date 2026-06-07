/**
 * AgentAgentRunner — executes a role's declarative agent graph using
 * the workflow engine (packages/backend/src/workflow).
 *
 * Execution model:
 *  1. Convert the YAML AgentGraphDefinition to WorkflowData via buildWorkflowData().
 *  2. Build a sharedContext containing the agent, agentContext, chatId, and mutable state.
 *  3. Execute via workflowExecute() with the sharedContext injected into execContext.
 *  4. Return the final assistant text from sharedContext.state.lastOutput.
 */

import type { MessageContent } from '@langchain/core/messages'
import { HumanMessage } from '@langchain/core/messages'
import {
  modelCall,
  resolveAgentModelListByRef,
} from '../../../backend/src/model/model/index.js'
import { buildSystemInfoPrompt } from '../../../backend/src/utils/env'
import {
  getUserLang,
  type LocaleKey,
} from '../../../backend/src/locale/index.js'
import type {
  Agent,
  AgentGraphNode,
  AgentPipelineDefinition,
  ClawMessage,
  ModelRef,
} from '../types/index.js'
import type { AgentContext } from '../../../backend/src/model/types.js'
import { createLogger } from './logger.js'
import { clawDb } from '../storage/store/index.js'
import {
  MAX_ROUNDS_SENTINEL,
  ABORT_SENTINEL,
  ASKS_SENTINEL,
  processMessage,
  setWorkflowProcessing,
  clearWorkflowProcessing,
  registerWorkflowCancel,
} from './model.js'
import { buildWorkflowData } from './agentGraphBuilder.js'
import { workflowExecute } from '../../../backend/src/workflow/engine.js'
import { registerAgentNodes } from '../nodes/index.js'
import type {
  AgentGraphSharedContext,
  AgentGraphState,
} from '../nodes/types.js'
import {
  getSessionWorkflow,
  setWorkflowActive,
  setWorkflowPaused,
  setWorkflowIdle,
  pushWorkflowStack,
  deserializePausedMessages,
  type WorkflowPausedContext,
} from './sessionWorkflow.js'
import { clawEventBus } from './eventBus.js'

// Register custom agent nodes once at module load time
registerAgentNodes()

const logger = createLogger('agent')

// Re-export AgentGraphState for external consumers
export type { AgentGraphState }

// ─── AgentAgentRunner ────────────────────────────────────────────────────────

export type WorkflowProgressEvent =
  | { type: 'turn_start'; userText: string }
  | { type: 'node_start'; nodeId: string; nodeType: string; nodeTitle: string }
  | {
      type: 'node_finish'
      nodeId: string
      nodeType: string
      nodeTitle: string
      status: string
      durationMs: number | null
      model: string
      tools: string[]
      newRawMessages: any[]
    }
  | {
      type: 'model_call_end'
      nodeId: string
      round: number
      model: string
      durationMs: number
      promptTokens?: number
      completionTokens?: number
      responsePreview?: string
      requestBody?: unknown
      responseBody?: unknown
    }
  | {
      type: 'tool_call_end'
      nodeId: string
      round: number
      toolName: string
      toolCallId: string
      args: unknown
      output: string
      success: boolean
      durationMs: number
      error?: string
      meta?: Record<string, any>
    }

export class AgentAgentRunner {
  private readonly agent: Agent

  constructor(agent: Agent) {
    if (!agent.config.agents || Object.keys(agent.config.agents).length === 0) {
      throw new Error(
        `Agent "${agent.title}" (role=${agent.roleName}) has no pipeline config. ` +
          'Add an `agents` block to the role config.yaml.'
      )
    }
    this.agent = agent
  }

  async run(
    agentContext: AgentContext,
    content: ClawMessage,
    param?: {
      chatId?: number
      channelId?: number
      progressCallback?: (event: WorkflowProgressEvent) => void
    }
  ): Promise<string> {
    const chatId = param?.chatId ?? 0
    const channelId = param?.channelId

    const pipelineEntries = Object.entries(this.agent.config.agents!)

    // Determine which pipeline to run
    let pipeline: AgentPipelineDefinition | undefined

    const routerSlot = this.agent.config.intentRouterSlot ?? 'intent_router'
    const hasRouterSlot = !!this.agent.config.models?.[routerSlot]

    if (!hasRouterSlot) {
      pipeline = pipelineEntries[0]![1]
    } else {
      const intentKey = await this._runIntentRouter(
        agentContext,
        content,
        routerSlot,
        pipelineEntries
      )
      pipeline = this.agent.config.agents![intentKey]
    }

    if (!pipeline) {
      return processMessage(
        this.agent,
        chatId,
        content,
        'default',
        channelId,
        undefined,
        agentContext.sessionId ?? 0,
        agentContext
      )
    }

    return this._runGraph(
      agentContext,
      pipeline,
      content,
      chatId,
      channelId,
      undefined,
      param?.progressCallback
    )
  }

  /** Directly run a named pipeline, bypassing the intent router. Used for testing. */
  async runPipeline(
    agentContext: AgentContext,
    content: ClawMessage,
    pipelineKey: string,
    param?: {
      chatId?: number
      channelId?: number
      progressCallback?: (event: WorkflowProgressEvent) => void
    }
  ): Promise<string> {
    const pipeline = this.agent.config.agents![pipelineKey]
    if (!pipeline) {
      throw new Error(
        `Agent "${this.agent.title}" has no pipeline "${pipelineKey}"`
      )
    }
    return this._runGraph(
      agentContext,
      pipeline,
      content,
      param?.chatId ?? 0,
      param?.channelId,
      undefined,
      param?.progressCallback
    )
  }

  private async _runIntentRouter(
    agentContext: AgentContext,
    content: ClawMessage,
    routerSlot: string,
    pipelineEntries: [string, AgentPipelineDefinition][]
  ): Promise<string> {
    const pipelineKeys = pipelineEntries.map(([k]) => k)
    const pipelineList = pipelineEntries
      .map(([k, p]) => (p.description ? `- ${k}: ${p.description}` : `- ${k}`))
      .join('\n')

    const { modelRef, modelConfigs } = await resolveAgentModelListByRef(
      this.agent,
      routerSlot
    )
    const language = await getUserLang(
      Number(this.agent.tenantId),
      Number(this.agent.userId)
    )

    const slotConfig = this.agent.config.models[routerSlot]
    const basePrompt =
      slotConfig && typeof slotConfig === 'object'
        ? ((slotConfig as any).systemPrompt ?? '')
        : ''
    const systemPrompt =
      `${basePrompt}\n\n` +
      `Classify the user's message into one of the following pipelines, or output "chat" for general conversation.\n` +
      `Available pipelines:\n${pipelineList}\n` +
      `Valid output values: ${[...pipelineKeys, 'chat'].join(', ')}\n\n` +
      buildSystemInfoPrompt(new Date(), language)

    const result = await modelCall({
      tenantId: this.agent.tenantId,
      userId: this.agent.userId,
      biz: 'Session',
      bizId: String(agentContext.sessionId),
      modelConfigList: modelConfigs,
      systemPrompt,
      appendMessages: [new HumanMessage(buildUserContent(content))],
      tools: undefined,
      temperature: modelRef.temperature ?? 0.0,
      maxRetry: modelConfigs.length,
    })

    const key = (result.type === 'text' ? result.content : '')
      .trim()
      .toLowerCase()
    return pipelineKeys.includes(key) ? key : 'chat'
  }

  private async _runGraph(
    agentContext: AgentContext,
    pipeline: AgentPipelineDefinition,
    content: ClawMessage,
    chatId: number,
    channelId?: number,
    /** If provided, resume from this paused state instead of starting fresh */
    resumeFrom?: WorkflowPausedContext,
    progressCallback?: (event: WorkflowProgressEvent) => void
  ): Promise<string> {
    const log = agentContext.logger ?? logger

    const pipelineKey =
      Object.entries(this.agent.config.agents ?? {}).find(
        ([, v]) => v === pipeline
      )?.[0] ?? 'unknown'

    const persistedContext = agentContext.sessionId
      ? clawDb.getSessionData(agentContext.sessionId)
      : {}

    const userText =
      content.type === 'image'
        ? (content.image?.caption ?? '')
        : (content.text ?? '')

    let state: AgentGraphState
    if (resumeFrom) {
      // Restore messages + context from paused state; append user reply as new message
      const restoredMessages = deserializePausedMessages(resumeFrom)
      const restoredCount = restoredMessages.length // all restored messages are already in DB
      restoredMessages.push(new HumanMessage(userText))
      state = {
        messages: restoredMessages,
        lastOutput: userText,
        context: { ...resumeFrom.context },
        storedMessageCount: restoredCount, // only the new human message needs to be stored
      }
    } else {
      state = {
        messages: [new HumanMessage(buildUserContent(content))],
        lastOutput: userText,
        context: { ...persistedContext },
        storedMessageCount: 0,
      }
    }

    const sharedContext: AgentGraphSharedContext = {
      state,
      agent: this.agent,
      agentContext,
      chatId,
      channelId,
      progressCallback: progressCallback as
        | ((event: Record<string, unknown>) => void)
        | undefined,
    }

    // Emit turn_start before workflow nodes so client sees user message first.
    // Skip for auto-chained pipelines (e.g. restorer → coder) to avoid
    // showing the same user message twice.
    if (!resumeFrom?.autoChained) {
      progressCallback?.({ type: 'turn_start', userText })
    }

    const workflowData = buildWorkflowData(pipeline.graph)

    // When resuming from a paused state, pre-mark previously-executed nodes as
    // 'success' so the engine's isContinue mode can skip them correctly.
    if (resumeFrom?.executedNodes?.length) {
      for (const nodeId of resumeFrom.executedNodes) {
        const node = workflowData.nodes.find((n) => n.id === nodeId)
        if (node) {
          node.properties.status = 'success'
        }
      }
    }

    const agentId = Number(this.agent.id)
    const tenantId = Number(this.agent.tenantId)
    const userId = Number(this.agent.userId)
    const sessionId = agentContext.sessionId ?? 0
    const now = () => new Date().toISOString()

    // Mark workflow as active in session state
    setWorkflowActive(sessionId, pipelineKey)

    // 创建 workflow 记录
    const wfRow = clawDb.insertAgentWorkflow({
      tenantId,
      userId,
      agentId,
      sessionId,
      startAt: now(),
      state: { pipeline: pipeline.description ?? '' },
    })
    const wfId = wfRow.id
    sharedContext.workflowId = wfId
    log.info(`[workflow:start] id=${wfId} agent=${this.agent.title}`)

    // Emit workflow:start so agentLog can apply "工作流任务" label
    clawEventBus.emit('workflow:start', {
      agentId,
      chatId,
      sessionId,
      pipelineKey,
      workflowId: wfId,
    })

    // nodeId -> DB row id
    const nodeRowMap = new Map<string, number>()
    // nodeId -> logs[]
    const nodeLogsMap = new Map<string, string[]>()
    // Track successfully executed node IDs for pause serialization
    const executedNodeIds = new Set<string>()
    // progress tracking
    const nodeStartTimes = new Map<string, number>()
    let lastProgressMsgCount = progressCallback
      ? clawDb.listAgentMessageRawBySession(sessionId, 500).length
      : 0

    const { cancel, result } = workflowExecute(workflowData, {
      isContinue: Boolean(resumeFrom?.executedNodes?.length),
      execContext: {
        tenantId,
        userId,
        sharedContext,
      },
      onNodeStart: (_data, nodeId, param) => {
        nodeStartTimes.set(nodeId, Date.now())
        const nodeDef = workflowData.nodes.find((n) => n.id === nodeId)
        const nodeTitle = nodeDef?.properties?.title ?? nodeId
        const nodeType = nodeDef?.type ?? ''
        progressCallback?.({ type: 'node_start', nodeId, nodeType, nodeTitle })
        log.info(
          `[workflow:node:start] wf=${wfId} node=${nodeId}(${nodeType}) "${nodeTitle}"`
        )
        try {
          const nodeRow = clawDb.insertAgentWorkflowNode({
            tenantId,
            userId,
            agentId,
            sessionId,
            workflowId: wfId,
            startAt: now(),
            input: param.runInputs ?? {},
            state: { nodeId, nodeType, nodeTitle },
          })
          nodeRowMap.set(nodeId, nodeRow.id)
          nodeLogsMap.set(nodeId, [])
        } catch (e) {
          log.warn(`[workflow:node:start] failed to record node: ${String(e)}`)
        }
      },
      onNodeFinish: (_data, nodeId, result) => {
        const rowId = nodeRowMap.get(nodeId)
        const nodeDef = workflowData.nodes.find((n) => n.id === nodeId)
        const nodeTitle = nodeDef?.properties?.title ?? nodeId
        const status =
          result.status === 'success' || result.status === 'success_ignore'
            ? 'success'
            : result.status === 'error'
              ? 'error'
              : 'skip'
        const finishMeta = result.runData?._meta as
          | Record<string, any>
          | undefined
        log.info(
          { meta: finishMeta },
          `[workflow:node:finish] wf=${wfId} node=${nodeId} status=${status} msg=${result.statusMsg ?? ''}`
        )
        if (rowId != null) {
          try {
            const baseState = {
              nodeId,
              nodeType: nodeDef?.type ?? '',
              nodeTitle: nodeTitle,
            }
            clawDb.updateAgentWorkflowNode(rowId, {
              endAt: now(),
              status: status as any,
              output: result.runOutputs ?? {},
              logs: nodeLogsMap.get(nodeId) ?? [],
              state: finishMeta ? { ...baseState, ...finishMeta } : undefined,
            })
          } catch (e) {
            log.warn(
              `[workflow:node:finish] failed to update node: ${String(e)}`
            )
          }
        }
        nodeRowMap.delete(nodeId)
        nodeLogsMap.delete(nodeId)
        if (status === 'success') executedNodeIds.add(nodeId)
        if (progressCallback) {
          const startTime = nodeStartTimes.get(nodeId)
          const durationMs = startTime != null ? Date.now() - startTime : null
          const allRawRows = clawDb.listAgentMessageRawBySession(sessionId, 500)
          const newRawMessages = allRawRows
            .slice(lastProgressMsgCount)
            .map((r) => {
              try {
                return JSON.parse(r.message)
              } catch {
                return {}
              }
            })
          lastProgressMsgCount = allRawRows.length
          progressCallback({
            type: 'node_finish',
            nodeId,
            nodeType: nodeDef?.type ?? '',
            nodeTitle: nodeTitle,
            status,
            durationMs,
            model: finishMeta?.model ?? '',
            tools: Array.isArray(finishMeta?.tools) ? finishMeta.tools : [],
            newRawMessages,
          })
        }
        nodeStartTimes.delete(nodeId)
      },
      onLog: (_data, level, message) => {
        if (level === 'warn') log.warn(message)
        else if (level === 'error') log.error(message)
        else log.info(message)
      },
    })

    // 注册 cancel 到 abortAgentLoop 体系，确保 /stop 能立即中断 workflow
    let workflowCancelled = false
    const cancelWrapper = () => {
      workflowCancelled = true
      cancel()
    }
    sharedContext.cancelWorkflow = cancelWrapper
    setWorkflowProcessing(agentId, chatId)
    registerWorkflowCancel(agentId, chatId, cancelWrapper)
    log.info(
      `[workflow:run] id=${wfId} agent=${this.agent.title} chat=${chatId} pipeline=${pipelineKey}`
    )

    let success: boolean
    let errors: string[]
    try {
      const res = await result()
      success = res.success
      errors = res.errors
    } finally {
      clearWorkflowProcessing(agentId, chatId)
    }

    // Detect ASKS pause first: asks tool calls cancelWorkflow() to stop graph execution,
    // which sets workflowCancelled = true. Must check ASKS_SENTINEL before workflowCancelled
    // to avoid treating an asks-pause as a user /stop abort.
    if (state.lastOutput === ASKS_SENTINEL) {
      log.info(
        `[workflow:pause] id=${wfId} serializing paused state to session`
      )
      if (sessionId) {
        setWorkflowPaused(
          sessionId,
          pipelineKey,
          state.messages,
          state.context,
          [...executedNodeIds]
        )
        clawEventBus.emit('workflow:end', {
          agentId,
          chatId,
          sessionId,
          pipelineKey,
        })
      }
      return ASKS_SENTINEL
    }

    // 如果 workflow 被用户主动取消，立即返回中止哨兵
    if (workflowCancelled) {
      log.info(
        `[workflow:abort] id=${wfId} agent=${this.agent.title} cancelled by /stop`
      )
      try {
        clawDb.updateAgentWorkflow(wfId, { endAt: now(), status: 'error' })
      } catch (_e) {
        /* ignore */
      }
      setWorkflowIdle(agentContext.sessionId)
      clawEventBus.emit('workflow:end', {
        agentId,
        chatId,
        sessionId,
        pipelineKey,
      })
      return ABORT_SENTINEL
    }

    // 更新 workflow 完成状态
    try {
      clawDb.updateAgentWorkflow(wfId, {
        endAt: now(),
        status: success ? 'success' : 'error',
      })
    } catch (e) {
      log.warn(
        `[workflow:finish] failed to update workflow record: ${String(e)}`
      )
    }

    if (success) {
      log.info(`[workflow:finish] id=${wfId} status=success`)
    } else {
      log.error(
        `[workflow:finish] id=${wfId} status=error errors=${JSON.stringify(errors)}`
      )
    }
    if (agentContext.sessionId) {
      clawDb.updateSessionData(agentContext.sessionId, state.context)
      setWorkflowIdle(agentContext.sessionId)
    }
    clawEventBus.emit('workflow:end', {
      agentId,
      chatId,
      sessionId,
      pipelineKey,
    })

    if (!success && errors.length > 0) {
      log.error({ errors }, `[agent] workflow errors for ${this.agent.title}`)
    }

    return state.lastOutput || '(no response)'
  }

  /**
   * Resume a paused workflow from saved session state.
   * Called by gateway when the session is in 'paused' mode and the intent is 'continue_workflow'.
   */
  async resumeWorkflow(
    agentContext: AgentContext,
    pipelineKey: string,
    pausedContext: WorkflowPausedContext,
    content: ClawMessage,
    chatId: number,
    channelId?: number,
    progressCallback?: (event: WorkflowProgressEvent) => void
  ): Promise<string> {
    const pipeline = this.agent.config.agents?.[pipelineKey]
    if (!pipeline) {
      logger.warn(
        `[resumeWorkflow] pipeline "${pipelineKey}" not found — falling back to processMessage`
      )
      return processMessage(
        this.agent,
        chatId,
        content,
        'default',
        channelId,
        undefined,
        agentContext.sessionId ?? 0,
        agentContext
      )
    }
    return this._runGraph(
      agentContext,
      pipeline,
      content,
      chatId,
      channelId,
      pausedContext,
      progressCallback
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUserContent(content: ClawMessage): string | MessageContent {
  if (content.type === 'image' && content.image) {
    const parts: any[] = []
    const caption = content.image.caption?.trim() ?? ''
    parts.push({ type: 'text', text: caption || 'Please analyze this image.' })
    if (content.image.url) {
      parts.push({ type: 'image_url', image_url: { url: content.image.url } })
    } else if (content.image.data && content.image.mimeType) {
      const dataUrl = `data:${content.image.mimeType};base64,${content.image.data}`
      parts.push({ type: 'image_url', image_url: { url: dataUrl } })
    }
    return parts
  }
  return content.text ?? ''
}

export function buildNodeSystemPrompt(
  agent: Agent,
  node: AgentGraphNode,
  language: LocaleKey = 'en-US'
): string {
  const slot = node.modelSlot ?? (node.type === 'router' ? 'router' : 'default')
  const slots = agent.config.models
  const raw = slots?.[slot] ?? slots?.['default']
  const slotRef: ModelRef | undefined =
    typeof raw === 'string' ? { name: raw } : (raw as ModelRef | undefined)

  const base = slotRef?.systemPrompt ?? ''
  const extra = node.systemPromptExtra ? `\n\n${node.systemPromptExtra}` : ''
  const timeHint = `\n\n${buildSystemInfoPrompt(new Date(), language)}`
  const behaviorHint =
    node.type === 'router'
      ? '\n\n## Output Format\nYou are a route classifier. Reply ONLY with a single lowercase routing key. Output nothing else.'
      : ''

  return `${base}${extra}${behaviorHint}${timeHint}`.trim()
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createAgentRunner(agent: Agent): AgentAgentRunner | null {
  if (!agent.config.agents || Object.keys(agent.config.agents).length === 0)
    return null
  return new AgentAgentRunner(agent)
}

export function agentHasAgentGraph(agent: Agent): boolean {
  return !!agent.config.agents && Object.keys(agent.config.agents).length > 0
}

export async function runAgentMessage(
  agent: Agent,
  agentContext: AgentContext,
  content: ClawMessage,
  options: {
    chatId: number
    channelId?: number
    sessionId?: number
    pipelineKey?: string
    /** @internal passed through to progressCallback */
    progressCallback?: (event: WorkflowProgressEvent) => void
  }
): Promise<string> {
  if (agentHasAgentGraph(agent)) {
    const runner = new AgentAgentRunner(agent)
    if (options.pipelineKey) {
      return runner.runPipeline(agentContext, content, options.pipelineKey, {
        chatId: options.chatId,
        channelId: options.channelId,
        progressCallback: options.progressCallback,
      })
    }
    // Check if the session has a paused workflow — resume instead of starting fresh
    const sessionId = agentContext.sessionId ?? 0
    if (sessionId) {
      const wfState = getSessionWorkflow(sessionId)
      logger.info(
        `[runAgentMessage] sessionId=${sessionId} wfMode=${wfState.mode} hasPausedCtx=${!!wfState.pausedContext} executedNodes=${wfState.pausedContext?.executedNodes?.length ?? 0}`
      )
      if (wfState.mode === 'paused' && wfState.pausedContext) {
        const pausedCtx = wfState.pausedContext
        // Check if a nextPipeline redirect was set (e.g. post_coder sets nextPipeline='merger')
        const nextPipeline = pausedCtx.context?.nextPipeline as
          | string
          | undefined
        if (nextPipeline) {
          const nextPipelineDef = agent.config.agents?.[nextPipeline]
          if (nextPipelineDef) {
            logger.info(
              `[runAgentMessage] nextPipeline redirect: ${pausedCtx.pipelineKey} → ${nextPipeline}`
            )
            setWorkflowIdle(sessionId)
            pushWorkflowStack(sessionId, nextPipeline)
            const syntheticPausedCtx: WorkflowPausedContext = {
              pipelineKey: nextPipeline,
              executedNodes: [],
              messages: [],
              context: { ...pausedCtx.context, nextPipeline: undefined },
              pausedAt: new Date().toISOString(),
            }
            const pipelineResult = await runner.resumeWorkflow(
              agentContext,
              nextPipeline,
              syntheticPausedCtx,
              content,
              options.chatId,
              options.channelId,
              options.progressCallback
            )

            // Auto-chain: if the pipeline (e.g. restorer) set autoResumeNextPipeline,
            // immediately start the next pipeline with the same user message.
            const savedData = clawDb.getSessionData(sessionId)
            const chainPipeline =
              savedData?.autoResumeNextPipeline &&
              typeof savedData?.nextPipeline === 'string'
                ? (savedData.nextPipeline as string)
                : undefined
            if (chainPipeline && agent.config.agents?.[chainPipeline]) {
              logger.info(
                `[runAgentMessage] auto-chaining after rejection: → ${chainPipeline}`
              )
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
              clawDb.updateSessionData(sessionId, cleanContext)
              pushWorkflowStack(sessionId, chainPipeline)
              const chainedCtx: WorkflowPausedContext = {
                pipelineKey: chainPipeline,
                executedNodes: [],
                messages: [],
                context: cleanContext,
                pausedAt: new Date().toISOString(),
                autoChained: true,
              }
              return runner.resumeWorkflow(
                agentContext,
                chainPipeline,
                chainedCtx,
                content,
                options.chatId,
                options.channelId,
                options.progressCallback
              )
            }

            return pipelineResult
          }
        }
        return runner.resumeWorkflow(
          agentContext,
          pausedCtx.pipelineKey,
          pausedCtx,
          content,
          options.chatId,
          options.channelId,
          options.progressCallback
        )
      }
    }
    return runner.run(agentContext, content, {
      chatId: options.chatId,
      channelId: options.channelId,
      progressCallback: options.progressCallback,
    })
  }
  return processMessage(
    agent,
    options.chatId,
    content,
    'default',
    options.channelId,
    undefined,
    options.sessionId ?? 0,
    agentContext
  )
}
