/**
 * Claw 文件管理模块
 *
 * 提供文件的写入（fileWrite）、读取（fileRead）、删除（fileDelete）、
 * 查询（fileList / fileGetById / fileGetByPath）等操作。
 *
 * 文件路径规则：
 *   path 格式：file/<year>/<month>/<day>/<random>.<ext>
 *   实际存储：./data/<path>（相对于进程工作目录）
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { resolvePath } from '../../../backend/src/config/env.js'
import { config } from '../../../backend/src/config/index.js'
import { createLogger } from '../kernel/logger.js'
import { clawDb } from '../storage/store/index.js'
import type {
  AddFileInput,
  FileRow,
  UpdateFileInput,
} from '../storage/store/types.js'

const logger = createLogger('claw-file')

/** 文件数据根目录（可通过环境变量覆盖） */

const DATA_ROOT = process.env.CLAW_DATA_ROOT ?? resolvePath('data')

// ─── 路径工具 ─────────────────────────────────────────────────────────────────

/**
 * 根据 path 字段解析出实际文件系统绝对路径。
 * path 示例：file/2026/03/03/abc123.jpg
 */
export function resolveFilePath(filePath: string): string {
  return path.join(DATA_ROOT, filePath)
}

/**
 * 生成文件存储路径。
 * 格式：file/<year>/<month>/<day>/<random>.<ext>
 * @param ext 后缀（小写，可带或不带前缀点，如 "jpg" 或 ".jpg"）
 */
export function generateFilePath(ext: string): string {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const cleanExt = ext.toLowerCase().replace(/^\./, '')
  const random = crypto.randomBytes(12).toString('hex')
  const filename = cleanExt ? `${random}.${cleanExt}` : random
  return `file/${year}/${month}/${day}/${filename}`
}

// ─── 文件写入 ─────────────────────────────────────────────────────────────────

export interface FileWriteOptions {
  /** 原始文件名（用于记录，不影响存储路径） */
  title: string
  /** 文件后缀（小写，不带点），如 "jpg"，为空则无后缀 */
  ext: string
  /** 归属 AI 伙伴 ID */
  agentId?: number
  /** SaaS tenant id */
  tenantId: number
  /** SaaS user id */
  userId: number
}

/**
 * 将二进制数据写入文件系统并在数据库中登记。
 * @returns 新建的 FileRow 记录
 */
export function fileWrite(data: Buffer, options: FileWriteOptions): FileRow {
  const filePath = generateFilePath(options.ext)
  const absPath = resolveFilePath(filePath)

  // 确保目录存在
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  fs.writeFileSync(absPath, data)

  const input: AddFileInput = {
    tenantId: options.tenantId,
    title: options.title,
    path: filePath,
    ext: options.ext.toLowerCase().replace(/^\./, ''),
    size: data.byteLength,
    agentId: options.agentId,
    userId: options.userId,
  }

  const row = clawDb.insertFile(input)
  logger.info(`File written: id=${row.id} path=${filePath} size=${row.size}`)
  return row
}

/**
 * 将字符串内容（UTF-8）写入文件系统并在数据库中登记。
 * @returns 新建的 FileRow 记录
 */
export function fileWriteText(
  content: string,
  options: FileWriteOptions
): FileRow {
  return fileWrite(Buffer.from(content, 'utf-8'), options)
}

// ─── 远程 URL 下载保存 ────────────────────────────────────────────────────────

export interface FileSaveFromUrlOptions {
  /** 覆盖原始文件名（不指定则从 URL 或 Content-Disposition 自动推断） */
  title?: string
  /** 归属 AI 伙伴 ID */
  agentId?: number
  /** SaaS tenant id */
  tenantId: number
  /** SaaS user id */
  userId: number
}

/**
 * 从远程 URL 下载文件并保存到本地，完成数据库登记。
 *
 * 后缀推断顺序：
 *   1. Content-Type 响应头（image/jpeg → jpg 等）
 *   2. URL pathname 结尾的扩展名
 *   3. 无法推断时使用空字符串
 *
 * @param url    远程文件地址
 * @param options 可选参数
 * @returns 新建的 FileRow 记录
 */
export async function fileSaveFileFromUrl(
  url: string,
  options: FileSaveFromUrlOptions
): Promise<FileRow> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`fileSaveFileFromUrl: HTTP ${response.status} for ${url}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const data = Buffer.from(arrayBuffer)

  // ── 推断扩展名 ──
  const contentType = response.headers.get('content-type') ?? ''
  const MIME_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/html': 'html',
    'application/json': 'json',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  }

  let ext = ''
  const mimeBase = contentType.split(';')[0].trim()
  if (MIME_EXT[mimeBase]) {
    ext = MIME_EXT[mimeBase]
  } else {
    // 从 URL 路径末尾推断
    try {
      const urlPath = new URL(url).pathname
      const dotIdx = urlPath.lastIndexOf('.')
      if (dotIdx !== -1) {
        ext = urlPath
          .slice(dotIdx + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      }
    } catch {
      // URL 解析失败，忽略
    }
  }

  // ── 推断文件名 ──
  let title = options.title ?? ''
  if (!title) {
    try {
      const urlPath = new URL(url).pathname
      title = path.basename(urlPath) || `download.${ext || 'bin'}`
    } catch {
      title = `download.${ext || 'bin'}`
    }
  }

  return fileWrite(data, {
    title,
    ext,
    agentId: options.agentId,
    tenantId: options.tenantId,
    userId: options.userId,
  })
}

// ─── 文件读取 ─────────────────────────────────────────────────────────────────

/**
 * 读取文件内容为 Buffer。
 * @param fileId 数据库记录 ID
 */
export function fileRead(fileId: number): Buffer {
  const row = clawDb.findFileById(fileId)
  if (!row) throw new Error(`File not found: id=${fileId}`)
  return fileReadByPath(row.path)
}

/**
 * 读取文件内容为 UTF-8 字符串。
 * @param fileId 数据库记录 ID
 */
export function fileReadText(fileId: number): string {
  return fileRead(fileId).toString('utf-8')
}

/**
 * 通过 path 字段直接读取文件内容为 Buffer。
 * @param filePath 数据库中存储的 path，格式：file/<year>/<month>/<day>/<random>.<ext>
 */
export function fileReadByPath(filePath: string): Buffer {
  const absPath = resolveFilePath(filePath)
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found on disk: ${absPath}`)
  }
  return fs.readFileSync(absPath)
}

/**
 * 通过 path 字段直接读取文件内容为 UTF-8 字符串。
 */
export function fileReadTextByPath(filePath: string): string {
  return fileReadByPath(filePath).toString('utf-8')
}

// ─── 文件删除 ─────────────────────────────────────────────────────────────────

/**
 * 删除文件（同时删除磁盘文件和数据库记录）。
 * @returns `true` 表示成功，`false` 表示记录不存在
 */
export function fileDelete(fileId: number): boolean {
  const row = clawDb.findFileById(fileId)
  if (!row) return false

  const absPath = resolveFilePath(row.path)
  try {
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath)
    }
  } catch (err: unknown) {
    logger.warn(`Failed to delete file on disk: ${absPath} - ${String(err)}`)
  }

  const result = clawDb.deleteFile(fileId)
  if (result) logger.info(`File deleted: id=${fileId} path=${row.path}`)
  return result
}

// ─── 文件查询 ─────────────────────────────────────────────────────────────────

export interface FileListOptions {
  /** 按归属 Agent 过滤 */
  agentId?: number
  /** 按后缀过滤，如 "jpg" */
  ext?: string
  /** 返回数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

/**
 * 列出文件记录（支持按 agentId / ext 过滤）。
 */
export function fileList(
  userId: number = config.supervisorUserId,
  options: FileListOptions = {}
): FileRow[] {
  return clawDb.findAllFiles(config.supervisorTenantId, userId, options)
}

/**
 * 根据 ID 获取文件记录。
 */
export function fileGetById(id: number): FileRow | undefined {
  return clawDb.findFileById(id)
}

/**
 * 根据 path 获取文件记录。
 */
export function fileGetByPath(filePath: string): FileRow | undefined {
  return clawDb.findFileByPath(filePath)
}

/**
 * 更新文件元信息（标题、agentId 等）。
 */
export function fileUpdate(id: number, input: UpdateFileInput): void {
  clawDb.updateFile(id, input)
}

/**
 * 获取文件的绝对路径（不校验文件是否存在）。
 */
export function fileAbsPath(fileId: number): string {
  const row = clawDb.findFileById(fileId)
  if (!row) throw new Error(`File not found: id=${fileId}`)
  return resolveFilePath(row.path)
}
