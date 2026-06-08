/**
 * web tool: unified web operations.
 * Supports Brave Search API (preferred), Tavily Search (fallback), and URL fetching.
 */

import { AppConfig } from '../../../backend/src/config.js'
import {
  getParam,
  type ParamConfigGroup,
} from '../../../backend/src/utils/userParam.js'
import { htmlToMarkdownWithTitle } from '../../../backend/src/utils/utils.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

// ─── Param Config ─────────────────────────────────────────────────────────────

export const ToolsParamConfig: ParamConfigGroup[] = [
  {
    group: '搜索',
    params: [
      {
        name: 'Tools.Web.BraveEnable',
        title: '启用 Brave Search',
        type: 'switch',
        defaultValue: false,
      },
      {
        name: 'Tools.Web.BraveApiKey',
        title: 'Brave Search API Key',
        type: 'text',
        defaultValue: '',
      },
      {
        name: 'Tools.Web.TavilyEnable',
        title: '启用 Tavily 搜索',
        type: 'switch',
        defaultValue: false,
      },
      {
        name: 'Tools.Web.TavilyApiKey',
        title: 'Tavily 搜索 API Key',
        type: 'text',
        defaultValue: '',
      },
    ],
  },
]

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const webBatchSearchDefinition: ToolDefinition = {
  name: 'web_batch_search',
  description: 'Search the web with multiple keywords simultaneously.',
  parameters: {
    type: 'object',
    properties: {
      keywordsList: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of keywords to search',
      },
      format: {
        type: 'string',
        enum: ['json', 'markdown', 'text', 'table'],
        description: 'Output format (default: table)',
      },
    },
    required: ['keywordsList'],
  },
}

export const webBatchFetchDefinition: ToolDefinition = {
  name: 'web_batch_fetch',
  description: 'Fetch and extract text content from multiple URLs.',
  parameters: {
    type: 'object',
    properties: {
      urlList: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of URLs to fetch',
      },
      format: {
        type: 'string',
        enum: ['json', 'markdown', 'text'],
        description: 'Output format (default: markdown)',
      },
    },
    required: ['urlList'],
  },
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface SearchResultItem {
  title: string
  url: string
  snippet: string
  source?: string
  date?: string
}

interface SearchResult {
  query: string
  results: SearchResultItem[]
  provider: string
}

// ─── Brave Search ─────────────────────────────────────────────────────────────

async function searchBrave(
  query: string,
  apiKey: string,
  maxResults: number
): Promise<SearchResult | null> {
  try {
    const resp = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: AbortSignal.timeout(15_000),
      }
    )
    if (!resp.ok) return null
    const data = (await resp.json()) as {
      web?: {
        results?: Array<{
          title: string
          description: string
          url: string
          age?: string
          meta_url?: { hostname?: string }
        }>
      }
    }
    const items = data.web?.results ?? []
    return {
      query,
      provider: 'brave',
      results: items.map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.description ?? '',
        source: item.meta_url?.hostname ?? '',
        date: item.age ?? '',
      })),
    }
  } catch {
    return null
  }
}

// ─── Tavily Search ────────────────────────────────────────────────────────────

async function searchTavily(
  query: string,
  apiKey: string,
  maxResults: number
): Promise<SearchResult | null> {
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as {
      results?: Array<{
        title: string
        content: string
        url: string
        published_date?: string
      }>
    }
    const items = data.results ?? []
    return {
      query,
      provider: 'tavily',
      results: items.map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.content ?? '',
        date: item.published_date ?? '',
      })),
    }
  } catch {
    return null
  }
}

// ─── Search Dispatcher ────────────────────────────────────────────────────────

async function searchOne(
  query: string,
  context: ToolContext,
  maxResults: number
): Promise<SearchResult> {
  const [braveEnabled, braveKey, tavilyEnabled, tavilyKey] = await Promise.all([
    getParam(
      context.agentContext.tenantId,
      context.agentContext.userId,
      'Tools.Web.BraveEnable',
      'false'
    ),
    getParam(
      context.agentContext.tenantId,
      context.agentContext.userId,
      'Tools.Web.BraveApiKey',
      ''
    ),
    getParam(
      context.agentContext.tenantId,
      context.agentContext.userId,
      'Tools.Web.TavilyEnable',
      'false'
    ),
    getParam(
      context.agentContext.tenantId,
      context.agentContext.userId,
      'Tools.Web.TavilyApiKey',
      ''
    ),
  ])

  if (braveEnabled === 'true' && braveKey) {
    const result = await searchBrave(query, braveKey, maxResults)
    if (result) return result
  }

  if (tavilyEnabled === 'true' && tavilyKey) {
    const result = await searchTavily(query, tavilyKey, maxResults)
    if (result) return result
  }

  return { query, provider: 'none', results: [] }
}

// ─── URL Fetcher ──────────────────────────────────────────────────────────────

async function fetchOneUrl(url: string): Promise<{
  url: string
  success: boolean
  title: string
  content: string
}> {
  try {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return {
        url,
        success: false,
        title: '',
        content: 'URL 格式无效，请提供完整的 http/https 链接',
      }
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        url,
        success: false,
        title: '',
        content: '只支持 http/https 协议',
      }
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': `Mozilla/5.0 (compatible; ${AppConfig.title}/1.0)`,
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      return {
        url,
        success: false,
        title: '',
        content: `抓取失败: HTTP ${response.status}`,
      }
    }

    const html = await response.text()
    const { title, markdown } = htmlToMarkdownWithTitle(html)

    if (markdown.length < 20) {
      return {
        url,
        success: false,
        title: '',
        content: '无法从网页提取有效内容，请检查 URL 是否可公开访问',
      }
    }

    return { url, success: true, title: title ?? '', content: markdown }
  } catch (err) {
    return {
      url,
      success: false,
      title: '',
      content: `抓取失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

function formatSearchResult(result: SearchResult, format: string): string {
  if (format === 'json') {
    return JSON.stringify(result, null, 2)
  }
  if (format === 'table') {
    const cell = (v: string | undefined) =>
      (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 120) || '-'
    const header = '| title | url | snippet | source | date |'
    const sep = '|---|---|---|---|---|'
    const rows = result.results.map(
      (item) =>
        `| ${cell(item.title)} | ${cell(item.url)} | ${cell(item.snippet)} | ${cell(item.source)} | ${cell(item.date)} |`
    )
    return [
      `## ${result.query} (${result.provider})`,
      '',
      header,
      sep,
      ...rows,
    ].join('\n')
  }
  const lines: string[] = [`## 搜索: ${result.query} (${result.provider})`]
  for (const item of result.results) {
    if (format === 'markdown') {
      lines.push(`\n### [${item.title}](${item.url})`)
      const meta = [item.source, item.date].filter(Boolean).join(' · ')
      if (meta) lines.push(`*${meta}*`)
      if (item.snippet) lines.push(`\n${item.snippet}`)
    } else {
      lines.push(`\n${item.title}`)
      lines.push(item.url)
      if (item.snippet) lines.push(item.snippet)
    }
  }
  return lines.join('\n')
}

function formatFetchResult(
  r: { url: string; success: boolean; title: string; content: string },
  format: string
): string {
  if (!r.success) return `## URL: ${r.url}\n\n> 错误: ${r.content}`
  if (format === 'json') {
    return JSON.stringify(
      { url: r.url, title: r.title, content: r.content },
      null,
      2
    )
  }
  const header = r.title ? `# ${r.title}\n\n` : ''
  if (format === 'text') {
    return `${r.url}\n\n${header}${r.content.replace(/[#*`[\]]/g, '')}`
  }
  // markdown (default)
  return `## URL: ${r.url}\n\n${header}${r.content}`
}

function requireToolContext(context?: ToolContext): ToolContext {
  if (
    context == null ||
    !Number.isInteger(context.agentContext.userId) ||
    context.agentContext.userId <= 0 ||
    !Number.isInteger(context.agentContext.tenantId) ||
    context.agentContext.tenantId <= 0
  ) {
    throw new Error('tool context requires valid tenantId and userId')
  }
  return context
}

function isMockMode(): boolean {
  return (
    process.env.AUTO_TEST_MODE === '1' || process.env.SEED_DATA_INIT === '1'
  )
}

function mockSearchResults(queries: string[]): SearchResult[] {
  return queries.map((q) => ({
    query: q,
    provider: 'mock',
    results: [
      {
        title: `${q} - 维基百科`,
        url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(q)}`,
        snippet: `${q} 是一个重要的概念，广泛应用于多个领域。本文介绍其基本定义、历史背景及主要应用场景。`,
        source: 'zh.wikipedia.org',
        date: '2025-01-01',
      },
      {
        title: `${q} 入门指南 - 官方文档`,
        url: `https://docs.example.com/${encodeURIComponent(q)}/guide`,
        snippet: `详细介绍 ${q} 的使用方法、最佳实践及常见问题解答。适合初学者和进阶用户阅读。`,
        source: 'docs.example.com',
        date: '2025-03-15',
      },
      {
        title: `关于 ${q} 的最新研究进展`,
        url: `https://news.example.com/article/${encodeURIComponent(q)}`,
        snippet: `最新研究表明，${q} 在现代技术中扮演着越来越重要的角色，相关领域专家对此进行了深入分析。`,
        source: 'news.example.com',
        date: '2025-04-01',
      },
    ],
  }))
}

// ─── Exported Tool Functions ──────────────────────────────────────────────────

export async function webBatchSearch(
  args: { keywordsList: string[]; format?: string },
  context: ToolContext
): Promise<ToolResult> {
  const format = args.format ?? 'table'

  if (isMockMode()) {
    const results = mockSearchResults(args.keywordsList)
    if (format === 'json') {
      return { success: true, output: JSON.stringify({ results }, null, 2) }
    }
    return {
      success: true,
      output: results
        .map((r) => formatSearchResult(r, format))
        .join('\n\n---\n\n'),
    }
  }

  try {
    const toolContext = requireToolContext(context)
    const [braveEnabled, tavilyEnabled] = await Promise.all([
      getParam(
        toolContext.agentContext.tenantId,
        toolContext.agentContext.userId,
        'Tools.Web.BraveEnable',
        'false'
      ),
      getParam(
        toolContext.agentContext.tenantId,
        toolContext.agentContext.userId,
        'Tools.Web.TavilyEnable',
        'false'
      ),
    ])
    if (braveEnabled !== 'true' && tavilyEnabled !== 'true') {
      return {
        success: false,
        output:
          '搜索功能未启用，请前往"配置 > 功能设置 > 搜索"配置搜索接口后再使用。',
        error: 'search not configured',
      }
    }

    if (args.keywordsList.length === 0) {
      return { success: false, output: '', error: 'keywordsList 不能为空' }
    }

    const results = await Promise.all(
      args.keywordsList.map((q) => searchOne(q, toolContext, 5))
    )

    if (format === 'json') {
      return { success: true, output: JSON.stringify({ results }, null, 2) }
    }
    return {
      success: true,
      output: results
        .map((r) => formatSearchResult(r, format))
        .join('\n\n---\n\n'),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `web_batch_search failed: ${msg}`,
    }
  }
}

export async function webBatchFetch(
  args: { urlList: string[]; format?: string },
  _context?: ToolContext
): Promise<ToolResult> {
  const format = args.format ?? 'markdown'

  if (isMockMode()) {
    const mockResults = args.urlList.map((url) => ({
      url,
      success: true,
      title: `Mock Page: ${url}`,
      content: `这是 ${url} 的模拟内容。\n\n本页面包含关于该 URL 的测试数据，用于开发和测试环境。`,
    }))
    return {
      success: true,
      output: mockResults
        .map((r) => formatFetchResult(r, format))
        .join('\n\n---\n\n'),
    }
  }

  try {
    if (args.urlList.length === 0) {
      return { success: false, output: '', error: 'urlList 不能为空' }
    }
    const results = await Promise.all(args.urlList.map(fetchOneUrl))
    const anySuccess = results.some((r) => r.success)
    return {
      success: anySuccess,
      output: results
        .map((r) => formatFetchResult(r, format))
        .join('\n\n---\n\n'),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `web_batch_fetch failed: ${msg}`,
    }
  }
}
