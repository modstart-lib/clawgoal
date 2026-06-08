/**
 * Dynamic code loading system for agent workflow modules.
 *
 * Built-in roles:   loaded via static imports in workflowRegistry.ts (bundled into binary)
 * User-defined roles: loaded via dynamic import() from agent._roleDir/workflow.mjs or .js
 *
 * The ClawgoalAPI object is passed as the sole argument to every exported workflow function,
 * giving user code safe access to agent state, tool execution, and flow control.
 */

import path from 'node:path'
import type { BaseMessage } from '@langchain/core/messages'
import type { Agent, AgentContext, ToolResult } from '../types/index.js'
import { toolRegistry } from '../tools/index.js'
import { ASKS_SENTINEL } from './model.js'
import { getBuiltinWorkflow } from '../agent/roles/workflowRegistry.js'
import { clawEventBus } from './eventBus.js'
import { getUserLang } from '../../../backend/src/locale/index.js'

// ─── ClawgoalAPI ─────────────────────────────────────────────────────────────

/**
 * Capability object injected into every workflow function call.
 * Provides read/write access to agent state and flow control primitives.
 */
export interface ClawgoalAPI {
  /** Current workflow context (read-write) */
  readonly context: Record<string, unknown>
  /** Full message history (read-only snapshot) */
  readonly messages: readonly BaseMessage[]
  /** Text output of the most recently executed node */
  readonly lastOutput: string
  /** Agent instance */
  readonly agent: Agent
  /** Agent execution context (tenantId, userId, sessionId, …) */
  readonly agentContext: AgentContext
  /** Set a context key (same as context_set tool) */
  setContext(key: string, value: unknown): void
  /** Get a context value */
  getContext(key: string): unknown
  /** Override workflow output text directly */
  setOutput(text: string): void
  /**
   * Execute a registered tool and return its result.
   * Automatically intercepts asks pause (result.pause === true) to trigger workflow pause.
   * @param toolName  The tool's registered name (e.g. 'asks', 'audit_codespace_accept')
   * @param args      Tool arguments object
   */
  executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult>
  /**
   * Route to a specific node after this code node finishes.
   * If not called, the workflow engine follows the normal graph edges.
   */
  routeTo(nodeId: string): void
  /**
   * Ask the user a question (sends a chat message via the `asks` tool) and pause the workflow.
   * The workflow resumes when the user replies.
   * @param message  Message shown to the user
   * @param opts     Optional: question label, preset option buttons, auditId for diff view button
   */
  askUser(
    message: string,
    opts?: {
      question?: string
      options?: string[]
      actionView?: { label: string; data?: Record<string, any> }
    }
  ): Promise<void>
  /** Immediately terminate the workflow execution. */
  stopWorkflow(): void
  /**
   * Append a message to the conversation history.
   * Use this to inject a follow-up reminder into the message thread before routing to retry.
   * Only call with proper LangChain BaseMessage instances (HumanMessage, AIMessage, etc.).
   */
  pushMessage(msg: BaseMessage): void
}

// Internal mutable state passed by reference into createClawgoal
export interface ClawgoalInternalState {
  _next: string | null
  _asks: string | null
  _stop: boolean
}

/**
 * Create a ClawgoalAPI bound to the given shared context.
 * @param context   Shared agent graph context
 * @param state     Mutable internal state modified by routeTo/askUser/stopWorkflow
 */
export function createClawgoal(
  context: {
    state: {
      messages: BaseMessage[]
      lastOutput: string
      context: Record<string, unknown>
    }
    agent: Agent
    agentContext: AgentContext
    cancelWorkflow?: () => void
    chatId?: number
    channelId?: number
    nodeId?: string
    progressCallback?: (event: Record<string, unknown>) => void
  },
  state: ClawgoalInternalState
): ClawgoalAPI {
  const { agent, agentContext } = context
  const agentState = context.state

  const allowedTools = toolRegistry.getEffectiveAllowedTools(
    agent.config.capabilities.tools,
    agent.config.permissions
  )

  return {
    get context() {
      return agentState.context
    },
    get messages() {
      return agentState.messages as readonly BaseMessage[]
    },
    get lastOutput() {
      return agentState.lastOutput
    },
    get agent() {
      return agent
    },
    get agentContext() {
      return agentContext
    },

    setContext(key, value) {
      agentState.context[key] = value
    },
    getContext(key) {
      return agentState.context[key]
    },
    setOutput(text) {
      agentState.lastOutput = text
    },

    async executeTool(toolName, args) {
      const toolCallId = `cg_${Date.now()}`
      const ts = Date.now()
      clawEventBus.emit('tool:start', {
        agentId: agent.id,
        chatId: context.chatId,
        toolName,
        toolCallId,
        params: args,
        channelId: context.channelId,
      })
      const result = await toolRegistry.execute(toolName, args, allowedTools, {
        agentContext,
        toolCallId,
      })
      const durationMs = Date.now() - ts
      clawEventBus.emit('tool:end', {
        agentId: agent.id,
        chatId: context.chatId,
        toolName,
        toolCallId,
        success: result.success,
        durationMs,
        result: result.success ? result.output : result.error,
        channelId: context.channelId,
      })
      context.progressCallback?.({
        type: 'tool_call_end',
        nodeId: context.nodeId ?? 'code',
        round: 1,
        toolName,
        toolCallId,
        args,
        output: result.success ? result.output : (result.error ?? ''),
        success: result.success,
        durationMs,
        error: result.success ? undefined : (result.error ?? undefined),
        meta: result.meta ?? undefined,
      })
      // Intercept asks pause: asks tool sets pause:true to trigger workflow pause
      if (result.pause) {
        state._asks = ''
        agentState.lastOutput = ASKS_SENTINEL
        context.cancelWorkflow?.()
      }
      return result
    },

    routeTo(nodeId) {
      state._next = nodeId
    },

    async askUser(message, opts) {
      const askLang = await getUserLang(agent.tenantId, agent.userId)
      await this.executeTool('asks', {
        content: message,
        question:
          opts?.question ??
          (askLang !== 'en-US' ? '请选择操作：' : 'Select action:'),
        options: opts?.options,
        actionView: opts?.actionView,
      })
    },

    stopWorkflow() {
      state._stop = true
      context.cancelWorkflow?.()
    },

    pushMessage(msg) {
      agentState.messages.push(msg)
    },
  }
}

// ─── Workflow types ───────────────────────────────────────────────────────────

/**
 * Handler for a single code node.
 * ClawgoalAPI is captured via the WorkflowFactory closure — no argument needed.
 */
export type NodeHandler = () => Promise<void>

/**
 * Object returned by a WorkflowFactory.
 * Define node handlers inside `nodes`, keyed by the node name from config.yaml.
 */
export interface WorkflowDefinition {
  /** Called before the node handler executes. Optional setup hook. */
  onEnter?: () => Promise<void>
  /** Called after the node handler executes. Optional teardown hook. */
  onExit?: () => Promise<void>
  /** Map of node name → async handler. ClawgoalAPI is available via factory closure. */
  nodes: Record<string, NodeHandler>
}

/**
 * Factory function exported from a role's workflow.ts.
 *
 * Called once per code node execution with a fresh ClawgoalAPI bound to the
 * current execution context. Returns a WorkflowDefinition whose node handlers
 * can call clawgoal.routeTo(), askUser(), executeTool(), etc. via closure.
 *
 * @example
 * ```ts
 * export const work: WorkflowFactory = (clawgoal) => ({
 *   async onEnter() {},
 *   async onExit() {},
 *   nodes: {
 *     my_node: async () => {
 *       clawgoal.routeTo('next_node')
 *     },
 *   },
 * })
 * ```
 */
export type WorkflowFactory = (clawgoal: ClawgoalAPI) => WorkflowDefinition

// ─── Module cache ─────────────────────────────────────────────────────────────

// Cache loaded modules to avoid re-importing on every node execution
const moduleCache = new Map<string, Record<string, (...args: any[]) => any>>()

/**
 * Load the workflow module for an agent.
 * Resolution order:
 *   1. Built-in role name → static import via workflowRegistry
 *   2. _roleDir set → dynamic import from <roleDir>/workflow.mjs or /workflow.js
 */
export async function loadWorkflowModule(
  agent: Agent
): Promise<Record<string, (...args: any[]) => any>> {
  // 1. Built-in roles — static registry (bundled into binary)
  if (agent._builtinRoleName) {
    const cacheKey = `builtin:${agent._builtinRoleName}`
    if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey)!
    const mod = getBuiltinWorkflow(agent._builtinRoleName)
    if (mod) {
      moduleCache.set(cacheKey, mod)
      return mod
    }
  }

  // 2. External user role — dynamic import from role directory
  if (agent._roleDir) {
    const cacheKey = `dir:${agent._roleDir}`
    if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey)!

    const candidates = [
      path.join(agent._roleDir, 'workflow.mjs'),
      path.join(agent._roleDir, 'workflow.js'),
    ]

    for (const filePath of candidates) {
      try {
        const mod = await import(filePath)
        const exports = { ...mod }
        moduleCache.set(cacheKey, exports)
        return exports
      } catch {
        // try next candidate
      }
    }
  }

  return {}
}
