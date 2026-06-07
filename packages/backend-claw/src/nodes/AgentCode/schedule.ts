import type {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowSchedule,
} from '../../../../backend/src/workflow/type.js'
import { ASKS_SENTINEL } from '../../kernel/model.js'
import {
  createClawgoal,
  loadWorkflowModule,
  type ClawgoalInternalState,
  type WorkflowDefinition,
} from '../../kernel/dynamicCode.js'
import type { AgentGraphSharedContext } from '../types.js'

/**
 * AgentCode node — executes a code node via one of two modes:
 *
 * 1. **Factory mode** (`codeWorkflow` set in node data):
 *    Loads the role's workflow module, calls `module[codeWorkflow](clawgoal)`
 *    to get a WorkflowDefinition, then invokes `nodes[codeFn || nodeId]()`.
 *    `onEnter` / `onExit` hooks are called around the node handler.
 *
 * 2. **Inline mode** (`code` set in node data):
 *    Executes the code string as an async function with `clawgoal` in scope.
 *    Useful for simple one-off logic defined directly in config.yaml.
 *
 * Node handler (or inline code) may call:
 *   - clawgoal.routeTo(nodeId)   → override next node
 *   - clawgoal.askUser(msg)      → pause workflow for user input
 *   - clawgoal.stopWorkflow()    → terminate immediately
 *   - clawgoal.setContext / getContext / executeTool
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
    const codeWorkflow: string | undefined = data.codeWorkflow
    const codeFn: string | undefined = data.codeFn
    const codeInline: string | undefined = data.code

    if (!codeWorkflow && !codeInline) {
      return {
        status: 'error',
        statusMsg: `AgentCode [${param.node.id}]: node requires either 'codeWorkflow' or 'code'`,
        runOutputs: {},
      }
    }

    // Build ClawgoalAPI with internal mutable state for flow control
    const internalState: ClawgoalInternalState = {
      _next: null,
      _asks: null,
      _stop: false,
    }

    const clawgoal = createClawgoal(
      {
        state: state as any,
        agent,
        agentContext,
        cancelWorkflow: shared.cancelWorkflow,
        chatId: shared.chatId,
        channelId: shared.channelId,
        nodeId: param.node.id,
        progressCallback: shared.progressCallback,
      },
      internalState
    )

    try {
      if (codeInline) {
        // ── Inline mode: code string from config.yaml ──────────────────────
        const AsyncFunction = Object.getPrototypeOf(async function () {})
          .constructor as new (
          ...args: string[]
        ) => (...a: unknown[]) => Promise<void>
        const fn = new AsyncFunction('clawgoal', codeInline)
        await fn(clawgoal)
      } else {
        // ── Factory mode: WorkflowFactory from workflow module ─────────────
        let mod: Record<string, (...args: any[]) => any>
        try {
          mod = await loadWorkflowModule(agent)
        } catch (err) {
          return {
            status: 'error',
            statusMsg: `AgentCode [${param.node.id}]: failed to load workflow module — ${err}`,
            runOutputs: {},
          }
        }

        const factory = mod[codeWorkflow!]
        if (typeof factory !== 'function') {
          return {
            status: 'error',
            statusMsg: `AgentCode [${param.node.id}]: workflow factory "${codeWorkflow}" not found in module`,
            runOutputs: {},
          }
        }

        const definition: WorkflowDefinition = factory(clawgoal)
        const nodeKey = codeFn || param.node.id
        const nodeFn = definition.nodes[nodeKey]
        if (typeof nodeFn !== 'function') {
          return {
            status: 'error',
            statusMsg: `AgentCode [${param.node.id}]: node handler "${nodeKey}" not found in workflow "${codeWorkflow}"`,
            runOutputs: {},
          }
        }

        if (definition.onEnter) await definition.onEnter()
        await nodeFn()
        if (definition.onExit) await definition.onExit()
      }
    } catch (err) {
      return {
        status: 'error',
        statusMsg: `AgentCode [${param.node.id}] threw: ${err}`,
        runOutputs: {},
      }
    }

    // Handle askUser() — pause the workflow
    if (internalState._asks !== null) {
      return {
        status: 'success',
        statusMsg: 'asks_pause',
        runOutputs: { Text: ASKS_SENTINEL },
      }
    }

    // Handle stopWorkflow()
    if (internalState._stop) {
      return {
        status: 'success',
        statusMsg: 'stopped',
        runOutputs: {},
      }
    }

    // Handle routeTo()
    if (internalState._next !== null) {
      return {
        status: 'success',
        statusMsg: '',
        runOutputs: { Next: internalState._next },
        runData: { Next: internalState._next },
      }
    }

    // Normal completion — no routing override
    return {
      status: 'success',
      statusMsg: '',
      runOutputs: { Text: state.lastOutput },
    }
  },
} satisfies WorkflowSchedule
