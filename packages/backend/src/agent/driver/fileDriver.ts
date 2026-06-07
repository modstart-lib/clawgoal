/**
 * File driver abstract class
 * Responsible for reading, searching, writing, and cleaning up task-related files
 */
import { EventEmitter } from 'events'
import pino from 'pino'
import type { AgentExecutor } from '../agentExecutor.js'
import { createAgentLogger } from '../logger.js'

export interface SearchResult {
  line: number
  content: string
  matches: string[]
}

export abstract class AbstractFileDriver extends EventEmitter {
  protected executor: AgentExecutor
  protected logger: pino.Logger

  constructor(executor: AgentExecutor) {
    super()
    this.executor = executor
    this.logger = createAgentLogger(this.executor, 'file')
  }

  /**
   * Read a file (supports reading by line range)
   */
  abstract read(
    filename: string,
    options?: { startLine?: number; endLine?: number }
  ): Promise<string>

  /**
   * Search file content (supports regex)
   * Implemented based on read(), subclasses do not need to override
   */
  async search(
    filename: string,
    pattern: string | RegExp
  ): Promise<SearchResult[]> {
    const content = await this.read(filename)
    const lines = content.split('\n')
    const results: SearchResult[] = []
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern
    lines.forEach((line, index) => {
      const matches = line.match(regex)
      if (matches && matches.length > 0) {
        results.push({
          line: index + 1,
          content: line,
          matches: Array.from(new Set(matches)),
        })
      }
    })
    return results
  }

  /**
   * Write file (supports full overwrite / by line / append), immediately synced to persistence
   */
  abstract write(
    filename: string,
    content: string,
    options?: { startLine?: number; append?: boolean }
  ): Promise<void>

  /**
   * Clear the task cache directory
   */
  abstract cleanup(): Promise<void>

  /**
   * Slice file content by line range
   */
  protected filterLines(
    content: string,
    startLine?: number,
    endLine?: number
  ): string {
    if (startLine === undefined && endLine === undefined) return content
    const lines = content.split('\n')
    const start = (startLine ?? 1) - 1
    const end = endLine ?? lines.length
    return lines.slice(start, end).join('\n')
  }

  /**
   * Merge new content into existing content (full overwrite / by line / append)
   */
  protected mergeContent(
    existingContent: string,
    newContent: string,
    options?: { startLine?: number; append?: boolean }
  ): string {
    if (options?.startLine !== undefined) {
      const lines = existingContent.split('\n')
      const newLines = newContent.split('\n')
      lines.splice(options.startLine - 1, newLines.length, ...newLines)
      return lines.join('\n')
    }
    if (options?.append) {
      return existingContent + newContent
    }
    return newContent
  }
}
