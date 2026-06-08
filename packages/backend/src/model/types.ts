import type pino from 'pino'

/**
 * Agent-level execution context shared across all tool calls within the same agentic turn.
 * Populated by the kernel before dispatch; NOT exposed to the Model.
 */
export interface AgentContext {
  /** Per-agent file logger — all tool logs are written here so they appear in the agent's log file. */
  logger: pino.Logger
  /** Corp/tenant id. Used for multi-tenant data isolation. */
  tenantId: number
  /** ID of the user who triggered the tool call. Used for data isolation. */
  userId: number
  /** Session ID for context isolation. Used for conversation history scoping. */
  sessionId: number
  /** ID of the agent executing the tool call. Used for agent-scoped memory/soul. */
  agentId: number
  /** DB task/session grouping ID (web UI sends this; used for message persistence). */
  taskId?: number
}

/**
 * Execution context passed to every tool handler.
 * This context is NOT exposed to the Model — it is populated by the kernel
 * before dispatch so tools can perform multi-tenant isolation without
 * relying on Model-supplied arguments.
 */
export interface ToolContext {
  /** Agent-level context shared across all tool calls in the same agentic turn. */
  agentContext: AgentContext
  /** Unique ID for the current tool call — shared across tool:start / tool:progress / tool:end events. */
  toolCallId: string
}
