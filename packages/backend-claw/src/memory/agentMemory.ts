/**
 * Agent 按天记忆服务
 *
 * 职责：
 *   1. 按天存储每个 Agent 的对话记忆摘要（claw_agent_memory 表）
 *   2. 新增/更新记忆时自动调用 EmbeddingProvider 对内容进行向量索引
 *   3. 支持语义搜索历史记忆（当 Agent 需要召回长期信息时使用）
 *   4. 当短期对话窗口超过阈值时，由调用方触发记忆刷新
 *
 * BizId 编码规则：「userId:agentId」
 * RefId  编码规则：日期字符串 YYYY-MM-DD
 */

import { getEmbeddingProvider } from '../../../backend/src/model/embedding/sqliteVecProvider.js'
import { today } from '../../../backend/src/utils/time.js'
import { createLogger } from '../kernel/logger.js'
import { clawDb } from '../storage/store/index.js'
import type { AgentMemoryRow } from '../storage/store/types.js'

const logger = createLogger('claw:agent-memory')

/** EmbeddingBiz 名称，与 embeddingProvider.ts 中类型保持一致 */
const BIZ = 'AgentMemory' as const

function bizId(userId: number, agentId: number): string {
  return `${userId}:${agentId}`
}

// ─── 查询 ─────────────────────────────────────────────────────────────────────

/** 获取某天的记忆，不存在返回 undefined */
export function getMemoryByDay(
  tenantId: number,
  userId: number,
  agentId: number,
  day: string
): AgentMemoryRow | undefined {
  return clawDb.findAgentMemoryByDay(tenantId, userId, agentId, day)
}

/** 获取今天的记忆，不存在返回 undefined */
export function getTodayMemory(
  tenantId: number,
  userId: number,
  agentId: number
): AgentMemoryRow | undefined {
  return getMemoryByDay(tenantId, userId, agentId, today())
}

/**
 * 列出某 Agent 最近 N 天的记忆（按时间倒序）
 */
export function listMemories(
  tenantId: number,
  userId: number,
  agentId: number,
  limit = 14
): AgentMemoryRow[] {
  return clawDb.findAgentMemories(tenantId, userId, agentId, limit)
}

// ─── 写入 & 索引 ──────────────────────────────────────────────────────────────

/**
 * 新增或更新某天的记忆，同时对内容进行向量索引。
 * 若 day 不传则默认为今天。
 */
export async function upsertMemory(
  tenantId: number,
  userId: number,
  agentId: number,
  content: string,
  day?: string
): Promise<AgentMemoryRow> {
  const targetDay = day ?? today()
  const row = clawDb.upsertAgentMemory({
    tenantId,
    userId,
    agentId,
    day: targetDay,
    content,
  })

  // 异步向量索引（不阻塞主流程，失败仅打日志）
  getEmbeddingProvider()
    .upsert(BIZ, `${bizId(userId, agentId)}:${targetDay}`, content)
    .catch((err) =>
      logger.warn(
        `Agent memory embedding failed (${userId}:${agentId} ${targetDay}): ${err}`
      )
    )

  logger.debug(
    `Agent memory upserted: userId=${userId} agentId=${agentId} day=${targetDay}`
  )
  return row
}

// ─── 语义搜索 ─────────────────────────────────────────────────────────────────

/**
 * 语义搜索某 Agent 的历史记忆，返回最相关的 topK 条。
 * 结果包含记忆行数据，按相关性降序排列。
 */
export async function searchMemories(
  tenantId: number,
  userId: number,
  agentId: number,
  query: string,
  topK = 5
): Promise<Array<AgentMemoryRow & { score: number }>> {
  try {
    const hits = await getEmbeddingProvider().search(BIZ, query, {
      scope: bizId(userId, agentId),
      topK,
    })
    const results: Array<AgentMemoryRow & { score: number }> = []
    for (const hit of hits) {
      // scope 格式："{userId}:{agentId}:{day}"，day 在最后一段
      const day = hit.scope.split(':').slice(2).join(':')
      const row = clawDb.findAgentMemoryByDay(tenantId, userId, agentId, day)
      if (row) {
        results.push({ ...row, score: hit.score })
      }
    }
    return results
  } catch (err) {
    logger.warn(`Agent memory search failed: ${err}`)
    return []
  }
}

// ─── 删除 ─────────────────────────────────────────────────────────────────────

/** 删除单条记忆并清理其向量索引 */
export async function deleteMemory(
  tenantId: number,
  userId: number,
  agentId: number,
  id: number
): Promise<boolean> {
  const rows = clawDb.findAgentMemories(tenantId, userId, agentId, 9999)
  const target = rows.find((r) => r.id === id)
  if (!target) return false

  const ok = clawDb.deleteAgentMemory(id)
  if (ok) {
    getEmbeddingProvider()
      .delete(BIZ, `${bizId(userId, agentId)}:${target.day}`)
      .catch((err) =>
        logger.warn(`Agent memory embedding delete failed: ${err}`)
      )
  }
  return ok
}

/** 清空某 Agent 全部记忆和向量索引 */
export async function clearAllMemories(
  tenantId: number,
  userId: number,
  agentId: number
): Promise<void> {
  clawDb.deleteAgentMemoriesByAgent(tenantId, userId, agentId)
  await getEmbeddingProvider().deleteAll(BIZ, bizId(userId, agentId))
  logger.info(`Agent memory cleared: userId=${userId} agentId=${agentId}`)
}
