/**
 * Intent Detector — determines the next routing action for incoming messages
 * based on the current session's workflow state and the user's message.
 *
 * Returns an IntentAction that the gateway uses to decide how to handle the message.
 */

import { HumanMessage } from '@langchain/core/messages'
import { modelCall } from '../../../backend/src/model/model/index.js'
import { buildSystemInfoPrompt } from '../../../backend/src/utils/env'
import { getUserLang } from '../../../backend/src/locale/index.js'
import type { Agent, ClawMessage } from '../types/index.js'
import type { AgentContext } from '../../../backend/src/model/types.js'
import { resolveAgentModelListByRef } from '../../../backend/src/model/model/index.js'
import { createLogger } from './logger.js'
import type { SessionWorkflowData } from './sessionWorkflow.js'
import { findPausedWorkflowSession } from './sessionWorkflow.js'

const logger = createLogger('intent-detector')

// ─── Types ────────────────────────────────────────────────────────────────────

export type IntentAction =
  | 'chat'
  | { type: 'start_workflow'; pipelineKey: string }
  | { type: 'continue_workflow' }
  | { type: 'terminate_workflow' }
  | { type: 'restore_previous_workflow' }

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Detect the user's intent and return the next routing action.
 *
 * @param agent         The current agent
 * @param agentContext  Current agent execution context
 * @param userMessage   The raw user message text
 * @param wfState       Current session workflow state
 */
export async function detectIntent(
  agent: Agent,
  agentContext: AgentContext,
  userMessage: string,
  wfState: SessionWorkflowData
): Promise<IntentAction> {
  // If current session is idle, check if another session of this agent is paused.
  // This handles the case where the user answers an asks question while viewing a
  // different session than the one where the workflow was paused.
  if (wfState.mode === 'idle' && agentContext.sessionId) {
    const crossSession = findPausedWorkflowSession(
      agentContext.agentId,
      agentContext.tenantId,
      agentContext.userId
    )
    if (crossSession) {
      logger.info(
        {
          currentSession: agentContext.sessionId,
          pausedSession: crossSession.sessionId,
        },
        '[intent-detector] idle session but found paused workflow in another session — continue_workflow'
      )
      return { type: 'continue_workflow' }
    }
  }

  const pipelineEntries = Object.entries(agent.config.agents ?? {})

  // ── Case 1: workflow is paused — check if user wants to terminate or restore ──
  if (wfState.mode === 'paused') {
    // Check for explicit "restore previous workflow" intent
    if (wfState.stack && wfState.stack.length > 0) {
      if (_isRestorePreviousIntent(userMessage)) {
        return { type: 'restore_previous_workflow' }
      }
    }

    // Check for terminate intent using LLM (fast, low-token check)
    const shouldTerminate = await _detectTerminateIntent(
      agent,
      agentContext,
      userMessage
    )
    if (shouldTerminate) {
      return { type: 'terminate_workflow' }
    }

    // Default: continue the paused workflow
    return { type: 'continue_workflow' }
  }

  // ── Case 2: workflow is active — same logic as paused ──
  if (wfState.mode === 'active') {
    if (
      wfState.stack &&
      wfState.stack.length > 0 &&
      _isRestorePreviousIntent(userMessage)
    ) {
      return { type: 'restore_previous_workflow' }
    }
    const shouldTerminate = await _detectTerminateIntent(
      agent,
      agentContext,
      userMessage
    )
    if (shouldTerminate) {
      return { type: 'terminate_workflow' }
    }
    return { type: 'continue_workflow' }
  }

  // ── Case 3: idle — check if user wants to start a workflow ──
  if (pipelineEntries.length === 0) {
    return 'chat'
  }

  // Use intent_router slot if available, otherwise pick the only pipeline
  const routerSlotName = agent.config.intentRouterSlot ?? 'intent_router'
  const hasRouterSlot = !!agent.config.models?.[routerSlotName]

  if (!hasRouterSlot) {
    // Only one pipeline — use it if this seems like a task request, else chat
    if (pipelineEntries.length === 1) {
      const pipelineKey = pipelineEntries[0]![0]
      const isTaskRequest = await _detectPipelineIntent(
        agent,
        agentContext,
        userMessage,
        pipelineEntries
      )
      return isTaskRequest === pipelineKey
        ? { type: 'start_workflow', pipelineKey }
        : 'chat'
    }
    return 'chat'
  }

  const key = await _detectPipelineIntent(
    agent,
    agentContext,
    userMessage,
    pipelineEntries
  )
  if (key === 'chat') return 'chat'
  return { type: 'start_workflow', pipelineKey: key }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Simple keyword-based detection for "restore previous workflow" intent.
 * Avoids an LLM call for clear phrasing.
 */
function _isRestorePreviousIntent(text: string): boolean {
  const lower = text.toLowerCase()
  const patterns = [
    '回到上一个任务',
    '回到上个任务',
    '恢复上一个',
    '恢复上一个任务',
    '继续上一个任务',
    '之前的任务',
  ]
  return patterns.some((p) => lower.includes(p))
}

/**
 * LLM-based terminate intent detection (16 tokens, temperature 0).
 * Returns true if the user clearly wants to stop/cancel the current workflow.
 */
async function _detectTerminateIntent(
  agent: Agent,
  agentContext: AgentContext,
  userMessage: string
): Promise<boolean> {
  const terminateSlotName = 'terminate_detector'
  const slotConfig = agent.config.models?.[terminateSlotName]

  // If no terminate_detector slot, fall back to keyword matching only
  if (!slotConfig) {
    return _isTerminateKeyword(userMessage)
  }

  try {
    const { modelRef, modelConfigs } = await resolveAgentModelListByRef(
      agent,
      terminateSlotName
    )
    const language = await getUserLang(
      Number(agent.tenantId),
      Number(agent.userId)
    )
    const slotRef = typeof slotConfig === 'object' ? slotConfig : null
    const basePrompt = (slotRef as any)?.systemPrompt ?? ''
    const systemPrompt =
      `${basePrompt}\n\n` +
      `Valid output values: yes, no\n\n` +
      buildSystemInfoPrompt(new Date(), language)

    const result = await modelCall({
      tenantId: agent.tenantId,
      userId: agent.userId,
      biz: 'Session',
      bizId: String(agentContext.sessionId),
      modelConfigList: modelConfigs,
      systemPrompt,
      appendMessages: [new HumanMessage(userMessage)],
      tools: undefined,
      temperature: modelRef.temperature ?? 0.0,
      maxRetry: modelConfigs.length,
    })

    const key = (result.type === 'text' ? result.content : '')
      .trim()
      .toLowerCase()
    return key === 'yes'
  } catch (err) {
    logger.warn(
      { err },
      'terminate intent detection failed, using keyword fallback'
    )
    return _isTerminateKeyword(userMessage)
  }
}

/** Keyword-based fallback for terminate intent */
function _isTerminateKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  const patterns = [
    '取消',
    '停止',
    '退出',
    '放弃',
    '算了',
    '不要了',
    '换个任务',
    '不做了',
    'cancel',
    'stop',
    'quit',
    'abort',
  ]
  return patterns.some((p) => lower.includes(p))
}

/**
 * LLM-based pipeline selection (same as AgentAgentRunner._runIntentRouter).
 * Returns a pipeline key or 'chat'.
 */
async function _detectPipelineIntent(
  agent: Agent,
  agentContext: AgentContext,
  userMessage: string,
  pipelineEntries: [string, { description?: string }][]
): Promise<string> {
  const pipelineKeys = pipelineEntries.map(([k]) => k)
  const pipelineList = pipelineEntries
    .map(([k, p]) => (p.description ? `- ${k}: ${p.description}` : `- ${k}`))
    .join('\n')

  const routerSlotName = agent.config.intentRouterSlot ?? 'intent_router'
  const { modelRef, modelConfigs } = await resolveAgentModelListByRef(
    agent,
    routerSlotName
  )
  const language = await getUserLang(
    Number(agent.tenantId),
    Number(agent.userId)
  )

  const slotConfig = agent.config.models[routerSlotName]
  const basePrompt =
    slotConfig && typeof slotConfig === 'object'
      ? ((slotConfig as any).systemPrompt ?? '')
      : ''
  const systemPrompt =
    `${basePrompt}\n\n` +
    `Classify the user's message into one of the following pipelines, or output "chat" for general conversation.\n` +
    `Available pipelines:\n${pipelineList}\n` +
    `Valid output values: ${[...pipelineKeys, 'chat'].join(', ')}\n\n` +
    buildSystemInfoPrompt(new Date(), language)

  try {
    const result = await modelCall({
      tenantId: agent.tenantId,
      userId: agent.userId,
      biz: 'Session',
      bizId: String(agentContext.sessionId),
      modelConfigList: modelConfigs,
      systemPrompt,
      appendMessages: [new HumanMessage(userMessage)],
      tools: undefined,
      temperature: modelRef.temperature ?? 0.0,
      maxRetry: modelConfigs.length,
    })

    const key = (result.type === 'text' ? result.content : '')
      .trim()
      .toLowerCase()
    return pipelineKeys.includes(key) ? key : 'chat'
  } catch (err) {
    logger.warn({ err }, 'pipeline intent detection failed')
    return 'chat'
  }
}
