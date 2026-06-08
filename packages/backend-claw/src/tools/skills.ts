/**
 * skills_search tool: syncs all local skills to embedding on each call,
 * then searches by keyword + vector similarity and returns metadata + path.
 */

import { getEmbeddingProvider } from '../../../backend/src/model/embedding/sqliteVecProvider.js'
import { skillRegistry } from '../skills/index.js'
import type { ToolDefinition, ToolResult } from '../types/index.js'

const BIZ = 'Skill' as const

// ─── Sync all local skills to embedding ───────────────────────────────────────

async function syncSkillsToEmbedding(): Promise<void> {
  const provider = getEmbeddingProvider()
  const names = skillRegistry.list()
  await Promise.all(
    names.map(async (n) => {
      const s = skillRegistry.get(n)
      if (!s) return
      const { name, version, description, tags, requiredTools } = s.manifest
      // embed text = name + description + tags for best vector matching
      const embedText = [name, description, ...(tags ?? [])].join(' ')
      const config: Record<string, unknown> = {
        name,
        version,
        description,
        skillDir: s.skillDir,
        ...(tags?.length ? { tags } : {}),
        ...(requiredTools?.length ? { requiredTools } : {}),
      }
      await provider.upsert(BIZ, name, embedText, config, {
        chunkEnable: false,
      })
    })
  )
}

// ─── skills_search ────────────────────────────────────────────────────────────

async function skillsSearch(args: { query?: string }): Promise<ToolResult> {
  // Always sync local skills to embedding before searching
  await syncSkillsToEmbedding()

  const query = (args.query ?? '').trim()

  if (!query) {
    // No query: return all from registry directly
    const names = skillRegistry.list()
    if (names.length === 0) {
      return { success: true, output: '当前没有可用的 Skill。' }
    }
    const cell = (v: string) =>
      v.replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
    const header = '| name | version | description | tags | skillDir |'
    const sep = '|---|---|---|---|---|'
    const rows = names
      .map((n) => {
        const s = skillRegistry.get(n)
        if (!s) return ''
        const { name, version, description, tags } = s.manifest
        return `| ${cell(name)} | ${version ?? '-'} | ${cell(description ?? '')} | ${tags?.join(', ') ?? '-'} | ${cell(s.skillDir)} |`
      })
      .filter(Boolean)
    return {
      success: true,
      output: [
        `全部 Skill（${names.length} 个）：`,
        '',
        header,
        sep,
        ...rows,
      ].join('\n'),
    }
  }

  // Search by vector similarity
  const results = await getEmbeddingProvider().search(BIZ, query, { topK: 8 })

  if (results.length === 0) {
    return {
      success: true,
      output: `没有找到与「${query}」相关的 Skill。`,
    }
  }

  const cell = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
  const header = '| name | version | description | tags | skillDir |'
  const sep = '|---|---|---|---|---|'
  const rows = results.map((r) => {
    const cfg = r.config as Record<string, unknown>
    const name = String(cfg['name'] ?? r.scope)
    const version = String(cfg['version'] ?? '-')
    const description = String(cfg['description'] ?? '')
    const skillDir = String(cfg['skillDir'] ?? '')
    const tags = Array.isArray(cfg['tags'])
      ? (cfg['tags'] as string[]).join(', ')
      : '-'
    return `| ${cell(name)} | ${version} | ${cell(description)} | ${cell(tags)} | ${cell(skillDir)} |`
  })

  return {
    success: true,
    output: [
      `搜索「${query}」，共找到 ${results.length} 个匹配 Skill：`,
      '',
      header,
      sep,
      ...rows,
    ].join('\n'),
  }
}

export const skillsSearchDefinition: ToolDefinition = {
  name: 'skills_search',
  description:
    'Find available agent skills by keyword. Omit query to list all.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search keyword (omit to list all)',
      },
    },
    required: [],
  },
}

export async function skillsSearchTool(args: {
  query?: string
}): Promise<ToolResult> {
  return skillsSearch(args)
}
