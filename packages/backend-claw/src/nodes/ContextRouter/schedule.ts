import type {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowSchedule,
} from '../../../../backend/src/workflow/type.js'
import type { AgentGraphSharedContext } from '../types.js'

/**
 * ContextRouter node — deterministic context-based routing without any LLM call.
 *
 * Checks whether `state.context[contextKey]` is set (truthy).
 * - If set   → routes to `whenSet`
 * - If unset but `outputPattern` matches `state.lastOutput` → auto-sets context and routes to `whenSet`
 * - Otherwise → routes to `whenNotSet`
 *
 * node.properties.data fields:
 *   - contextKey: string         — key to check in state.context
 *   - whenSet: string            — routing key when context key is truthy
 *   - whenNotSet: string         — routing key when context key is falsy/absent
 *   - outputPattern?: string     — substring to test against state.lastOutput as fallback
 *   - outputContextValue?: string — value to write to state.context[contextKey] on pattern match (default 'true')
 */
export default {
  async run(
    _controller: NodeRunController,
    param: NodeRunParam,
    _ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    const shared = param.sharedContext as AgentGraphSharedContext
    const state = shared.state

    const data = param.node.properties.data || {}
    const contextKey: string = data.contextKey ?? ''
    const whenSet: string = data.whenSet ?? 'set'
    const whenNotSet: string = data.whenNotSet ?? 'notset'
    const outputPattern: string | undefined = data.outputPattern
    const outputContextValue: string = data.outputContextValue ?? 'true'

    let isSet = contextKey ? Boolean(state.context[contextKey]) : false

    // Fallback: if context key not yet set, check whether the previous node's
    // text output matches the outputPattern. If it does, auto-persist the value.
    if (!isSet && outputPattern && contextKey) {
      const lastOut =
        typeof state.lastOutput === 'string' ? state.lastOutput : ''
      if (lastOut.includes(outputPattern)) {
        state.context[contextKey] = outputContextValue
        isSet = true
      }
    }

    const routingKey = isSet ? whenSet : whenNotSet

    state.lastOutput = routingKey

    return {
      status: 'success',
      statusMsg: '',
      runOutputs: { Next: routingKey },
      // runData.Next is consumed by the engine's ROUTER_TYPES routing logic
      runData: { Next: routingKey },
    }
  },
} satisfies WorkflowSchedule
