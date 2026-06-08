import { ToolMessage } from '@langchain/core/messages'
import type {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowSchedule,
} from '../../../../backend/src/workflow/type.js'
import { toolRegistry } from '../../tools/index.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import type { AgentGraphSharedContext } from '../types.js'

/**
 * AgentTool node — executes a registered tool directly without an LLM.
 *
 * Reads/writes via sharedContext.state:
 *   - state.lastOutput / state.context  (input hints + result storage)
 *   - state.messages                    (ToolMessage appended)
 *
 * node.properties.data fields:
 *   - toolName: string
 *   - input?: Record<string, any>   (static overrides, merged with state hints)
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
    const toolName: string | undefined = data.toolName
    if (!toolName) {
      return {
        status: 'error',
        statusMsg: 'AgentTool: toolName is required',
        runOutputs: {},
      }
    }

    const args: Record<string, unknown> = {
      ...(state.context ?? {}),
      ...(data.input ?? {}),
    }
    if (typeof state.lastOutput === 'string' && state.lastOutput.trim()) {
      if (typeof args.search !== 'string') args.search = state.lastOutput
      if (typeof args.keywords !== 'string') args.keywords = state.lastOutput
      // For web_batch_search: auto-populate keywordsList from lastOutput if missing
      if (!Array.isArray(args.keywordsList))
        args.keywordsList = [state.lastOutput]
      // For web_batch_fetch: auto-populate urlList from lastOutput if missing
      if (!Array.isArray(args.urlList))
        args.urlList = state.lastOutput
          .split(/\s+/)
          .filter((s) => s.startsWith('http'))
    }

    const allowedTools = toolRegistry.getEffectiveAllowedTools(
      agent.config.capabilities.tools,
      agent.config.permissions
    )
    const toolCallId = `${param.node.id}_direct`

    clawEventBus.emit('tool:start', {
      agentId: agent.id,
      chatId,
      toolName,
      toolCallId,
      params: args,
      channelId,
    })

    const ts = Date.now()
    const toolResult = await toolRegistry.execute(
      toolName,
      args,
      allowedTools,
      {
        agentContext,
        toolCallId,
      }
    )
    const durationMs = Date.now() - ts
    const output = toolResult.success
      ? toolResult.output
      : `Error: ${toolResult.error}`

    clawEventBus.emit('tool:end', {
      agentId: agent.id,
      chatId,
      toolName,
      toolCallId,
      success: toolResult.success,
      durationMs,
      result: output,
      channelId,
    })

    state.lastOutput = output
    state.context[toolName] = output
    state.messages.push(
      new ToolMessage({ content: output, tool_call_id: toolCallId })
    )

    return {
      status: 'success',
      statusMsg: '',
      runOutputs: { Output: output },
      runData: { _meta: { tools: [toolName] } },
    }
  },
} satisfies WorkflowSchedule
