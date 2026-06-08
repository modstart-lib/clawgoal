/**
 * General utility functions
 */
import fs from 'node:fs'
import net from 'node:net'
import path from 'path'
import { toConfigLocalTime } from './time'
import { AppConfig } from '../config.js'

export function getUserAgent(): string {
  return `ClawGoal/${AppConfig.version}`
}

/**
 * 在项目根目录 _temp/ 下生成临时文件路径，自动确保目录存在。
 * 文件名格式：_temp/<prefix>_YYYYMMDD_HHMMSS_<random>.<ext>
 * @param ext 文件扩展名（不含 .）
 * @param prefix 文件名前缀，默认 'file'
 * @returns 绝对路径
 */
export function generateTempFile(ext: string, prefix = 'file'): string {
  const dir = path.resolve('./_temp')
  fs.mkdirSync(dir, { recursive: true })
  const now = new Date()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const ts =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const rand = Math.random().toString(36).slice(2, 8)
  return path.join(dir, `${prefix}_${ts}_${rand}.${ext}`)
}

/**
 * Generate a random string
 */
export function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate file path: YYYY/mm/dd/HH/ii/ss_<random_string_12>.ext
 */
export function generateFilePath(originalName: string): string {
  const now = toConfigLocalTime()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  const hour = String(now.getUTCHours()).padStart(2, '0')
  const minute = String(now.getUTCMinutes()).padStart(2, '0')
  const second = String(now.getUTCSeconds()).padStart(2, '0')
  const randomStr = generateRandomString(12)
  const ext = path.extname(originalName)
  return `${year}/${month}/${day}/${hour}/${minute}/${second}_${randomStr}${ext}`
}

/**
 * Deep merge two plain objects recursively.
 * Nested objects are merged; arrays and primitives are overwritten.
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target }
  for (const key of Object.keys(source)) {
    const sv = source[key]
    const tv = target[key]
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>
      )
    } else {
      result[key] = sv
    }
  }
  return result
}

/**
 * Generate a unique ID
 * Format: timestamp_random (e.g., 1771038774975_a1b2c3d4e)
 * @returns Unique ID string
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Split a long text into chunks that fit within the given length limit.
 * Attempts to split at newline boundaries to preserve readability.
 */
export function splitMarkdown(text: string, maxLen = 4096): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, maxLen)
    const splitAt = chunk.lastIndexOf('\n')
    if (splitAt > maxLen / 2) {
      chunks.push(remaining.slice(0, splitAt))
      remaining = remaining.slice(splitAt + 1)
    } else {
      chunks.push(chunk)
      remaining = remaining.slice(maxLen)
    }
  }
  return chunks
}

/** Strip HTML tags from a string */
export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

/**
 * Convert an HTML string to Markdown.
 * Handles headings, bold, italic, code, links, lists and paragraphs.
 * Also strips script/style/nav/footer/header/aside blocks.
 */
export function htmlToMarkdown(html: string): string {
  let md = html
  // Remove non-content blocks
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '')
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '')
  md = md.replace(/<head[\s\S]*?<\/head>/gi, '')
  md = md.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  md = md.replace(/<footer[\s\S]*?<\/footer>/gi, '')
  md = md.replace(/<header[\s\S]*?<\/header>/gi, '')
  md = md.replace(/<aside[\s\S]*?<\/aside>/gi, '')
  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')
  // Inline formatting
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**')
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*')
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
  // Links: strip inner tags from anchor text, skip empty/whitespace-only anchors
  md = md.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => {
      const cleanText = text
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      return cleanText ? `[${cleanText}](${href})` : ''
    }
  )
  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
  md = md.replace(/<(ul|ol)[^>]*>([\s\S]*?)<\/(ul|ol)>/gi, '\n$2\n')
  // Code blocks
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
  // Blockquote
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n')
  // Line breaks and block elements
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '\n$1\n')
  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '')
  // Decode HTML entities
  md = md.replace(/&amp;/g, '&')
  md = md.replace(/&lt;/g, '<')
  md = md.replace(/&gt;/g, '>')
  md = md.replace(/&quot;/g, '"')
  md = md.replace(/&#39;/g, "'")
  md = md.replace(/&nbsp;/g, ' ')
  // Normalize horizontal whitespace
  md = md.replace(/[ \t]+/g, ' ')
  // Clear lines that contain only spaces/tabs (turn them into truly empty lines)
  md = md.replace(/^[ \t]+$/gm, '')
  // Collapse 3+ consecutive blank lines to at most 2
  md = md.replace(/\n{3,}/g, '\n\n')
  return md.trim()
}

/**
 * Extract title from HTML (from <title> tag) and convert body to Markdown.
 * Returns { title, markdown }.
 */
export function htmlToMarkdownWithTitle(html: string): {
  title: string
  markdown: string
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const rawTitle = titleMatch ? titleMatch[1] : ''
  const title = rawTitle
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
  const markdown = htmlToMarkdown(html)
  return { title, markdown }
}

/** Escape HTML special characters */
function _escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Convert a JSON value to a human-readable Telegram HTML representation.
 *
 * Arrays are listed with [n] indices; objects are shown as key: value pairs.
 * Nested structures are indented. Long strings are truncated at 300 chars.
 * Returns an HTML string safe to embed directly in a Telegram HTML message.
 */
export function convertJSONToMarkdownView(value: unknown, depth = 0): string {
  const pad = '  '.repeat(depth + 1)
  const MAX_STR = 300

  const fmtScalar = (v: unknown): string => {
    const s = String(v)
    const truncated = s.length > MAX_STR ? s.slice(0, MAX_STR) + '…' : s
    return _escHtml(truncated)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}<code>[]</code>`
    return value
      .map((item, i) => {
        if (typeof item === 'object' && item !== null) {
          return `${pad}<code>[${i}]</code>\n${convertJSONToMarkdownView(item, depth + 1)}`
        }
        return `${pad}<code>[${i}]</code> ${fmtScalar(item)}`
      })
      .join('\n')
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .map(([k, v]) => {
        const keyHtml = `${pad}<code>${_escHtml(k)}</code>`
        if (typeof v === 'object' && v !== null) {
          return `${keyHtml}:\n${convertJSONToMarkdownView(v, depth + 1)}`
        }
        return `${keyHtml}: ${fmtScalar(v)}`
      })
      .join('\n')
  }

  return `${pad}${fmtScalar(value)}`
}

/**
 * Find the first available TCP port starting from startPort.
 */
export function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(startPort, () => {
      const { port } = server.address() as net.AddressInfo
      server.close(() => resolve(port))
    })
    server.on('error', () => resolve(findAvailablePort(startPort + 1)))
  })
}
