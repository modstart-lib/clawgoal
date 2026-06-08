import crypto from 'node:crypto'
import { config as appConfig } from '../../config/index.js'
import { getChunkProvider } from '../chunk/defaultChunkProvider.js'
import {
  deleteEmbeddingDb,
  getEmbeddingDb,
} from '../../storage/sqlite/store/chunk.js'
import { createNamedLogger } from '../../utils/logger.js'
import { jsonParse, jsonStringify } from '../../utils/json.js'
import {
  AbstractEmbeddingProvider,
  createEmbedder,
  EmbeddingBiz,
  EmbeddingModelConfig,
  IEmbedder,
  SearchChunkResult,
  SearchResult,
} from './embeddingProvider.js'

const logger = createNamedLogger('model_embedding_sqlite-vec')

function md5(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex')
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0,
    normA = 0,
    normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function toFloat32Array(buf: Uint8Array): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
}

// ─── SQLiteVec implementation ─────────────────────────────────────────────────

export class SqliteVecEmbeddingProvider implements AbstractEmbeddingProvider {
  constructor(private readonly embedder: IEmbedder) {}

  private getDb(biz: EmbeddingBiz) {
    return getEmbeddingDb(biz)
  }

  async upsert(
    biz: EmbeddingBiz,
    scope: string,
    content: string,
    config: Record<string, unknown> = {},
    opts: { chunkEnable?: boolean } = {}
  ): Promise<void> {
    const { chunkEnable = true } = opts
    const db = this.getDb(biz)
    const hash = md5(content)

    const existing = db
      .prepare('SELECT content_md5 FROM data WHERE scope=?')
      .get(scope) as {
      content_md5: string
    } | null
    if (existing?.content_md5 === hash) {
      logger.debug(`Skipping re-embed for ${biz}/${scope} (content unchanged)`)
      return
    }

    logger.info(
      { biz, scope, contentLength: content.length, chunkEnable },
      'Embedding upsert request'
    )

    const rawChunks = chunkEnable ? await getChunkProvider().chunk(content) : []
    const texts =
      rawChunks.length > 0 ? rawChunks.map((c) => c.text) : [content]
    const vecs = await this.embedder.embedBatch(texts)
    const configJson = jsonStringify(config)

    db.transaction(() => {
      db.prepare(
        `INSERT INTO data (scope, content_md5, content, config) VALUES (?,?,?,?)
                 ON CONFLICT(scope) DO UPDATE SET content_md5=excluded.content_md5, content=excluded.content, config=excluded.config, updated_at=datetime('now','localtime')`
      ).run(scope, hash, content, configJson)

      db.prepare('DELETE FROM data_chunk WHERE scope=?').run(scope)

      const insertChunk = db.prepare(
        'INSERT INTO data_chunk (scope, seq, content, embedding) VALUES (?,?,?,?)'
      )
      for (let i = 0; i < texts.length; i++) {
        const vec = vecs[i]!
        const buf = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength)
        insertChunk.run(scope, i, texts[i], buf)
      }
    })()

    logger.info(
      { biz, scope, chunks: texts.length },
      'Embedding upsert complete'
    )
  }

  async searchChunk(
    biz: EmbeddingBiz,
    query: string,
    opts: {
      scope?: string
      chunksBefore?: number
      chunksAfter?: number
      topK?: number
    } = {}
  ): Promise<SearchChunkResult[]> {
    const { scope, chunksBefore = 1, chunksAfter = 1, topK = 5 } = opts
    const db = this.getDb(biz)
    logger.info(
      { biz, query: query.slice(0, 80), scope, topK },
      'Embedding searchChunk request'
    )
    const queryVec = await this.embedder.embed(query)

    type ChunkRow = {
      scope: string
      seq: number
      content: string
      embedding: Uint8Array
    }
    let rows: ChunkRow[]
    if (scope) {
      rows = db
        .prepare(
          'SELECT scope, seq, content, embedding FROM data_chunk WHERE scope=? OR scope GLOB ?'
        )
        .all(scope, `${scope}:*`) as ChunkRow[]
    } else {
      rows = db
        .prepare('SELECT scope, seq, content, embedding FROM data_chunk')
        .all() as ChunkRow[]
    }

    const scored = rows
      .map((r) => ({
        scope: r.scope,
        seq: r.seq,
        score: cosineSimilarity(queryVec, toFloat32Array(r.embedding)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    logger.info(
      { biz, hits: scored.length, topScore: scored[0]?.score },
      'Embedding searchChunk complete'
    )
    const results = scored.map((hit) => {
      const startSeq = Math.max(0, hit.seq - chunksBefore)
      const endSeq = hit.seq + chunksAfter
      const ctxRows = db
        .prepare(
          'SELECT content FROM data_chunk WHERE scope=? AND seq>=? AND seq<=? ORDER BY seq ASC'
        )
        .all(hit.scope, startSeq, endSeq) as Array<{ content: string }>
      const dataRow = db
        .prepare('SELECT config FROM data WHERE scope=?')
        .get(hit.scope) as { config: string } | null
      return {
        scope: hit.scope,
        seq: hit.seq,
        score: hit.score,
        chunks: ctxRows.map((c) => c.content),
        config: dataRow
          ? (jsonParse(dataRow.config) as Record<string, unknown>)
          : {},
      }
    })
    logger.debug(
      {
        biz,
        query,
        results: results.map((r) => ({
          scope: r.scope,
          score: r.score.toFixed(4),
          snippet: r.chunks.join(' ').slice(0, 200),
        })),
      },
      'Embedding searchChunk results'
    )
    return results
  }

  async search(
    biz: EmbeddingBiz,
    query: string,
    opts: { scope?: string; topK?: number } = {}
  ): Promise<SearchResult[]> {
    const { scope, topK = 5 } = opts
    const db = this.getDb(biz)
    logger.info(
      { biz, query: query.slice(0, 80), scope, topK },
      'Embedding search request'
    )
    const queryVec = await this.embedder.embed(query)

    type ChunkRow = { scope: string; embedding: Uint8Array }
    let rows: ChunkRow[]
    if (scope) {
      rows = db
        .prepare(
          'SELECT scope, embedding FROM data_chunk WHERE scope=? OR scope GLOB ?'
        )
        .all(scope, `${scope}:*`) as ChunkRow[]
    } else {
      rows = db
        .prepare('SELECT scope, embedding FROM data_chunk')
        .all() as ChunkRow[]
    }

    // 每个文档保留最高分 chunk
    const docScores = new Map<string, number>()
    for (const r of rows) {
      const score = cosineSimilarity(queryVec, toFloat32Array(r.embedding))
      if (score > (docScores.get(r.scope) ?? -1)) docScores.set(r.scope, score)
    }

    const topDocs = Array.from(docScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)

    logger.info(
      { biz, hits: topDocs.length, topScore: topDocs[0]?.[1] },
      'Embedding search complete'
    )
    const results = topDocs.map(([docScope, score]) => {
      const dataRow = db
        .prepare('SELECT content, config FROM data WHERE scope=?')
        .get(docScope) as {
        content: string
        config: string
      } | null
      return {
        scope: docScope,
        score,
        content: dataRow?.content ?? '',
        config: dataRow
          ? (jsonParse(dataRow.config) as Record<string, unknown>)
          : {},
      }
    })
    logger.debug(
      {
        biz,
        query,
        results: results.map((r) => ({
          scope: r.scope,
          score: r.score.toFixed(4),
          snippet: r.content.slice(0, 200),
        })),
      },
      'Embedding search results'
    )
    return results
  }

  async delete(biz: EmbeddingBiz, scope: string): Promise<void> {
    const db = this.getDb(biz)
    db.prepare('DELETE FROM data WHERE scope=?').run(scope)
  }

  async deleteAll(biz: EmbeddingBiz, scopePrefix: string): Promise<void> {
    const db = this.getDb(biz)
    db.prepare('DELETE FROM data WHERE scope=? OR scope GLOB ?').run(
      scopePrefix,
      `${scopePrefix}:*`
    )
  }

  async truncate(biz: EmbeddingBiz): Promise<void> {
    deleteEmbeddingDb(biz)
    logger.debug(`Embedding DB file deleted for biz: ${biz}`)
  }
}

// ─── Shared singleton ─────────────────────────────────────────────────────────

let _provider: AbstractEmbeddingProvider | null = null

export function getEmbeddingProvider(): AbstractEmbeddingProvider {
  if (_provider) return _provider

  const embCfg = appConfig.embeddingModel ?? { type: 'default' as const }
  const embedder = createEmbedder({
    name: 'embedding-provider',
    type: (embCfg as EmbeddingModelConfig).type,
    apiKey: (embCfg as EmbeddingModelConfig).apiKey,
    apiBase: (embCfg as EmbeddingModelConfig).apiBase,
    model: (embCfg as EmbeddingModelConfig).model,
  })

  _provider = new SqliteVecEmbeddingProvider(embedder)
  return _provider
}

/** （测试/重置用）清除缓存的 provider 单例 */
export function resetEmbeddingProvider(): void {
  _provider = null
}
