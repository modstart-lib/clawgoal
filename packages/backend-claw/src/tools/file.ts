/**
 * file tool: unified file read/write operations.
 * Supports text files up to a configured max size.
 */

import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import {
  generateTempFile,
  summaryFile,
} from '../../../backend/src/utils/file.js'
import type { ToolDefinition, ToolResult } from '../types/index.js'

const MAX_FILE_SIZE = 256 * 1024 // 256 KB limit

export const fileReadDefinition: ToolDefinition = {
  name: 'file_read',
  description:
    'Read file content from a given path. Use startLine/endLine to read a specific range when the file is large.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path',
      },
      encoding: {
        type: 'string',
        description: 'Encoding (default utf8)',
        enum: ['utf8', 'base64'],
      },
      startLine: {
        type: 'number',
        description: 'Start line number (1-based, default -1 means disabled)',
      },
      endLine: {
        type: 'number',
        description: 'End line number (1-based, default -1 means disabled)',
      },
      maxLimits: {
        type: 'number',
        description:
          'Max characters to return (max 10000). If content exceeds this limit an error is returned, use startLine/endLine to read in parts.',
      },
    },
    required: ['path'],
  },
}

export const fileWriteDefinition: ToolDefinition = {
  name: 'file_write',
  description: 'Write or append content to a file.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path',
      },
      content: {
        type: 'string',
        description: 'Content to write',
      },
      append: {
        type: 'string',
        description: "'true' to append instead of overwrite",
        enum: ['true', 'false'],
      },
    },
    required: ['path', 'content'],
  },
}

export async function fileRead(args: {
  path: string
  encoding?: string
  startLine?: number
  endLine?: number
  maxLimits?: number
}): Promise<ToolResult> {
  try {
    const resolvedPath = path.resolve(args.path)
    const stat = await fs.stat(resolvedPath)

    const startLine = args.startLine ?? -1
    const endLine = args.endLine ?? -1
    const maxLimits =
      args.maxLimits !== undefined ? Math.min(args.maxLimits, 10000) : undefined

    const useLineRange = startLine !== -1 || endLine !== -1

    if (!useLineRange && stat.size > MAX_FILE_SIZE) {
      return {
        success: false,
        output: '',
        error: `File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE} bytes). Use startLine/endLine to read in parts.`,
      }
    }

    const encoding = (args.encoding ?? 'utf8') as BufferEncoding
    let content: string

    if (useLineRange) {
      const raw = await fs.readFile(resolvedPath, { encoding })
      const lines = (raw as string).split('\n')
      const from = startLine !== -1 ? startLine - 1 : 0
      const to = endLine !== -1 ? endLine : lines.length
      content = lines.slice(from, to).join('\n')
    } else {
      content = (await fs.readFile(resolvedPath, { encoding })) as string
    }

    if (maxLimits !== undefined && content.length > maxLimits) {
      return {
        success: false,
        output: '',
        error: `Content length ${content.length} exceeds maxLimits ${maxLimits}. Use startLine/endLine to read in parts.`,
      }
    }

    return { success: true, output: content }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `file_read failed: ${msg}` }
  }
}

export async function fileWrite(args: {
  path: string
  content: string
  append?: string
}): Promise<ToolResult> {
  try {
    const resolvedPath = path.resolve(args.path)
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true })
    const flag = args.append === 'true' ? 'a' : 'w'
    await fs.writeFile(resolvedPath, args.content, { encoding: 'utf8', flag })
    const action = flag === 'a' ? 'appended' : 'written'
    return {
      success: true,
      output: `Successfully ${action} ${args.content.length} characters to ${resolvedPath}`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `file_write failed: ${msg}` }
  }
}

const GREP_MAX_LINES = 50

export const grepDefinition: ToolDefinition = {
  name: 'grep',
  description:
    'Search for a pattern in a file or directory. Results exceeding 50 lines will be summarized with a log file path.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Search pattern (regex or literal string)',
      },
      path: {
        type: 'string',
        description: 'File or directory to search in',
      },
      recursive: {
        type: 'string',
        description: "'true' to search recursively in directory (default true)",
        enum: ['true', 'false'],
      },
      ignoreCase: {
        type: 'string',
        description: "'true' to ignore case (default false)",
        enum: ['true', 'false'],
      },
      include: {
        type: 'string',
        description: "Glob pattern for files to include (e.g. '*.ts')",
      },
    },
    required: ['pattern', 'path'],
  },
}

export async function grepTool(args: {
  pattern: string
  path: string
  recursive?: string
  ignoreCase?: string
  include?: string
}): Promise<ToolResult> {
  try {
    const resolvedPath = path.resolve(args.path)
    const recursive = args.recursive !== 'false'
    const flags = args.ignoreCase === 'true' ? 'i' : ''
    const regex = new RegExp(args.pattern, flags)
    const includeRegex = args.include ? globToRegex(args.include) : null

    const stat = await fs.stat(resolvedPath)
    const files: string[] = []

    if (stat.isFile()) {
      files.push(resolvedPath)
    } else if (stat.isDirectory()) {
      await collectFiles(resolvedPath, recursive, includeRegex, files)
    }

    const results: string[] = []
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${file}:${i + 1}:${lines[i]}`)
          }
        }
      } catch {
        // skip unreadable files
      }
    }

    if (results.length === 0) {
      return { success: true, output: '(no matches)' }
    }

    const output = results.join('\n')

    if (results.length > GREP_MAX_LINES) {
      const logPath = generateTempFile(undefined)
      fsSync.writeFileSync(logPath, output, 'utf8')
      const { display } = await summaryFile(logPath)
      return {
        success: true,
        output: `Results truncated (${results.length} lines). Full log: ${logPath}\n\n${display}`,
      }
    }

    return { success: true, output }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `grep failed: ${msg}` }
  }
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/\?/g, '[^/\\\\]')
  return new RegExp(escaped + '$', 'i')
}

async function collectFiles(
  dir: string,
  recursive: boolean,
  includeRegex: RegExp | null,
  results: string[]
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && recursive) {
      await collectFiles(full, recursive, includeRegex, results)
    } else if (entry.isFile()) {
      if (!includeRegex || includeRegex.test(entry.name)) {
        results.push(full)
      }
    }
  }
}
