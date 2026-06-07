/**
 * agent_list / agent_call tools
 *
 * agent_list: 列出所有可用的 agent，让 supervisor 了解团队成员。
 *
 * agent_call: 将任务委派给另一个 agent 执行，并返回结果。
 *   - 每次调用生成唯一的 subChatId，用于隔离子会话与主对话（chatId=0）。
 *   - 子 agent 的工具事件以 targetAgent.id 发射，不会出现在 caller 的进度条中。
 *   - 子会话的消息持久化到 DB（userId, targetAgentId, biz=agent_call, bizId=subChatId），可在 UI 中查看。
 */

import { agentManager } from '../agent/index.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { MAX_ROUNDS_SENTINEL, processMessage } from '../kernel/model.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'
import { clawMessage } from '../types/index.js'

// ─── agent_list ───────────────────────────────────────────────────────────────

async function agentList(
  _args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const agents = agentManager.getAllByUser(context.agentContext.userId)
  if (agents.length === 0) {
    return { success: true, output: '暂无可用 Agent。' }
  }
  const cell = (v: string | null | undefined) =>
    (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
  const header = '| id | title | role | status | description |'
  const sep = '|---|---|---|---|---|'
  const rows = agents.map(
    (a) =>
      `| ${a.id} | ${cell(a.title)} | ${cell(a.roleName)} | ${cell(a.workStatus)} | ${cell(a.description)} |`
  )
  return {
    success: true,
    output: [`共 ${agents.length} 个 Agent：`, '', header, sep, ...rows].join(
      '\n'
    ),
  }
}

// ─── agent_call ───────────────────────────────────────────────────────────────

async function agentCall(
  args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const agentIdOrRole = String(args['agentId'] ?? '').trim()
  const message = String(args['message'] ?? '').trim()

  if (!agentIdOrRole) {
    return { success: false, output: '', error: '缺少参数 agentId' }
  }
  if (!message) {
    return { success: false, output: '', error: '缺少参数 message' }
  }

  // 优先按 ID 查询，找不到再尝试按 roleName 匹配
  const numericId = Number(agentIdOrRole)
  let targetAgent =
    !isNaN(numericId) && String(numericId) === agentIdOrRole
      ? agentManager.get(numericId)
      : undefined
  if (!targetAgent) {
    targetAgent = agentManager
      .listAll()
      .find((a) => a.roleName === agentIdOrRole)
  }
  if (!targetAgent) {
    return {
      success: false,
      output: '',
      error: `找不到 agent: "${agentIdOrRole}"。请先调用 agent_list 查看可用智能体。`,
    }
  }

  // 生成唯一的 subChatId，用于隔离子会话
  // 使用负数以便与 web(0) 和 Telegram(正数) 的 chatId 区分
  const subChatId = Date.now()
  const userId = context.agentContext.userId
  const targetAgentIdNum = targetAgent.id

  // 通过 message:incoming 事件持久化用户消息（由 agentLog.ts 写 DB）
  clawEventBus.emit('message:incoming', {
    agentId: targetAgentIdNum,
    chatId: subChatId,
    content: clawMessage.text(message),
    userId,
    messageId: 0,
    timestamp: new Date(),
    source: 'agent_call',
    sessionId: context.agentContext.sessionId,
    channelId: 0,
  })

  // 执行目标 agent
  const subAgentContext = {
    logger: context.agentContext.logger,
    tenantId: targetAgent.tenantId,
    userId: context.agentContext.userId,
    agentId: targetAgent.id,
    sessionId: context.agentContext.sessionId,
  }
  let replyText: string
  try {
    const result = await processMessage(
      targetAgent,
      subChatId,
      clawMessage.text(message),
      'default',
      undefined,
      undefined,
      0,
      subAgentContext
    )
    replyText =
      result === MAX_ROUNDS_SENTINEL
        ? '(子 agent 达到最大工具调用轮次，任务可能未完成)'
        : result
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `agent "${targetAgent.title}" 执行失败: ${errMsg}`,
    }
  }

  // 通过 message:outgoing 事件持久化 assistant 回复（由 agentLog.ts 写 DB）
  const subAgentOutgoingContext = subAgentContext
  clawEventBus.emit('message:outgoing', {
    agentId: targetAgentIdNum,
    chatId: subChatId,
    content: clawMessage.text(replyText),
    userId,
    source: 'agent_call',
    sessionId: context.agentContext.sessionId,
    channelId: 0,
    agentContext: subAgentOutgoingContext,
  })

  const output = JSON.stringify(
    {
      agent: {
        id: targetAgent.id,
        title: targetAgent.title,
        role: targetAgent.roleName,
      },
      subChatId,
      result: replyText,
    },
    null,
    2
  )

  return { success: true, output }
}

// ─── agent_list / agent_call definitions ────────────────────────────────────

export const agentListDefinition: ToolDefinition = {
  name: 'agent_list',
  description:
    'List all available agents. Call this before agent_call to discover agent IDs and roles.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}

export const agentCallDefinition: ToolDefinition = {
  name: 'agent_call',
  description:
    'Delegate a task or message to another agent and return the result.',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Agent ID or roleName to delegate to',
      },
      message: {
        type: 'string',
        description: 'Task or message to delegate',
      },
    },
    required: ['agentId', 'message'],
  },
}

export { agentList, agentCall }
