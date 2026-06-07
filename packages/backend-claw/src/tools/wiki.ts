/**
 * Project Wiki management tools.
 *
 * Tools expose the claw_wiki table to agents:
 *
 *   wiki_list          — 列出项目知识库条目（支持关键词搜索）
 *   wiki_search        — 语义搜索项目知识库（向量相似度检索）
 *   wiki_get           — 获取单条知识库详情
 *   wiki_batch_add     — 批量新增知识库条目
 *   wiki_batch_edit    — 批量编辑知识库条目
 *   wiki_batch_delete  — 批量删除知识库条目
 */

import { HumanMessage } from '@langchain/core/messages'
import { getModelConfigList } from '../../../backend/src/config/index.js'
import { getEmbeddingProvider } from '../../../backend/src/model/embedding/sqliteVecProvider.js'
import { modelCall } from '../../../backend/src/model/model/index.js'
import { createLogger } from '../kernel/logger.js'
import { clawDb } from '../storage/store/index.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

const logger = createLogger('wikiManage')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * 从 wiki 内容中提取命中 chunk 及其前后相邻 chunk 的合并文本。
 * 策略：取出该 wiki 在 embedding DB 中所有 chunk，按 startLine 排序，
 * 找到命中 chunk 的位置后把前后各一个 chunk 一起合并返回。
 */
function extractChunkWithContext(
  wikiId: number,
  projectId: number,
  hitStartLine: number | undefined,
  hitEndLine: number | undefined,
  wikiContent: string,
  maxLen = 3000
): string {
  logger.debug(
    { wikiId, projectId, hitStartLine, hitEndLine, maxLen },
    'extractChunkWithContext'
  )

  if (hitStartLine === undefined || hitEndLine === undefined) {
    logger.debug(
      { wikiId },
      'extractChunkWithContext: no hit line info, fallback to slice'
    )
    return wikiContent.slice(0, maxLen)
  }

  // 使用行号范围提取内容
  const lines = wikiContent.split('\n')
  return lines
    .slice(hitStartLine - 1, hitEndLine)
    .join('\n')
    .slice(0, maxLen)
}

/**
 * 将图片描述成文本，用于增强语义搜索查询。
 * 图片格式：{ url: string } 或 { data: string; mimeType: string }
 */
async function describeImagesForSearch(
  tenantId: number,
  userId: number,
  images: Array<{ url?: string; data?: string; mimeType?: string }>
): Promise<string> {
  const msgContent: any[] = [
    {
      type: 'text',
      text: '请简洁描述以下图片的内容，用于语义检索，只需输出核心关键词和主题，不超过100字。',
    },
  ]
  for (const img of images) {
    if (img?.url) {
      msgContent.push({ type: 'image_url', image_url: { url: img.url } })
    } else if (img?.data && img?.mimeType) {
      msgContent.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.data}` },
      })
    }
  }
  const result = await modelCall({
    tenantId,
    userId,
    biz: 'Claw',
    bizId: String(userId),
    modelConfigList: await getModelConfigList(userId, tenantId, 'default'),
    maxRetry: 1,
    context: 'wiki-image-search',
  })
  return result.type === 'text' ? result.content : ''
}

// ─── wiki_list ────────────────────────────────────────────────────────

async function wikiList(args: {
  project_id: number
  keyword?: string
}): Promise<ToolResult> {
  try {
    const records = clawDb.searchWikis(Number(args.project_id), {
      keyword: args.keyword?.trim() || undefined,
    })
    if (records.length === 0) {
      return { success: true, output: '该项目知识库暂无条目。' }
    }
    const cell = (v: string | null | undefined) =>
      (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
    const header = '| id | title | source_url |'
    const sep = '|---|---|---|'
    const rows = records.map(
      (w) => `| ${w.id} | ${cell(w.title)} | ${cell(w.source_url)} |`
    )
    return {
      success: true,
      output: [
        `项目 id=${args.project_id} 共 ${records.length} 条知识库：`,
        '',
        header,
        sep,
        ...rows,
      ].join('\n'),
    }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `wiki_list 失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── wiki_search ──────────────────────────────────────────────────────

async function wikiSearch(
  args: {
    project_id: number
    query: string
    top_k?: number
    images?: Array<{ url?: string; data?: string; mimeType?: string }>
  },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const topK = args.top_k ?? 5
    const projectId = Number(args.project_id)

    // 若有图片，先用视觉模型描述图片内容，追加到查询
    let effectiveQuery = args.query
    if (Array.isArray(args.images) && args.images.length > 0) {
      try {
        const imageDesc = await describeImagesForSearch(
          context.agentContext.tenantId,
          context.agentContext.userId,
          args.images
        )
        if (imageDesc) effectiveQuery = `${args.query}\n${imageDesc}`.trim()
      } catch {
        // 图片描述失败不影响文本搜索
      }
    }

    // 多取一些结果，避免同一 wiki 多个 chunk 占满 topK 后漏掉其他 wiki
    const hits = await getEmbeddingProvider().search('Wiki', effectiveQuery, {
      scope: String(projectId),
      topK: topK * 3,
    })

    if (hits.length > 0) {
      // 按 wiki id 聚合，保留最高分的 chunk 及其行号
      const wikiHitMap = new Map<
        number,
        { score: number; startLine?: number; endLine?: number }
      >()
      for (const hit of hits) {
        const parts = hit.scope.split(':')
        const id = Number(parts[1])
        if (Number.isNaN(id)) continue
        const existing = wikiHitMap.get(id)
        if (!existing || hit.score > existing.score) {
          wikiHitMap.set(id, {
            score: hit.score,
            startLine: parts.length >= 3 ? Number(parts[1]) : undefined,
            endLine: parts.length >= 3 ? Number(parts[2]) : undefined,
          })
        }
      }

      // 按分数降序取 topK 个不同 wiki
      const topWikiIds = Array.from(wikiHitMap.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, topK)
        .map(([id]) => id)

      const wikis = topWikiIds
        .map((id) => {
          const wiki = clawDb.findWikiById(id)
          if (!wiki) return null
          const hit = wikiHitMap.get(id)!
          // 使用相邻 chunk 上下文扩展，保留更完整的语义片段
          const snippet = extractChunkWithContext(
            id,
            projectId,
            hit.startLine,
            hit.endLine,
            wiki.content ?? ''
          )
          return { wiki, snippet }
        })
        .filter((r): r is NonNullable<typeof r> => r != null)

      if (wikis.length > 0) {
        const lines = wikis.map(
          ({ wiki, snippet }) => `### [id:${wiki.id}] ${wiki.title}\n${snippet}`
        )
        return {
          success: true,
          output: [`找到 ${wikis.length} 条相关知识：`, ...lines].join('\n\n'),
        }
      }
    }

    // 向量搜索无结果时降级为关键词搜索
    const fallback = clawDb.searchWikis(projectId, {
      keyword: effectiveQuery,
      limit: topK,
    })
    if (fallback.length === 0) {
      return { success: true, output: '未找到相关知识库条目。' }
    }
    const lines = fallback.map(
      (w) => `### [id:${w.id}] ${w.title}\n${(w.content ?? '').slice(0, 300)}`
    )
    return {
      success: true,
      output: [`关键词匹配到 ${fallback.length} 条相关知识：`, ...lines].join(
        '\n\n'
      ),
    }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `wiki_search 失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── wiki_get ─────────────────────────────────────────────────────────

async function wikiGet(args: { id: number }): Promise<ToolResult> {
  try {
    const wiki = clawDb.findWikiById(Number(args.id))
    if (!wiki) {
      return {
        success: false,
        output: '',
        error: `找不到 id=${args.id} 的知识库条目。`,
      }
    }
    const lines = [
      `id: ${wiki.id}`,
      `title: ${wiki.title}`,
      `source_url: ${wiki.source_url ?? '-'}`,
      `status: ${wiki.status}`,
      `created_at: ${wiki.created_at}`,
      ``,
      wiki.content ?? '',
    ]
    return { success: true, output: lines.join('\n') }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `wiki_get 失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── wiki_batch_add ───────────────────────────────────────────────────

async function wikiBatchAdd(
  args: {
    project_id: number
    items: Array<{ title: string; biz?: string; content?: string; source_url?: string }>
  },
  context: ToolContext
): Promise<ToolResult> {
  try {
    if (!args.items?.length) {
      return { success: false, output: '', error: 'items 不能为空' }
    }
    const userId = context.agentContext.userId
    const projectId = Number(args.project_id)
    const created: number[] = []

    for (const item of args.items) {
      if (!item.title?.trim()) continue
      const row = clawDb.insertWiki({
        tenantId: context.agentContext.tenantId,
        userId,
        projectId,
        title: item.title.trim(),
        biz: item.biz?.trim() || undefined,
        content: item.content,
        sourceUrl: item.source_url,
        status: 'processing',
      })
      created.push(row.id)

      // background embed
      const textForEmbed = [item.title.trim(), item.content || ''].join('\n')
      ;(async (id: number, text: string) => {
        try {
          await getEmbeddingProvider().upsert(
            'Wiki',
            `${projectId}:${id}`,
            text
          )
          clawDb.updateWiki(id, { status: 'success' })
        } catch {
          clawDb.updateWiki(id, { status: 'success' })
        }
      })(row.id, textForEmbed).catch(() => {})
    }

    return {
      success: true,
      output: `已新增 ${created.length} 条知识库条目，id: ${created.join(', ')}`,
    }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `wiki_batch_add 失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── wiki_batch_edit ──────────────────────────────────────────────────

async function wikiBatchEdit(args: {
  items: Array<{
    id: number
    title?: string
    biz?: string
    content?: string
    source_url?: string
  }>
}): Promise<ToolResult> {
  try {
    if (!args.items?.length) {
      return { success: false, output: '', error: 'items 不能为空' }
    }
    const updated: number[] = []
    for (const item of args.items) {
      const row = clawDb.findWikiById(Number(item.id))
      if (!row) continue

      const updateData: Parameters<typeof clawDb.updateWiki>[1] = {}
      if (item.title != null) updateData.title = item.title.trim()
      if (item.biz !== undefined) updateData.biz = item.biz?.trim() || null
      if (item.content !== undefined) updateData.content = item.content || null
      if (item.source_url !== undefined)
        updateData.sourceUrl = item.source_url || null

      const needsReEmbed = item.title != null || item.content !== undefined
      if (needsReEmbed) updateData.status = 'processing'

      clawDb.updateWiki(Number(item.id), updateData)
      updated.push(Number(item.id))

      if (needsReEmbed) {
        const fresh = clawDb.findWikiById(Number(item.id))!
        const text = [fresh.title, fresh.content || ''].join('\n')
        ;(async (id: number, t: string) => {
          try {
            // 删除旧向量
            await getEmbeddingProvider().delete(
              'Wiki',
              `${fresh.project_id}:${id}`
            )
            await getEmbeddingProvider().upsert(
              'Wiki',
              `${fresh.project_id}:${id}`,
              t
            )
            clawDb.updateWiki(id, { status: 'success' })
          } catch {
            clawDb.updateWiki(id, { status: 'success' })
          }
        })(Number(item.id), text).catch(() => {})
      }
    }

    return {
      success: true,
      output: `已更新 ${updated.length} 条知识库条目，id: ${updated.join(', ')}`,
    }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `wiki_batch_edit 失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── wiki_batch_delete ────────────────────────────────────────────────

async function wikiBatchDelete(args: { ids: number[] }): Promise<ToolResult> {
  try {
    if (!args.ids?.length) {
      return { success: false, output: '', error: 'ids 不能为空' }
    }
    let deleted = 0
    const provider = getEmbeddingProvider()
    for (const id of args.ids) {
      const row = clawDb.findWikiById(Number(id))
      if (row && clawDb.deleteWiki(Number(id))) {
        provider.delete('Wiki', `${row.project_id}:${id}`).catch(() => {})
        deleted++
      }
    }
    return { success: true, output: `已删除 ${deleted} 条知识库条目。` }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `wiki_batch_delete 失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

const wikiItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', description: '[Required for update] Item ID' },
    title: { type: 'string', description: '[Required for create] Item title' },
    content: { type: 'string', description: 'Content (Markdown, optional)' },
    source_url: { type: 'string', description: 'Source URL (optional)' },
  },
}

export const wikiListDefinition: ToolDefinition = {
  name: 'wiki_list',
  description: 'List wiki items for a project. Filter by keyword.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      keyword: { type: 'string', description: 'Keyword filter (optional)' },
    },
    required: ['project_id'],
  },
}

export const wikiGetDefinition: ToolDefinition = {
  name: 'wiki_get',
  description: 'Get wiki item details by id.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Item ID' },
    },
    required: ['id'],
  },
}

export const wikiSearchDefinition: ToolDefinition = {
  name: 'wiki_search',
  description: 'Semantic search wiki items for a project.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      query: { type: 'string', description: 'Semantic search query' },
      top_k: {
        type: 'number',
        description: 'Number of items to return (default 5)',
      },
      images: {
        type: 'array',
        items: { type: 'string' },
        description:
          'List of image base64 strings (optional, supports multi-modal query)',
      },
    },
    required: ['project_id', 'query'],
  },
}

export const wikiBatchAddDefinition: ToolDefinition = {
  name: 'wiki_batch_add',
  description: 'Batch create wiki items for a project.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      items: {
        type: 'array',
        description: 'List of items to create',
        items: wikiItemSchema,
      },
    },
    required: ['project_id', 'items'],
  },
}

export const wikiBatchEditDefinition: ToolDefinition = {
  name: 'wiki_batch_edit',
  description: 'Batch edit wiki items.',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'List of items to edit',
        items: wikiItemSchema,
      },
    },
    required: ['items'],
  },
}

export const wikiBatchDeleteDefinition: ToolDefinition = {
  name: 'wiki_batch_delete',
  description: 'Batch delete wiki items by ids.',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'List of item IDs to delete',
      },
    },
    required: ['ids'],
  },
}

export {
  wikiList,
  wikiGet,
  wikiSearch,
  wikiBatchAdd,
  wikiBatchEdit,
  wikiBatchDelete,
}
