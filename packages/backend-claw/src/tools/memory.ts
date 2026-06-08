/**
 * Memory and Soul tools for agents.
 *
 * Tools:
 *   memory_get / memory_update           — 智能体私有记忆
 *   memory_global_get / memory_global_update — 全局共享记忆
 *   soul_get / soul_update               — 风格定义（针对当前 agent）
 *   user_get / user_update               — 用户情况描述
 *
 * update 行为：工具内部先读取当前值，合并用户传入的修改点，调用大模型生成
 * 完整更新内容后写回，无需调用方先 get 再 set。
 */

import { HumanMessage } from '@langchain/core/messages'
import {
  modelCall,
  resolveModelConfigListByParamName,
} from '../../../backend/src/model/model/index.js'
import { paramDb } from '../../../backend/src/storage/store/userParam.js'
import {
  getMemory,
  getSoul,
  getUser,
  setMemory,
  setSoul,
  setUser,
} from '../memory/index.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

// ─── Model helper ─────────────────────────────────────────────────────────────

/**
 * 调用大模型将现有内容与变更点合并，返回完整的更新后内容。
 * 若当前内容为空，则将 changes 直接写回。
 */
async function mergeContentWithModel(
  current: string,
  changes: string,
  callContext: string,
  tenantId: number,
  userId: number
): Promise<string> {
  const modelConfigList = await resolveModelConfigListByParamName(
    paramDb,
    tenantId,
    userId,
    'MemoryUpdateModel'
  )

  if (!current.trim()) {
    return changes
  }

  const systemPrompt = `You are a memory manager. Merge the existing content with the requested changes to produce a clean, complete updated version in Markdown. Preserve all existing information that is not explicitly replaced or removed. Output ONLY the merged Markdown content, no explanations.`

  const userPrompt = `## Existing content:\n${current}\n\n## Changes to apply:\n${changes}\n\nOutput the complete updated content.`

  const result = await modelCall({
    tenantId,
    userId,
    biz: 'Claw',
    bizId: String(userId),
    modelConfigList,
    systemPrompt,
    appendMessages: [new HumanMessage(userPrompt)],
    temperature: 0.3,
    maxRetry: 2,
    context: callContext,
  })
  return result.type === 'text' ? result.content : changes
}

// ─── memory (agent private) ───────────────────────────────────────────────────

async function memoryGet(
  _args: Record<string, never>,
  context: ToolContext
): Promise<ToolResult> {
  try {
    const content = await getMemory(
      context.agentContext.tenantId,
      context.agentContext.userId,
      context.agentContext.agentId
    )
    if (!content.trim()) {
      return { success: true, output: '（暂无记忆）' }
    }
    return { success: true, output: content }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `memory_get 失败：${msg}` }
  }
}

async function memoryUpdate(
  args: { content: string },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const current = await getMemory(
      context.agentContext.tenantId,
      context.agentContext.userId,
      context.agentContext.agentId
    )
    const merged = await mergeContentWithModel(
      current,
      args.content,
      'memory-update',
      context.agentContext.tenantId,
      context.agentContext.userId
    )
    await setMemory(
      context.agentContext.tenantId,
      context.agentContext.userId,
      merged,
      context.agentContext.agentId
    )
    return {
      success: true,
      output: `记忆已更新：智能体记忆 (AgentMemory:${context.agentContext.agentId})`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `memory_update 失败：${msg}` }
  }
}

// ─── memory_global ────────────────────────────────────────────────────────────

async function memoryGlobalGet(
  _args: Record<string, never>,
  context: ToolContext
): Promise<ToolResult> {
  try {
    const content = await getMemory(
      context.agentContext.tenantId,
      context.agentContext.userId,
      undefined
    )
    if (!content.trim()) {
      return { success: true, output: '（暂无全局记忆）' }
    }
    return { success: true, output: content }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `memory_global_get 失败：${msg}`,
    }
  }
}

async function memoryGlobalUpdate(
  args: { content: string },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const current = await getMemory(
      context.agentContext.tenantId,
      context.agentContext.userId,
      undefined
    )
    const merged = await mergeContentWithModel(
      current,
      args.content,
      'memory-global-update',
      context.agentContext.tenantId,
      context.agentContext.userId
    )
    await setMemory(
      context.agentContext.tenantId,
      context.agentContext.userId,
      merged,
      undefined
    )
    return { success: true, output: '全局记忆已更新 (Memory)' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `memory_global_update 失败：${msg}`,
    }
  }
}

// ─── soul ─────────────────────────────────────────────────────────────────────

async function soulGet(
  _args: Record<string, never>,
  context: ToolContext
): Promise<ToolResult> {
  try {
    const content = await getSoul(
      context.agentContext.tenantId,
      context.agentContext.userId,
      context.agentContext.agentId
    )
    if (!content.trim()) {
      return { success: true, output: '（暂无风格定义）' }
    }
    return { success: true, output: content }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `soul_get 失败：${msg}` }
  }
}

async function soulUpdate(
  args: { content: string },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const current = await getSoul(
      context.agentContext.tenantId,
      context.agentContext.userId,
      context.agentContext.agentId
    )
    const merged = await mergeContentWithModel(
      current,
      args.content,
      'soul-update',
      context.agentContext.tenantId,
      context.agentContext.userId
    )
    await setSoul(
      context.agentContext.tenantId,
      context.agentContext.userId,
      merged,
      context.agentContext.agentId
    )
    return {
      success: true,
      output: `风格已更新：智能体风格 (AgentSoul:${context.agentContext.agentId})，下次对话立即生效。`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `soul_update 失败：${msg}` }
  }
}

// ─── user ─────────────────────────────────────────────────────────────────────

async function userGet(
  _args: Record<string, never>,
  context: ToolContext
): Promise<ToolResult> {
  try {
    const content = await getUser(
      context.agentContext.tenantId,
      context.agentContext.userId
    )
    if (!content.trim()) {
      return { success: true, output: '（暂无用户情况描述）' }
    }
    return { success: true, output: content }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `user_get 失败：${msg}` }
  }
}

async function userUpdate(
  args: { content: string },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const current = await getUser(
      context.agentContext.tenantId,
      context.agentContext.userId
    )
    const merged = await mergeContentWithModel(
      current,
      args.content,
      'user-update',
      context.agentContext.tenantId,
      context.agentContext.userId
    )
    await setUser(
      context.agentContext.tenantId,
      context.agentContext.userId,
      merged
    )
    return { success: true, output: '用户情况已更新 (User)' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `user_update 失败：${msg}` }
  }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

export const memoryGetDefinition: ToolDefinition = {
  name: 'memory_get',
  description: 'Read the current agent private memory across conversations.',
  parameters: { type: 'object', properties: {}, required: [] },
}

export const memoryUpdateDefinition: ToolDefinition = {
  name: 'memory_update',
  description: 'Update agent private memory with smart model-based merging.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Changes to apply (Markdown), auto-merged',
      },
    },
    required: ['content'],
  },
}

export const memoryGlobalGetDefinition: ToolDefinition = {
  name: 'memory_global_get',
  description: 'Read the global shared memory accessible to all agents.',
  parameters: { type: 'object', properties: {}, required: [] },
}

export const memoryGlobalUpdateDefinition: ToolDefinition = {
  name: 'memory_global_update',
  description: 'Update global shared memory with smart model-based merging.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Changes to apply (Markdown), auto-merged',
      },
    },
    required: ['content'],
  },
}

export const userGetDefinition: ToolDefinition = {
  name: 'user_get',
  description: 'Read the current user profile description.',
  parameters: { type: 'object', properties: {}, required: [] },
}

export const userUpdateDefinition: ToolDefinition = {
  name: 'user_update',
  description:
    'Update user profile description with smart model-based merging.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Changes to apply (Markdown), auto-merged',
      },
    },
    required: ['content'],
  },
}

export const soulGetDefinition: ToolDefinition = {
  name: 'soul_get',
  description: "Read the current agent's style and personality definition.",
  parameters: { type: 'object', properties: {}, required: [] },
}

export const soulUpdateDefinition: ToolDefinition = {
  name: 'soul_update',
  description:
    "Update the current agent's style definition with smart model-based merging.",
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Changes to apply (Markdown), auto-merged',
      },
    },
    required: ['content'],
  },
}

export {
  memoryGet,
  memoryUpdate,
  memoryGlobalGet,
  memoryGlobalUpdate,
  userGet,
  userUpdate,
  soulGet,
  soulUpdate,
}
