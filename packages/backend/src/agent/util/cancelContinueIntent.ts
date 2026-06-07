/**
 * cancelContinueIntent — 通用「用户取消/继续意图」检测工具
 *
 * 策略：
 *  1. 规则快速匹配：高置信度关键词直接返回，无需调用 LLM（延迟低、成本零）
 *  2. LLM 兜底（可选）：规则未命中时调用语言模型做语义判断（处理自然语言表达）
 *  3. 超时/失败回退：LLM 异常时默认安全值（取消→不取消，继续→不继续）
 */

import { z } from 'zod'
import { getModelConfigList } from '../../config/index.js'
import { modelCall } from '../../model/model/index.js'
import { COMMON_INTENT_PATTERNS } from '../routing.js'

/** Options for intent detection */
export interface IntentDetectOptions {
  /** Whether to use model-based detection as fallback when keywords don't match. Default: true */
  useModel?: boolean
  /** Custom logger (e.g. agent file logger). Falls back to the module-level logger if not provided. */
  logger?: any
}

/** Cancel detection result */
export interface CancelIntentResult {
  /** Whether the user intends to cancel/abort */
  shouldCancel: boolean
  /** Confidence score (0–1) */
  confidence: number
  /** Short reason */
  reason: string
  /** Detection method used */
  method: 'rule' | 'llm' | 'fallback'
}

/** Continue detection result */
export interface ContinueIntentResult {
  /** Whether the user intends to continue the pending task */
  shouldContinue: boolean
  /** Confidence score (0–1) */
  confidence: number
  /** Short reason */
  reason: string
  /** Detection method used */
  method: 'rule' | 'llm' | 'fallback'
}

/** Continue keyword pattern (exact match) */
const CONTINUE_PATTERN = /^(继续|继续运行|continue)$/i

const CancelIntentSchema = z.object({
  shouldCancel: z
    .boolean()
    .describe('用户是否想要停止/取消当前正在执行的任务')
    .default(false),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('判断的置信度 (0-1)')
    .default(0.8),
  reason: z
    .string()
    .describe('判断依据，简短说明')
    .default('根据用户语义分析判断'),
})

const ContinueIntentSchema = z.object({
  shouldContinue: z
    .boolean()
    .describe('用户是否想要继续当前暂停的任务')
    .default(false),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('判断的置信度 (0-1)')
    .default(0.8),
  reason: z
    .string()
    .describe('判断依据，简短说明')
    .default('根据用户语义分析判断'),
})

/**
 * Detect whether the user's message expresses an intent to cancel/abort the running task.
 *
 * @param text       - The user's input text
 * @param userId     - User ID (for model billing / logging)
 * @param tenantId   - Tenant ID (for model billing / logging)
 * @param options    - Detection options
 * @returns          CancelIntentResult
 */
export async function detectCancelIntent(
  text: string,
  userId: number,
  tenantId: number,
  options?: IntentDetectOptions
): Promise<CancelIntentResult> {
  const { useModel = true, logger } = options ?? {}
  const trimmed = text.trim()

  // ── 1. Rule-based fast path ──────────────────────────────────────────────
  if (COMMON_INTENT_PATTERNS.cancel.test(trimmed.toLowerCase())) {
    return {
      shouldCancel: true,
      confidence: 1.0,
      reason: '命中取消关键词',
      method: 'rule',
    }
  }

  if (!useModel) {
    return {
      shouldCancel: false,
      confidence: 0,
      reason: '未命中规则，模型识别已禁用',
      method: 'fallback',
    }
  }

  // ── 2. LLM semantic judgment ─────────────────────────────────────────────
  try {
    const modelConfigList = await getModelConfigList(userId, tenantId, 'router')
    const result = await modelCall({
      tenantId,
      userId,
      biz: 'Intent',
      bizId: String(userId),
      modelConfigList,
      temperature: 0.1,
      context: 'detect_cancel_intent',
      logger,
      systemPrompt: `You are an intent detection assistant.
An AI task (e.g. writing, code generation, data analysis) is currently running in the background.
The user has sent a new message. Determine whether it expresses intent to stop/abort/cancel the running task.

## Examples of cancel intent
- Direct commands: stop, cancel, abort, quit, never mind, stop it, halt, end it
- With reason: let's stop here, no need to continue, go a different direction, drop this
- Chinese equivalents: 停止、取消、不要了、算了、中止、结束、先停、别继续了

## Rules
- If the user is asking a question, giving feedback, or providing a new instruction, that is NOT a cancel
- If the user clearly wants to stop/cancel, set shouldCancel = true
- For ambiguous expressions (e.g. "wait", "hold on") assign low confidence

Return JSON only, no other text.`,
      userPrompt: `User message: "${trimmed}"`,
      schema: CancelIntentSchema,
    })

    if (result.type === 'json') {
      const data = result.data as z.infer<typeof CancelIntentSchema>
      return {
        shouldCancel: data.shouldCancel,
        confidence: data.confidence,
        reason: data.reason,
        method: 'llm',
      }
    }
  } catch {
    // fall through to fallback
  }

  // ── 3. Fallback: do not cancel ───────────────────────────────────────────
  return {
    shouldCancel: false,
    confidence: 0,
    reason: '意图识别失败，默认不取消',
    method: 'fallback',
  }
}

/**
 * Detect whether the user's message expresses an intent to continue the pending task.
 *
 * @param text       - The user's input text
 * @param userId     - User ID (for model billing / logging)
 * @param tenantId   - Tenant ID (for model billing / logging)
 * @param options    - Detection options
 * @returns          ContinueIntentResult
 */
export async function detectContinueIntent(
  text: string,
  userId: number,
  tenantId: number,
  options?: IntentDetectOptions
): Promise<ContinueIntentResult> {
  const { useModel = true, logger } = options ?? {}
  const trimmed = text.trim()

  // ── 1. Rule-based fast path ──────────────────────────────────────────────
  if (CONTINUE_PATTERN.test(trimmed)) {
    return {
      shouldContinue: true,
      confidence: 1.0,
      reason: '命中继续关键词',
      method: 'rule',
    }
  }

  if (!useModel) {
    return {
      shouldContinue: false,
      confidence: 0,
      reason: '未命中规则，模型识别已禁用',
      method: 'fallback',
    }
  }

  // ── 2. LLM semantic judgment ─────────────────────────────────────────────
  try {
    const modelConfigList = await getModelConfigList(userId, tenantId, 'router')
    const result = await modelCall({
      tenantId,
      userId,
      biz: 'Intent',
      bizId: String(userId),
      modelConfigList,
      temperature: 0.1,
      context: 'detect_continue_intent',
      logger,
      systemPrompt: `You are an intent detection assistant.
An AI task has paused and is waiting for the user to decide whether to continue.
The user has sent a new message. Determine whether it expresses intent to continue/resume the paused task.

## Examples of continue intent
- Direct commands: continue, go on, proceed, keep going, resume
- Chinese equivalents: 继续、继续运行、继续执行、继续吧、接着做、继续下去

## Rules
- If the user is asking a new question or giving a different instruction, that is NOT a continue
- If the user clearly wants to continue the paused task, set shouldContinue = true
- For ambiguous expressions assign low confidence

Return JSON only, no other text.`,
      userPrompt: `User message: "${trimmed}"`,
      schema: ContinueIntentSchema,
    })

    if (result.type === 'json') {
      const data = result.data as z.infer<typeof ContinueIntentSchema>
      return {
        shouldContinue: data.shouldContinue,
        confidence: data.confidence,
        reason: data.reason,
        method: 'llm',
      }
    }
  } catch {
    // fall through to fallback
  }

  // ── 3. Fallback: do not continue ─────────────────────────────────────────
  return {
    shouldContinue: false,
    confidence: 0,
    reason: '意图识别失败，默认不继续',
    method: 'fallback',
  }
}
