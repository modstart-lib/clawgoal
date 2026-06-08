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
import { getUserLang } from '../../../../backend/src/locale/index.js'
import { resolvePlaceholders } from '../../kernel/promptPlaceholders.js'
import type { AgentGraphSharedContext } from '../types.js'

/**
 * AgentRouter node — lightweight LLM call that returns a single routing key.
 *
 * The key is written to:
 *   - sharedContext.state.lastOutput
 *   - runData.Next (string anchor ID, consumed by engine conditional routing)
 *
 * node.properties.data fields:
 *   - modelSlot?: string        (default: 'router')
 *   - systemPromptExtra?: string
 *   - branches?: string[]       (valid branch names — for documentation only)
 */
export default {
  async run(
    _controller: NodeRunController,
    param: NodeRunParam,
    _ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    const shared = param.sharedContext as AgentGraphSharedContext
    const { agent, agentContext } = shared
    const state = shared.state

    const data = param.node.properties.data || {}
    const slot: string = data.modelSlot ?? 'router'
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

    const log = agentContext.logger
    log.info(`[AgentRouter node=${param.node.id}] model:call`)
    let lastModel = ''

    const result = await modelCall({
      tenantId: agent.tenantId,
      userId: agent.userId,
      biz: 'Session',
      bizId: String(agentContext.sessionId),
      modelConfigList: modelConfigs,
      systemPrompt,
      appendMessages: [...state.messages],
      tools: undefined,
      temperature: modelRef.temperature ?? 0.1,
      maxRetry: modelConfigs.length,
      onModelCallStart: (model) => {
        lastModel = model
        log.info({ model }, `[AgentRouter node=${param.node.id}] model:start`)
      },
      onModelCallEnd: (model, status, duration) => {
        log.info(
          { model, status, duration },
          `[AgentRouter node=${param.node.id}] model:done`
        )
      },
    })

    const routingKey = (result.type === 'text' ? result.content : '')
      .trim()
      .toLowerCase()
    log.info(`[AgentRouter node=${param.node.id}] routing key: "${routingKey}"`)

    // Router nodes do NOT write to state.lastOutput to avoid polluting the final reply

    return {
      status: 'success',
      statusMsg: '',
      runOutputs: { Route: routingKey },
      runData: { Next: routingKey, _meta: { model: lastModel } },
    }
  },
} satisfies WorkflowSchedule
