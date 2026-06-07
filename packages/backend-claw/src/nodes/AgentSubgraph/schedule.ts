import type {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowSchedule,
} from '../../../../backend/src/workflow/type.js'
import type { AgentGraphSharedContext } from '../types.js'
import type { Agent, ClawMessage } from '../../types/index.js'

/**
 * AgentSubgraph node — delegates execution to another role's agent graph.
 *
 * node.properties.data fields:
 *   - subgraphRole: string    role name to load (must have agents config)
 *   - pipelineName?: string   specific pipeline within that role (default: first)
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
    const subgraphRole: string | undefined = data.subgraphRole
    if (!subgraphRole) {
      return {
        status: 'error',
        statusMsg: 'AgentSubgraph: subgraphRole is required',
        runOutputs: {},
      }
    }

    const { agentManager } = await import('../../agent/index.js')
    const roleConfig = agentManager.getRole(subgraphRole)
    if (!roleConfig) {
      return {
        status: 'error',
        statusMsg: `AgentSubgraph: role "${subgraphRole}" not found`,
        runOutputs: {},
      }
    }

    const subAgent: Agent = {
      id: agent.id,
      tenantId: agent.tenantId,
      userId: agent.userId,
      title: roleConfig.title,
      description: roleConfig.description,
      roleName: subgraphRole,
      config: roleConfig,
      active: true,
      workStatus: 'idle',
      avatar: null,
      avatarConfig: null,
      channelIds: [],
      webhookEnable: false,
      webhookToken: null,
      createdAt: new Date(),
    }

    const syntheticContent: ClawMessage = {
      type: 'text',
      text: state.lastOutput,
    }

    const { runAgentMessage } = await import('../../kernel/agent.js')
    const subOutput = await runAgentMessage(
      subAgent,
      agentContext,
      syntheticContent,
      {
        chatId: shared.chatId,
        channelId: shared.channelId,
      }
    )

    state.lastOutput = subOutput
    return {
      status: 'success',
      statusMsg: '',
      runOutputs: { Output: subOutput },
    }
  },
} satisfies WorkflowSchedule
