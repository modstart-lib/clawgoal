/**
 * General routing configuration and decision engine
 * Supports flexible workflow routing control
 */

import { z } from 'zod'
import { logger } from '../utils/logger'
import type {
  ConversationEntry,
  IntentHistoryItem,
  NodeCapabilities,
  RoutingDecision,
  RoutingIntent,
  RoutingIntentAction,
  RoutingTable,
} from './types'
import { RoutingIntentAction as IntentActionEnum } from './types'
import { modelCall } from '../model/model'
import { getModelConfigList } from '../config'

/**
 * Routing configuration interface
 * Used for configuring routing behavior
 * @template T Node type
 */
export interface RoutingConfig<T extends string> {
  /** Node capabilities configuration */
  nodeCapabilities: Record<T, NodeCapabilities<T>>
  /** Routing table */
  routingTable: RoutingTable<T>
  /** Function to get the default successor node */
  getDefaultNextNode: (currentNode: T, state: any) => T
  /** Function to get the default fallback node */
  getDefaultBackNode?: (currentNode: T) => T
  /** Custom jump validation logic (optional) */
  validateJumpCustom?: (
    from: T,
    to: T,
    state: any
  ) => { valid: boolean; reason?: string }
}

/**
 * Create a router instance
 * @template T Node type
 */
export function createRouter<T extends string>(config: RoutingConfig<T>) {
  const {
    nodeCapabilities,
    routingTable,
    getDefaultNextNode,
    getDefaultBackNode,
    validateJumpCustom,
  } = config

  /**
   * Resolve user intent and determine the next node
   *
   * @param state Current state
   * @param intent User intent
   * @returns Routing decision
   */
  function resolveNextNode(
    state: any,
    intent: RoutingIntent<T>
  ): RoutingDecision<T> {
    const currentNode = (state.currentNode || state.stage) as T
    const action = intent.action

    if (action === IntentActionEnum.Jump && intent.target) {
      const isAllowed = validateJump(currentNode, intent.target, state)
      if (!isAllowed.valid) {
        throw new Error(
          `Jump from ${currentNode} to ${intent.target} is not allowed: ${isAllowed.reason}`
        )
      }
      return {
        nextNode: intent.target,
        reason: intent.reason || `User requested jump to ${intent.target}`,
        requiresUserInput: false,
        allowedNodes: nodeCapabilities[intent.target].allowedTargets,
      }
    }

    if (action === IntentActionEnum.Back) {
      const targetNode: T = (intent.target ||
        state.previousNode ||
        (getDefaultBackNode
          ? getDefaultBackNode(currentNode)
          : currentNode)) as T
      return {
        nextNode: targetNode,
        reason: `User requested back to ${targetNode}`,
        requiresUserInput: false,
        allowedNodes: nodeCapabilities[targetNode].allowedTargets,
      }
    }

    const routingEntry = routingTable[currentNode]?.[action]
    if (routingEntry) {
      return {
        nextNode: routingEntry,
        reason: `Routed to ${routingEntry} based on intent ${action}`,
        requiresUserInput: routingEntry === currentNode, // stay on current node requires user input
        allowedNodes: nodeCapabilities[routingEntry].allowedTargets,
      }
    }

    const defaultNext = getDefaultNextNode(currentNode, state)
    return {
      nextNode: defaultNext,
      reason: `Default flow: from ${currentNode} to ${defaultNext}`,
      requiresUserInput: defaultNext === currentNode,
      allowedNodes: nodeCapabilities[defaultNext].allowedTargets,
    }
  }

  /**
   * Validate whether a jump is allowed
   *
   * @param from Source node
   * @param to Target node
   * @param state Current state
   * @returns Validation result
   */
  function validateJump(
    from: T,
    to: T,
    state: any
  ): { valid: boolean; reason?: string } {
    const capabilities = nodeCapabilities[from]
    if (!capabilities.canJump) {
      return { valid: false, reason: `Node ${from} does not support jump` }
    }

    if (!capabilities.allowedTargets.includes(to)) {
      return {
        valid: false,
        reason: `Node ${from} does not allow jump to ${to}`,
      }
    }

    if (validateJumpCustom) {
      return validateJumpCustom(from, to, state)
    }

    return { valid: true }
  }

  /**
   * Get all allowed actions for the current node
   * Used for frontend to display available buttons
   */
  function getAllowedActions(
    currentNode: T,
    _state: any
  ): RoutingIntentAction[] {
    const capabilities = nodeCapabilities[currentNode]
    const actions: RoutingIntentAction[] = [
      IntentActionEnum.Confirm,
      IntentActionEnum.Modify,
    ]
    if (capabilities.canSkip) {
      actions.push(IntentActionEnum.Skip)
    }
    if (capabilities.canBack) {
      actions.push(IntentActionEnum.Back)
    }
    if (capabilities.canJump) {
      actions.push(IntentActionEnum.Jump)
    }
    actions.push(IntentActionEnum.Cancel)
    return actions
  }

  return {
    resolveNextNode,
    getAllowedActions,
    getDefaultNextNode,
    nodeCapabilities,
  }
}

/**
 * Quick match result
 */
export interface QuickMatchResult<T = string> {
  action: RoutingIntentAction
  target?: T
  reason: string
  confidence: number
}

/**
 * Common intent matching regex patterns
 */
export const COMMON_INTENT_PATTERNS = {
  /** Confirm-type keywords (exact match) */
  confirm: /^(确认|好的|可以|继续|没问题|行|ok|yes|对|是的)$/i,
  /** Cancel-type keywords (exact match) */
  cancel: /^(取消|算了|不要了|退出|停止|cancel|quit|exit)$/i,
  /** Skip-type keywords (prefix match) */
  skip: /^(跳过|略过|不需要|直接|pass|skip)/,
  /** Back/return-type keywords (prefix match) */
  back: /^(返回|回到|回退|上一步|back|previous)/,
  /** Re-generate-type keywords (substring match) */
  rerun: /(重新生成|再生成一次|重写|重来|rerun|rewrite)/,
  /** Modify-type keywords (substring match) */
  modify: /(修改|改成|改为|换成|调整|change|modify|update)/,
  /** Jump-type keywords (capture group) */
  jump: /(?:跳转?到|直接(?:到|去)?|进入)\s*([^\s]+)/,
  /** Confirm word at sentence start */
  confirmStart: /^(好|行|对|确认|可以|没问题)/,
}

/**
 * Common quick match rule configuration
 * @template T Node type
 */
export interface CommonQuickMatchConfig<T extends string> {
  /** Mapping from node name to node identifier (for jump recognition) */
  nodeNameMap?: Record<string, T>
  /** Custom rules (executed before the common rules) */
  customRules?: (input: string, currentNode: T) => QuickMatchResult<T> | null
  /** Node-specific rule extensions */
  nodeSpecificRules?: Partial<
    Record<T, (input: string) => QuickMatchResult<T> | null>
  >
}

/**
 * Create a common quick match rule function
 * Provides commonly used intent recognition regex patterns to reduce code duplication
 *
 * @template T Node type
 * @param config Configuration options
 * @returns Quick match rule function
 *
 * @example
 * ```typescript
 * const quickMatch = createCommonQuickMatchRules({
 *   nodeNameMap: {
 *     '分析': 'analysis',
 *     '生成': 'generate'
 *   }
 * });
 * ```
 */
export function createCommonQuickMatchRules<T extends string>(
  config: CommonQuickMatchConfig<T> = {}
): (input: string, currentNode: T) => QuickMatchResult<T> | null {
  const { nodeNameMap = {}, customRules, nodeSpecificRules } = config

  return (input: string, currentNode: T): QuickMatchResult<T> | null => {
    const text = input.toLowerCase().trim()
    if (customRules) {
      const customResult = customRules(input, currentNode)
      if (customResult) {
        return customResult
      }
    }
    if (nodeSpecificRules && nodeSpecificRules[currentNode]) {
      const specificResult = nodeSpecificRules[currentNode]!(input)
      if (specificResult) {
        return specificResult
      }
    }
    if (COMMON_INTENT_PATTERNS.confirm.test(text)) {
      return {
        action: IntentActionEnum.Confirm,
        reason: '用户明确表示确认',
        confidence: 1.0,
      }
    }

    if (COMMON_INTENT_PATTERNS.cancel.test(text)) {
      return {
        action: IntentActionEnum.Cancel,
        reason: '用户明确表示取消',
        confidence: 1.0,
      }
    }

    if (COMMON_INTENT_PATTERNS.skip.test(text)) {
      return {
        action: IntentActionEnum.Skip,
        reason: '用户明确表示跳过',
        confidence: 0.95,
      }
    }

    if (COMMON_INTENT_PATTERNS.back.test(text)) {
      return {
        action: IntentActionEnum.Back,
        reason: '用户明确表示回退',
        confidence: 0.95,
      }
    }

    if (COMMON_INTENT_PATTERNS.rerun.test(text)) {
      return {
        action: IntentActionEnum.Rerun,
        reason: '用户请求重新生成',
        confidence: 0.95,
      }
    }

    if (Object.keys(nodeNameMap).length > 0) {
      const jumpMatch = text.match(COMMON_INTENT_PATTERNS.jump)
      if (jumpMatch) {
        for (const [nodeName, nodeId] of Object.entries(nodeNameMap)) {
          if (text.includes(nodeName.toLowerCase())) {
            return {
              action: IntentActionEnum.Jump,
              target: nodeId,
              reason: `用户明确表示跳转到${nodeName}`,
              confidence: 0.9,
            }
          }
        }
      }
    }

    return null
  }
}

/**
 * Intent recognition context
 * @template T Node type
 */
export interface IntentRecognitionContext<T extends string> {
  /** Current node */
  currentNode: T
  /** Current node state data */
  currentState: any
  /** Intent history records */
  intentHistories?: IntentHistoryItem<T>[]
  /** Conversation history */
  conversationHistory?: ConversationEntry<T>[]
  /** Logger (optional) */
  logger?: any
}

/**
 * Intent recognition configuration interface
 * @template T Node type
 */
export interface IntentRecognitionConfig<T extends string> {
  /** Node name mapping (for prompt building) */
  nodeNameMap: Record<T, string>
  /** Node capabilities configuration (for prompt building) */
  nodeCapabilities: Record<T, NodeCapabilities<T>>
  /** Function to get allowed actions */
  getAllowedActions: (currentNode: T, state: any) => RoutingIntentAction[]
  /** Quick match rules (optional) */
  quickMatchRules?: (
    input: string,
    currentNode: T
  ) => QuickMatchResult<T> | null
  /** Build context info (optional) */
  buildContextInfo?: (
    currentNode: T,
    currentState: any,
    intentHistories?: IntentHistoryItem<T>[],
    conversationHistory?: ConversationEntry<T>[]
  ) => string
  /** Get current node state description (optional) */
  getNodeStateDescription?: (currentNode: T, currentState: any) => string
}

/**
 * Intent recognition result Zod Schema
 */
const IntentRecognitionSchema = z.object({
  action: z
    .enum([
      IntentActionEnum.Confirm,
      IntentActionEnum.Modify,
      IntentActionEnum.Jump,
      IntentActionEnum.Back,
      IntentActionEnum.Skip,
      IntentActionEnum.Cancel,
      IntentActionEnum.Rerun,
    ])
    .describe('用户意图的动作类型')
    .default(IntentActionEnum.Confirm),

  target: z
    .string()
    .optional()
    .describe('跳转的目标节点（action为jump时必填）'),

  reason: z
    .string()
    .describe('识别出该意图的原因，简要说明')
    .default('用户明确表示同意当前结果'),

  params: z.record(z.any()).optional().describe('跳转时携带的额外参数'),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('识别置信度（0-1）')
    .default(0.8),
})

type IntentRecognitionResult = z.infer<typeof IntentRecognitionSchema>

/**
 * Create an intent recognizer
 * @template T Node type
 */
export function createIntentRecognizer<T extends string>(
  config: IntentRecognitionConfig<T>
) {
  const {
    nodeNameMap,
    nodeCapabilities,
    getAllowedActions,
    quickMatchRules,
    buildContextInfo,
    getNodeStateDescription,
  } = config

  /**
   * Recognize user intent
   *
   * @param userId User ID (for logging and personalized recognition)
   * @param tenantId Tenant ID (for model logging)
   * @param userInput User's text input
   * @param context Current context
   * @returns Recognized user intent
   */
  async function recognizeIntent(
    userId: number,
    tenantId: number,
    userInput: string,
    context: IntentRecognitionContext<T>
  ): Promise<RoutingIntent<T>> {
    const {
      currentNode,
      currentState,
      intentHistories,
      conversationHistory,
      logger: contextLogger,
    } = context
    const log = contextLogger || logger

    if (!userInput || userInput.trim().length === 0) {
      return {
        action: IntentActionEnum.Confirm,
        reason: '用户未提供输入，默认为确认',
      }
    }

    if (quickMatchRules) {
      const quickMatch = quickMatchRules(userInput, currentNode)
      if (quickMatch && quickMatch.confidence > 0.9) {
        log.debug(
          { userInput, intent: quickMatch.action },
          '[routing] Intent matched by quick rules'
        )
        return {
          action: quickMatch.action,
          target: quickMatch.target,
          reason: quickMatch.reason,
        }
      }
    }

    const systemPrompt = buildIntentRecognitionPrompt(currentNode, currentState)

    const contextInfo = buildContextInfo
      ? buildContextInfo(
          currentNode,
          currentState,
          intentHistories,
          conversationHistory
        )
      : buildDefaultContextInfo(
          currentNode,
          currentState,
          intentHistories,
          conversationHistory
        )

    try {
      const result = await modelCall<typeof IntentRecognitionSchema>(userId, {
        systemPrompt,
        userPrompt: `${contextInfo}\n\n用户输入：${userInput}`,
        schema: IntentRecognitionSchema,
        temperature: 0.3, // 低温度，确保识别稳定
        context: `intent_recognition_${currentNode}`,
        modelConfigList: await getModelConfigList(userId, tenantId, 'router'),
        biz: 'Chat',
        bizId: String(userId),
        tenantId,
        userId,
      })

      if (result.type !== 'json') {
        throw new Error('意图识别返回类型错误')
      }

      const recognized = result.data as IntentRecognitionResult

      validateRecognizedIntent(recognized, currentNode, log)

      log.info(
        {
          userInput,
          currentNode,
          recognized,
        },
        '[routing] Intent recognized by Model'
      )

      return {
        action: recognized.action as RoutingIntentAction,
        target: recognized.target as T | undefined,
        reason: recognized.reason,
        params: recognized.params,
      }
    } catch (error) {
      log.error(
        {
          error,
          userInput,
          currentNode,
        },
        '[routing] Intent recognition failed'
      )

      return {
        action: IntentActionEnum.Modify,
        reason: '意图识别失败，默认为修改当前内容',
      }
    }
  }

  /**
   * Build the intent recognition system prompt
   */
  function buildIntentRecognitionPrompt(
    currentNode: T,
    currentState: any
  ): string {
    const capabilities = nodeCapabilities[currentNode]
    const allowedActions = getAllowedActions(currentNode, currentState)

    return `你是一个用户意图识别专家，负责分析用户在工作流中的输入意图。

## 当前状态
- 当前阶段：${nodeNameMap[currentNode]}（${currentNode}）
- 当前阶段允许的操作：${allowedActions.join(', ')}
${capabilities.canJump ? `- 可跳转的目标节点：${capabilities.allowedTargets.join(', ')}` : ''}

## 意图类型说明
1. **confirm**（确认）：用户对当前结果满意，继续下一步
   - 例如："确认"，"好的"，"没问题"，"继续"

2. **modify**（修改）：用户想修改当前阶段的内容，重新执行当前节点
   - 例如："修改一下标题"，"我想改一下"，"重新来"

3. **jump**（跳转）：用户想跳转到特定节点
   - 例如："跳到生成"，"直接生成文章"，"我想看看大纲"
   - 必须明确指定 target 字段

4. **back**（回退）：用户想返回上一个节点
   - 例如："返回上一步"，"回到分析"，"我要改大纲"

5. **skip**（跳过）：用户想跳过当前节点，使用默认值继续
   - 例如："跳过"，"不需要"，"用默认的"

6. **cancel**（取消）：用户想取消整个任务
   - 例如："取消"，"算了"，"不要了"

7. **rerun**（重新生成）：用户想重新生成当前内容（主要用于生成和审核阶段）
   - 例如："重新生成"，"再来一次"，"不满意，重写"

## 识别要求
1. 仔细分析用户输入的语义和上下文
2. 如果用户明确表达了某个操作，直接识别
3. 如果用户表达模糊，选择最合理的意图
4. 如果用户想修改具体内容（如"标题改成XXX"），识别为 modify，并在reason中说明
5. **confidence** 字段反映识别的确定程度（0.0-1.0）
   - 明确表达：≥0.9
   - 较清晰：0.7-0.9
   - 模糊/推测：<0.7

## 跳转目标说明
${Object.entries(nodeNameMap)
  .map(([key, name]) => `- ${key}：${name}`)
  .join('\n')}

## 输出要求
返回 JSON 格式，包含 action、target（可选）、reason、params（可选）、confidence 字段。`
  }

  /**
   * Build default context information
   */
  function buildDefaultContextInfo(
    currentNode: T,
    currentState: any,
    intentHistories?: IntentHistoryItem<T>[],
    conversationHistory?: ConversationEntry<T>[]
  ): string {
    let info = `## 当前上下文\n`

    if (getNodeStateDescription) {
      info += `### 当前阶段状态\n`
      info += getNodeStateDescription(currentNode, currentState)
      info += '\n'
    }

    if (intentHistories && intentHistories.length > 0) {
      info += `\n### 最近的用户操作\n`
      intentHistories.slice(-3).forEach((entry, index) => {
        info += `${index + 1}. ${entry.intent.action} - ${entry.intent.reason}\n`
      })
    }

    if (conversationHistory && conversationHistory.length > 0) {
      info += `\n### 最近的对话\n`
      conversationHistory.slice(-6).forEach((msg) => {
        info += `- ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`
      })
    }

    return info
  }

  /**
   * Validate whether the recognized intent is valid
   */
  function validateRecognizedIntent(
    intent: IntentRecognitionResult,
    currentNode: T,
    log: any = logger
  ): void {
    const capabilities = nodeCapabilities[currentNode]

    const allowedActions = getAllowedActions(currentNode, {})
    if (!allowedActions.includes(intent.action as RoutingIntentAction)) {
      log.warn(
        {
          intent: intent.action,
          currentNode,
          allowedActions,
        },
        '[routing] Recognized intent action not allowed, but will proceed'
      )
    }

    if (intent.action === IntentActionEnum.Jump) {
      if (!intent.target) {
        throw new Error('Jump intent must specify target field')
      }

      if (!capabilities.allowedTargets.includes(intent.target as T)) {
        throw new Error(`不允许从 ${currentNode} 跳转到 ${intent.target}`)
      }
    }

    if (intent.confidence < 0.5) {
      log.warn(
        {
          intent,
          confidence: intent.confidence,
        },
        '[routing] Low confidence intent recognition'
      )
    }
  }

  return {
    recognizeIntent,
  }
}
