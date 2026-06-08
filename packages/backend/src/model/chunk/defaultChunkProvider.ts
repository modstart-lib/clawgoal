import crypto from 'node:crypto'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import type { IChunkProvider, TextChunk } from './chunkProvider.js'

function approxTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).length * 1.3)
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

export class DefaultChunkProvider implements IChunkProvider {
  private splitter: RecursiveCharacterTextSplitter

  constructor(options: { targetTokens?: number; overlapTokens?: number } = {}) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.targetTokens ?? 400,
      chunkOverlap: options.overlapTokens ?? 80,
      lengthFunction: approxTokens,
    })
  }

  async chunk(content: string): Promise<TextChunk[]> {
    const parts = await this.splitter.splitText(content)
    const result: TextChunk[] = []
    let searchFrom = 0

    for (const part of parts) {
      const text = part.trim()
      if (!text) continue

      const pos = content.indexOf(part, searchFrom)
      if (pos !== -1) {
        const startLine = content.slice(0, pos).split('\n').length
        const endLine = content.slice(0, pos + part.length).split('\n').length
        result.push({ startLine, endLine, text, hash: sha256(text) })
        searchFrom = pos
      } else {
        result.push({
          startLine: 1,
          endLine: text.split('\n').length,
          text,
          hash: sha256(text),
        })
      }
    }

    return result
  }
}

let _provider: IChunkProvider | null = null

/**
 * 获取默认 chunk provider 单例（targetTokens=400, overlapTokens=80）。
 */
export function getChunkProvider(): IChunkProvider {
  if (!_provider) _provider = new DefaultChunkProvider()
  return _provider
}
