export interface TextChunk {
  /** 1-based start line (inclusive) */
  startLine: number
  /** 1-based end line (inclusive) */
  endLine: number
  /** Raw text of this chunk */
  text: string
  /** SHA-256 hex of text */
  hash: string
}

export interface IChunkProvider {
  chunk(content: string): Promise<TextChunk[]>
}
