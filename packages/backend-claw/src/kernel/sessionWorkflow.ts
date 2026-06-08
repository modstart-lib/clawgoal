/**
 * Session Workflow State — persists and restores workflow mode/context in session.data.
 *
 * All state is stored under the `_workflow` key in `claw_chat_session.data` (a JSON object).
 * No new DB tables are required.
 *
 * State machine:
 *   idle    — no workflow running; default for pure chat sessions
 *   active  — a workflow is currently executing
 *   paused  — workflow hit an `asks` node; waiting for user reply
 *
 * Stack: on "start workflow", the previous state (if paused) is pushed onto stack so the
 *        user can say "回到上一个任务" to restore it.
 */

import type { BaseMessage } from '@langchain/core/messages'
import { clawDb } from '../storage/store/index.js'
import {
  serializeMessages,
  deserializeMessages,
  type SerializedMessage,
} from './model.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowMode = 'idle' | 'active' | 'paused'

export interface WorkflowPausedContext {
  /** Pipeline key that was running when paused */
  pipelineKey: string
  /** Serialized message history at the point of pause */
  messages: SerializedMessage[]
  /** state.context values at the point of pause */
  context: Record<string, unknown>
  /** ISO timestamp of when the pause occurred */
  pausedAt: string
  /** Node IDs that were successfully executed before the pause */
  executedNodes?: string[]
  /** True when this context was created by an internal auto-chain (e.g. restorer → coder),
   *  so the client should NOT display a duplicate turn_start for the same user message. */
  autoChained?: boolean
}

export interface SessionWorkflowData {
  mode: WorkflowMode
  /** Current (or most recently active) pipeline key */
  pipelineKey: string
  /** Paused context when mode === 'paused' */
  pausedContext?: WorkflowPausedContext
  /** Stack of previously paused workflows for "restore previous" */
  stack: WorkflowPausedContext[]
}

// ─── Default state ────────────────────────────────────────────────────────────

function defaultWorkflowData(): SessionWorkflowData {
  return { mode: 'idle', pipelineKey: '', stack: [] }
}

// ─── R/W helpers ──────────────────────────────────────────────────────────────

function readRaw(sessionId: number): SessionWorkflowData {
  if (!sessionId) return defaultWorkflowData()
  const data = clawDb.getSessionData(sessionId)
  const raw = data['_workflow']
  if (!raw || typeof raw !== 'object') return defaultWorkflowData()
  return raw as SessionWorkflowData
}

function writeRaw(sessionId: number, wf: SessionWorkflowData): void {
  if (!sessionId) return
  const data = clawDb.getSessionData(sessionId)
  clawDb.updateSessionData(sessionId, { ...data, _workflow: wf })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getSessionWorkflow(sessionId: number): SessionWorkflowData {
  return readRaw(sessionId)
}

/** Mark workflow as active — called at the start of _runGraph */
export function setWorkflowActive(
  sessionId: number,
  pipelineKey: string
): void {
  const wf = readRaw(sessionId)
  writeRaw(sessionId, {
    ...wf,
    mode: 'active',
    pipelineKey,
  })
}

/** Serialize and save paused state — called when ASKS_SENTINEL detected */
export function setWorkflowPaused(
  sessionId: number,
  pipelineKey: string,
  messages: BaseMessage[],
  context: Record<string, unknown>,
  executedNodes?: string[]
): void {
  const wf = readRaw(sessionId)
  const pausedContext: WorkflowPausedContext = {
    pipelineKey,
    messages: serializeMessages(messages),
    context,
    pausedAt: new Date().toISOString(),
    executedNodes,
  }
  writeRaw(sessionId, {
    ...wf,
    mode: 'paused',
    pipelineKey,
    pausedContext,
  })
}

/** Clear workflow state — called on normal workflow completion or explicit termination */
export function setWorkflowIdle(sessionId: number): void {
  const wf = readRaw(sessionId)
  writeRaw(sessionId, {
    mode: 'idle',
    pipelineKey: '',
    stack: wf.stack ?? [],
  })
}

/** Push current paused context onto stack, start a new pipeline */
export function pushWorkflowStack(
  sessionId: number,
  pipelineKey: string
): void {
  const wf = readRaw(sessionId)
  const newStack = [...(wf.stack ?? [])]
  if (wf.mode === 'paused' && wf.pausedContext) {
    newStack.push(wf.pausedContext)
  }
  writeRaw(sessionId, {
    mode: 'active',
    pipelineKey,
    stack: newStack,
  })
}

/**
 * Pop the top paused context from the stack and restore it as the current paused state.
 * Returns the restored context, or undefined if the stack was empty.
 */
export function popWorkflowStack(
  sessionId: number
): WorkflowPausedContext | undefined {
  const wf = readRaw(sessionId)
  if (!wf.stack || wf.stack.length === 0) return undefined
  const newStack = [...wf.stack]
  const restored = newStack.pop()!
  writeRaw(sessionId, {
    mode: 'paused',
    pipelineKey: restored.pipelineKey,
    pausedContext: restored,
    stack: newStack,
  })
  return restored
}

/** Deserialize messages from a paused context */
export function deserializePausedMessages(
  ctx: WorkflowPausedContext
): BaseMessage[] {
  return deserializeMessages(ctx.messages)
}

/**
 * Search across all recent sessions for the agent to find one that is paused.
 * Used when the current session has no pausedContext but the user is answering
 * an asks question that originated in a different session.
 */
export function findPausedWorkflowSession(
  agentId: number,
  tenantId: number,
  userId: number
): { sessionId: number; pausedContext: WorkflowPausedContext } | null {
  const sessions = clawDb.listChatSessions(tenantId, userId, agentId, 50, 0)
  for (const session of sessions) {
    const data = clawDb.getSessionData(session.id)
    const wf = data['_workflow']
    if (
      wf &&
      typeof wf === 'object' &&
      (wf as SessionWorkflowData).mode === 'paused' &&
      (wf as SessionWorkflowData).pausedContext
    ) {
      return {
        sessionId: session.id,
        pausedContext: (wf as SessionWorkflowData).pausedContext!,
      }
    }
  }
  return null
}
