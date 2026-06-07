import type { BaseMessage } from '@langchain/core/messages'
import { AIMessage, ToolMessage } from '@langchain/core/messages'
import type {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowSchedule,
} from '../../../../backend/src/workflow/type.js'
import {
  modelCall,
  resolveAgentModelListByRef,
} from '../../../../backend/src/model/model/index.js'
import { jsonStringify } from '../../../../backend/src/utils/json.js'
import { getUserLang } from '../../../../backend/src/locale/index.js'
import { toolRegistry } from '../../tools/index.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import { ASKS_SENTINEL, storeRawMessage } from '../../kernel/model.js'
import { clawDb } from '../../storage/store/index.js'
import { resolvePlaceholders } from '../../kernel/promptPlaceholders.js'
import { CONTEXT_SET_PREFIX } from '../../tools/context.js'
import type { AgentGraphSharedContext } from '../types.js'

/**
 * AgentModel node — calls a model slot with optional tool-call loop.
 *
 * Reads/writes via sharedContext.state:
 *   - state.messages  (BaseMessage[]) — conversation history; new AIMessage is appended
 *   - state.lastOutput (string)       — set to the final text response
 *
 * node.properties.data fields:
 *   - modelSlot?: string        (default: 'default')
 *   - useTools?: boolean        (default: true)
 *   - systemPromptExtra?: string
 */
export default {
  async run(
    _controller: NodeRunController,
    param: NodeRunParam,
    _ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    const shared = param.sharedContext as AgentGraphSharedContext
    const { agent, agentContext, chatId, channelId } = shared
    const state = shared.state

    const data = param.node.properties.data || {}
    const slot: string = data.modelSlot ?? 'default'
    const useTools: boolean = data.useTools !== false
    const systemPromptExtra: string | undefined = data.systemPromptExtra

    const { modelRef, modelConfigs } = await resolveAgentModelListByRef(
      agent,
      slot
    )

    const language = await getUserLang(
      Number(agent.tenantId),
      Number(agent.userId)
    )

    const baseSystemPrompt =
      agent.config.models[slot] && typeof agent.config.models[slot] === 'object'
        ? ((agent.config.models[slot] as any).systemPrompt ?? '')
        : ''
    const resolvedSystemPrompt = await resolvePlaceholders(baseSystemPrompt, {
      language,
      agentParam: agent.param,
      context: state.context,
    })
    const systemPrompt = systemPromptExtra
      ? `${resolvedSystemPrompt}\n\n${systemPromptExtra}`
      : resolvedSystemPrompt

    const allowedTools = toolRegistry.getEffectiveAllowedTools(
      agent.config.capabilities.tools,
      agent.config.permissions
    )
    // Per-node tool restriction: if `allowTools` is set, intersect with agent-level allowed tools
    const nodeAllowTools: string[] | undefined = Array.isArray(data.allowTools)
      ? (data.allowTools as string[])
      : undefined
    const effectiveTools = nodeAllowTools
      ? allowedTools.filter((t) => nodeAllowTools.includes(t))
      : allowedTools
    const toolDefs = useTools
      ? toolRegistry.getDefinitionsForRole(effectiveTools)
      : []

    const maxToolRounds = agent.config.model.maxToolRounds ?? 20
    const appendMessages: BaseMessage[] = [...state.messages]
    let rounds = 0
    let lastModel = ''
    const usedTools: string[] = []

    const log = agentContext.logger
    const tid = Number(agent.tenantId)
    const uid = Number(agent.userId)
    const sid = agentContext.sessionId ?? 0

    // Store only NEW human messages not yet persisted to DB
    const storedCount = state.storedMessageCount ?? 0

    // Route message storage: workflow-internal messages go to claw_agent_workflow_message,
    // plain chat messages go to claw_chat_message_raw.
    const wfId = shared.workflowId
    const storeMsg = (msg: BaseMessage) => {
      if (wfId) {
        const type = msg._getType()
        const item: Record<string, unknown> = { type, content: msg.content }
        if (type === 'ai') {
          const ai = msg as AIMessage
          if (ai.tool_calls?.length) item.tool_calls = ai.tool_calls
        } else if (type === 'tool') {
          const tool = msg as ToolMessage
          item.tool_call_id = tool.tool_call_id
        }
        clawDb.insertWorkflowMessage({
          tenantId: tid,
          userId: uid,
          workflowId: wfId,
          sessionId: sid,
          message: JSON.stringify(item),
        })
      } else {
        storeRawMessage(tid, uid, sid, msg)
      }
    }

    for (const msg of state.messages.slice(storedCount)) {
      if (msg._getType() === 'human') {
        storeMsg(msg)
      }
    }
    state.storedMessageCount = state.messages.length

    while (rounds < maxToolRounds) {
      rounds++
      log.info(
        `[AgentModel node=${param.node.id}] [round ${rounds}] model:start`
      )

      const nodeId = param.node.id
      const roundStart = Date.now()
      // Wrap in object so TS control-flow doesn't narrow to null after callback assignment
      const _usageRef: {
        value: {
          model: string
          durationMs: number
          promptTokens?: number
          completionTokens?: number
          requestBody?: unknown
          responseBody?: unknown
        } | null
      } = { value: null }

      const result = await modelCall({
        tenantId: agent.tenantId,
        userId: agent.userId,
        biz: 'Session',
        bizId: String(agentContext.sessionId),
        modelConfigList: modelConfigs,
        systemPrompt,
        appendMessages: [...appendMessages],
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        temperature: modelRef.temperature ?? agent.config.model.temperature,
        maxRetry: modelConfigs.length,
        onModelCallStart: (model) => {
          lastModel = model
          log.info(
            { model },
            `[AgentModel node=${param.node.id}] [round ${rounds}] model:call`
          )
        },
        onModelCallEnd: (model, _status, duration, usage) => {
          const durationMs = duration ?? Date.now() - roundStart
          log.info(
            { model, durationMs },
            `[AgentModel node=${param.node.id}] [round ${rounds}] model:done`
          )
          _usageRef.value = {
            model,
            durationMs,
            promptTokens: usage?.promptTokens,
            completionTokens: usage?.completionTokens,
            requestBody: usage?.requestBody,
            responseBody: usage?.responseBody,
          }
        },
      })

      // Emit model_call_end after result is available so responsePreview can be included
      if (_usageRef.value !== null && shared.progressCallback) {
        const cu = _usageRef.value
        const responsePreview =
          result.type === 'text'
            ? result.content.slice(0, 200)
            : result.type === 'tools'
              ? result.tools
                  .map(
                    (t: any) =>
                      `${t.name}(${jsonStringify(t.args).slice(0, 80)})`
                  )
                  .join(', ')
              : ''
        shared.progressCallback({
          type: 'model_call_end',
          nodeId,
          round: rounds,
          model: cu.model,
          durationMs: cu.durationMs,
          promptTokens: cu.promptTokens,
          completionTokens: cu.completionTokens,
          requestBody: cu.requestBody,
          responseBody: cu.responseBody,
          responsePreview,
        })
      }

      if (result.type === 'tools') {
        appendMessages.push(result.message)
        storeMsg(result.message) // AI tool-call turn
        for (const tc of result.tools) {
          log.info(
            { tool: tc.name, args: jsonStringify(tc.args).slice(0, 300) },
            `[AgentModel node=${param.node.id}] → tool:start`
          )
          clawEventBus.emit('tool:start', {
            agentId: agent.id,
            chatId,
            toolName: tc.name,
            toolCallId: tc.id,
            params: tc.args as Record<string, unknown>,
            channelId,
          })
          const ts = Date.now()
          const toolResult = await toolRegistry.execute(
            tc.name,
            tc.args,
            effectiveTools,
            {
              agentContext,
              toolCallId: tc.id,
            }
          )
          const durationMs = Date.now() - ts
          if (!usedTools.includes(tc.name)) usedTools.push(tc.name)

          // Check for asks pause — stop the workflow and yield to the user
          if (toolResult.pause) {
            clawEventBus.emit('tool:end', {
              agentId: agent.id,
              chatId,
              toolName: tc.name,
              toolCallId: tc.id,
              success: true,
              durationMs,
              result: toolResult.output,
              channelId,
            })
            log.info(
              `[AgentModel node=${param.node.id}] asks pause detected — stopping workflow`
            )
            state.lastOutput = ASKS_SENTINEL
            // Cancel the running workflow so execution stops after this node
            shared.cancelWorkflow?.()
            return {
              status: 'success',
              statusMsg: 'asks_pause',
              runOutputs: { Text: ASKS_SENTINEL },
            }
          }

          const toolOutput = toolResult.success
            ? toolResult.output
            : `Error: ${toolResult.error}`

          // Intercept context_set sentinel — update state.context in-memory
          if (toolResult.success && toolOutput.startsWith(CONTEXT_SET_PREFIX)) {
            try {
              const payload = JSON.parse(
                toolOutput.slice(CONTEXT_SET_PREFIX.length)
              ) as { key: string; value: string }
              state.context[payload.key] = payload.value
              log.info(
                `[AgentModel node=${param.node.id}] context_set: ${payload.key}=${payload.value}`
              )
            } catch {
              // ignore parse errors
            }
          }

          // Persist tool meta to workflow context so code nodes can read side-effect data
          if (
            toolResult.success &&
            toolResult.meta &&
            typeof toolResult.meta === 'object'
          ) {
            const meta = toolResult.meta as Record<string, unknown>
            if (typeof meta.auditId === 'number') {
              state.context['recentAuditId'] = meta.auditId
            }
          }

          clawEventBus.emit('tool:end', {
            agentId: agent.id,
            chatId,
            toolName: tc.name,
            toolCallId: tc.id,
            success: toolResult.success,
            durationMs,
            result: toolOutput,
            channelId,
          })
          if (shared.progressCallback) {
            shared.progressCallback({
              type: 'tool_call_end',
              nodeId,
              round: rounds,
              toolName: tc.name,
              toolCallId: tc.id,
              args: tc.args,
              output: toolOutput,
              success: toolResult.success,
              durationMs,
              error: toolResult.success
                ? undefined
                : (toolResult.error ?? undefined),
              meta: toolResult.meta ?? undefined,
            })
          }
          appendMessages.push(
            new ToolMessage({ content: toolOutput, tool_call_id: tc.id })
          )
          storeMsg(
            new ToolMessage({ content: toolOutput, tool_call_id: tc.id })
          ) // tool result
        }
        continue
      }

      const text = result.type === 'text' ? result.content : ''
      const aiMsg = new AIMessage(text)
      storeMsg(aiMsg) // final AI text response
      state.messages.push(aiMsg)
      state.lastOutput = text
      return {
        status: 'success',
        statusMsg: '',
        runOutputs: { Text: text },
        runData: { _meta: { model: lastModel, tools: usedTools } },
      }
    }

    // Max rounds reached — force text-only response
    log.warn(
      `[AgentModel node=${param.node.id}] max tool rounds reached, forcing text`
    )
    const forced = await modelCall({
      tenantId: agent.tenantId,
      userId: agent.userId,
      biz: 'Session',
      bizId: String(agentContext.sessionId),
      modelConfigList: modelConfigs,
      systemPrompt,
      appendMessages: [...appendMessages],
      tools: undefined,
      temperature: modelRef.temperature ?? agent.config.model.temperature,
      maxRetry: modelConfigs.length,
      onModelCallStart: (model) => {
        log.info({ model }, `[AgentModel node=${param.node.id}] model:forced`)
      },
      onModelCallEnd: (model, status, duration) => {
        log.info(
          { model, status, duration },
          `[AgentModel node=${param.node.id}] model:forced:done`
        )
      },
    })
    const text = forced.type === 'text' ? forced.content : ''
    const forcedMsg = new AIMessage(text)
    storeMsg(forcedMsg)
    state.messages.push(forcedMsg)
    state.lastOutput = text
    return {
      status: 'success',
      statusMsg: '',
      runOutputs: { Text: text },
      runData: { _meta: { model: lastModel, tools: usedTools } },
    }
  },
} satisfies WorkflowSchedule
