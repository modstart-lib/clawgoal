import OpenAI from 'openai'
import { createNamedLogger } from '../../utils/logger.js'

const logger = createNamedLogger('model_embedding_provider')

// ─── EmbeddingModelConfig ────────────────────────────────────────────────────

export interface EmbeddingModelConfig {
  /** Provider name as registered via initLlmProviders() */
  name: string
  /**
   * Embedding backend:
   *   - 'default' — 使用内置 sqlite-vec 向量存储，无需配置外部模型
   *   - 'openai'  — 调用 OpenAI 兼容的 embedding 接口（需要 apiKey/apiBase）
   */
  type?: 'openai' | 'default'
  /** OpenAI-compatible API key (required for type='openai') */
  apiKey?: string
  /** Optional API base URL override (for type='openai') */
  apiBase?: string
  /** Embedding model name, e.g. "text-embedding-3-small" (default for openai). */
  model?: string
}

// ─── IEmbedder ────────────────────────────────────────────────────────────────

export interface IEmbedder {
  embed(text: string): Promise<Float32Array>
  embedBatch(texts: string[]): Promise<Float32Array[]>
}

// ─── Embedder (OpenAI-compatible) ─────────────────────────────────────────────

const DEFAULT_EMBED_MODEL = 'text-embedding-3-small'

class Embedder implements IEmbedder {
  private client: OpenAI
  private model: string

  constructor(cfg: EmbeddingModelConfig) {
    this.client = new OpenAI({
      apiKey: cfg.apiKey ?? '',
      baseURL: cfg.apiBase,
    })
    this.model = cfg.model ?? DEFAULT_EMBED_MODEL
    logger.debug(
      `Embedder ready: model=${this.model} base=${cfg.apiBase ?? 'default'}`
    )
  }

  async embed(text: string): Promise<Float32Array> {
    logger.info(
      {
        model: this.model,
        textLength: text.length,
        textPreview: text.slice(0, 80),
      },
      'Embedding request (single)'
    )
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
      encoding_format: 'float',
    })
    const data = response.data[0]
    if (!data) throw new Error('Embedder: no embedding returned')
    const vec = new Float32Array(data.embedding)
    logger.info(
      { model: this.model, dim: vec.length },
      'Embedding response (single)'
    )
    return vec
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return []
    logger.info(
      {
        model: this.model,
        count: texts.length,
        previews: texts.slice(0, 3).map((t) => t.slice(0, 60)),
      },
      'Embedding request (batch)'
    )
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
      encoding_format: 'float',
    })
    const sorted = [...response.data].sort((a, b) => a.index - b.index)
    const vecs = sorted.map((d) => new Float32Array(d.embedding))
    logger.info(
      { model: this.model, count: vecs.length, dim: vecs[0]?.length ?? 0 },
      'Embedding response (batch)'
    )
    return vecs
  }
}

// ─── NullEmbedder ─────────────────────────────────────────────────────────────

class NullEmbedder implements IEmbedder {
  private static readonly DIM = 384
  async embed(_text: string): Promise<Float32Array> {
    return new Float32Array(NullEmbedder.DIM)
  }
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return texts.map(() => new Float32Array(NullEmbedder.DIM))
  }
}

// ─── Shared embedder singleton ────────────────────────────────────────────────

let _sharedEmbedder: IEmbedder | null = null
let _sharedEmbedderConfigKey: string | null = null

function makeConfigKey(cfg: EmbeddingModelConfig): string {
  return JSON.stringify({
    type: cfg.type ?? 'openai',
    model: cfg.model,
    apiKey: cfg.apiKey ? 'SET' : 'UNSET',
    apiBase: cfg.apiBase,
  })
}

export function createEmbedder(cfg: EmbeddingModelConfig): IEmbedder {
  const key = makeConfigKey(cfg)
  if (_sharedEmbedder && _sharedEmbedderConfigKey === key) {
    logger.debug('Reusing shared embedder instance')
    return _sharedEmbedder
  }
  let embedder: IEmbedder
  if (cfg.type === 'default' || !cfg.apiKey) {
    logger.info(
      'Using default sqlite-vec embedder (null vectors, no external model required)'
    )
    embedder = new NullEmbedder()
  } else {
    logger.info(
      `Using remote OpenAI-compatible embedder (model: ${cfg.model ?? DEFAULT_EMBED_MODEL})`
    )
    embedder = new Embedder(cfg)
  }
  _sharedEmbedder = embedder
  _sharedEmbedderConfigKey = key
  return embedder
}

// ─── EmbeddingBiz ─────────────────────────────────────────────────────────────

export type EmbeddingBiz =
  | 'ProjectWiki'
  | 'Memory'
  | 'AgentMemory'
  | 'Skill'
  | never

// ─── AbstractEmbeddingProvider ───────────────────────────────────────────────

export interface SearchChunkResult {
  scope: string
  seq: number
  score: number
  /** 命中 chunk 及其前后文窗口的文本列表（按 seq 升序） */
  chunks: string[]
  config: Record<string, unknown>
}

export interface SearchResult {
  scope: string
  score: number
  content: string
  config: Record<string, unknown>
}

export interface AbstractEmbeddingProvider {
  /**
   * 新增或更新文档向量索引。
   * config 为结构化元数据，搜索时原样返回。
   * 内部自动对 content 分片、计算 MD5，若内容未变则跳过重复 embedding。
   */
  upsert(
    biz: EmbeddingBiz,
    scope: string,
    content: string,
    config?: Record<string, unknown>,
    opts?: { chunkEnable?: boolean }
  ): Promise<void>

  /**
   * 语义检索，返回命中 chunk 及其前后文窗口。
   * scope 支持前缀匹配（例如 "projectId" 可匹配 "projectId:wikiId"）。
   */
  searchChunk(
    biz: EmbeddingBiz,
    query: string,
    opts?: {
      scope?: string
      chunksBefore?: number
      chunksAfter?: number
      topK?: number
    }
  ): Promise<SearchChunkResult[]>

  /**
   * 语义检索，返回完整文档内容及 config。
   * scope 支持前缀匹配。
   */
  search(
    biz: EmbeddingBiz,
    query: string,
    opts?: { scope?: string; topK?: number }
  ): Promise<SearchResult[]>

  /** 删除指定 scope 的文档及其所有分片向量 */
  delete(biz: EmbeddingBiz, scope: string): Promise<void>

  /**
   * 删除所有 scope 前缀匹配的文档（精确匹配 + "prefix:*" 前缀匹配）。
   * 例如 deleteAll('ProjectWiki', '123') 会删除 "123" 及 "123:456" 等所有文档。
   */
  deleteAll(biz: EmbeddingBiz, scopePrefix: string): Promise<void>

  /** 删除整个 biz 的 DB 文件（含其所有文档数据） */
  truncate(biz: EmbeddingBiz): Promise<void>
}
