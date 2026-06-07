import type { BaseMessage } from '@langchain/core/messages'
import type { Agent, AgentContext } from '../types/index.js'

/**
 * Mutable state shared across all nodes during a single agent graph execution.
 * Passed via WorkflowExecuteContext.sharedContext.
 */
export interface AgentGraphState {
  /** Growing message history (OpenAI-compatible). Shared across all nodes. */
  messages: BaseMessage[]
  /** Text output of the most recently executed node (used by routing). */
  lastOutput: string
  /** Free-form key/value scratchpad for inter-node data passing. */
  context: Record<string, unknown>
  /** Number of messages already persisted to DB; nodes only persist messages[storedMessageCount:] */
  storedMessageCount: number
}

/** The full shared context object injected into every Agent node. */
export interface AgentGraphSharedContext {
  state: AgentGraphState
  agent: Agent
  agentContext: AgentContext
  chatId: number
  channelId?: number
  /** Workflow DB row ID (set after wfRow is created). Used by AgentModel nodes
   *  to route messages to claw_agent_workflow_message instead of claw_chat_message_raw. */
  workflowId?: number
  /**
   * Cancel the running workflow execution.
   * Set by _runGraph() immediately after workflowExecute() is called.
   * Nodes can call this to stop the workflow early (e.g. on ASKS pause).
   */
  cancelWorkflow?: () => void
  /**
   * Progress callback threaded from _runGraph() so individual nodes
   * (e.g. AgentModel) can emit fine-grained events (model_call_end, etc.).
   */
  progressCallback?: (event: Record<string, unknown>) => void
}
