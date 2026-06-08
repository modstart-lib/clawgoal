import fs from 'fs'
import path from 'path'
import { createInterface } from 'readline'
import { config } from '../config'
import { getUserAgent } from './utils'

const TEXT_EXTS = new Set([
  'txt',
  'log',
  'md',
  'json',
  'yaml',
  'yml',
  'toml',
  'ini',
  'csv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'html',
  'htm',
  'css',
  'sh',
  'bash',
  'zsh',
  'py',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'h',
  'xml',
  'sql',
  'env',
  'conf',
  'config',
])

export interface SummaryFileOptions {
  maxLines?: number
  headLines?: number
  tailLines?: number
  maxLineChars?: number
  lineHeadChars?: number
  lineTailChars?: number
}

export interface SummaryFileResult {
  display: string
  isTruncated: boolean
  totalLines: number
  isText: boolean
}

function _gcTempDir(dir: string): void {
  try {
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file)
      try {
        const stat = fs.statSync(filePath)
        if (stat.isFile() && stat.mtimeMs < oneYearAgo) fs.unlinkSync(filePath)
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function _tempFilePath(dir: string, ext: string): string {
  const now = new Date()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const ts =
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}` +
    `${pad(now.getSeconds())}`
  const rand = Math.random().toString(36).slice(2, 8)
  return path.join(dir, `${ts}_${rand}.${ext}`)
}

/**
 * 在指定目录（默认 dataPath/tmp）生成临时文件路径，自动创建目录并 GC 超 1 年的旧文件。
 * 文件名格式：YYYYMMDDHHMMSS_随机数.ext
 */
export function generateTempFile(dir?: string, ext = 'txt'): string {
  const targetDir = dir ?? path.join(config.dataPath, 'tmp')
  fs.mkdirSync(targetDir, { recursive: true })
  _gcTempDir(targetDir)
  return _tempFilePath(targetDir, ext)
}

/**
 * 生成临时文件路径并返回可写流。
 */
export function generateTempFileStream(
  dir?: string,
  ext = 'txt'
): { filePath: string; stream: ReturnType<typeof fs.createWriteStream> } {
  const filePath = generateTempFile(dir, ext)
  return { filePath, stream: fs.createWriteStream(filePath) }
}

/**
 * 对文件生成摘要：
 * - 文本文件：流式读取，超行折叠 + 超长行截断
 * - 二进制/未知文件：返回路径和大小
 */
export async function summaryFile(
  filePath: string,
  options: SummaryFileOptions = {}
): Promise<SummaryFileResult> {
  const ext = path.extname(filePath).replace(/^\./, '').toLowerCase()
  const isText = TEXT_EXTS.has(ext)

  if (!isText) {
    try {
      const stat = fs.statSync(filePath)
      const size = stat.size
      const sizeStr =
        size >= 1024 * 1024
          ? `${(size / 1024 / 1024).toFixed(2)} MB`
          : size >= 1024
            ? `${(size / 1024).toFixed(2)} KB`
            : `${size} B`
      return {
        display: `[binary file] ${filePath} (${sizeStr})`,
        isTruncated: false,
        totalLines: 0,
        isText: false,
      }
    } catch {
      return {
        display: `[file] ${filePath}`,
        isTruncated: false,
        totalLines: 0,
        isText: false,
      }
    }
  }

  const {
    maxLines = 20,
    headLines = 10,
    tailLines = 10,
    maxLineChars = 1000,
    lineHeadChars = 500,
    lineTailChars = 500,
  } = options

  const truncate = (line: string): string => {
    if (line.length <= maxLineChars) return line
    return `${line.slice(0, lineHeadChars)}...(${line.length}chars)...${line.slice(line.length - lineTailChars)}`
  }

  const rl = createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  })

  const firstLines: string[] = []
  const lastBuf: string[] = []
  let totalLines = 0

  for await (const line of rl) {
    totalLines++
    if (firstLines.length < maxLines) firstLines.push(line)
    lastBuf.push(line)
    if (lastBuf.length > tailLines) lastBuf.shift()
  }

  if (totalLines === 0) {
    return {
      display: '(no output)',
      isTruncated: false,
      totalLines: 0,
      isText: true,
    }
  }

  if (totalLines <= maxLines) {
    return {
      display: firstLines.map(truncate).join('\n'),
      isTruncated: false,
      totalLines,
      isText: true,
    }
  }

  const folded = totalLines - headLines - tailLines
  const display = [
    ...firstLines.slice(0, headLines).map(truncate),
    `... (${folded} lines omitted) ...`,
    ...lastBuf.map(truncate),
  ].join('\n')
  return { display, isTruncated: true, totalLines, isText: true }
}

function sniffImageMime(bytes: Uint8Array | Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'image/png'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
    return 'image/gif'
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  )
    return 'image/webp'
  return 'image/jpeg'
}

/**
 * 将图片来源（data: URI 或远程 HTTP URL）统一转换为正确 MIME 的 data URI。
 * - data: URI：检测 MIME 是否正确，若为 application/octet-stream 或非 image/* 则通过魔数修正
 * - HTTP URL：下载后通过魔数识别 MIME，转为 base64 data URI
 * 返回 null 表示无需转换或失败。
 */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) {
    const mimeMatch = url.match(/^data:([^;]+);base64,/)
    if (
      !mimeMatch ||
      (mimeMatch[1] !== 'application/octet-stream' &&
        mimeMatch[1].startsWith('image/'))
    ) {
      return null
    }
    const b64Data = url.slice(url.indexOf(',') + 1)
    const bytes = Buffer.from(b64Data, 'base64')
    const mime = sniffImageMime(bytes)
    return `data:${mime};base64,${b64Data}`
  }
  if (url.startsWith('http')) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': getUserAgent() },
        signal: AbortSignal.timeout(15000),
      })
      let contentType = (res.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
      const buffer = await res.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      if (
        !contentType.startsWith('image/') ||
        contentType === 'application/octet-stream'
      ) {
        contentType = sniffImageMime(bytes)
      }
      const b64 = Buffer.from(buffer).toString('base64')
      return `data:${contentType};base64,${b64}`
    } catch {
      return null
    }
  }
  return null
}
