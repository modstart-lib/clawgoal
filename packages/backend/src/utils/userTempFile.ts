import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { resolvePath } from '../config/env.js'
import { userTempFileDb } from '../storage/store/userTempFile.js'

function randomPath(n: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.randomBytes(n))
    .map((b) => chars[b % chars.length])
    .join('')
}

function inferExt(filePath: string): string {
  const ext = path.extname(filePath)
  return ext ? ext.slice(1).toLowerCase() : 'bin'
}

/**
 * 从本地文件创建临时访问链接
 * @returns 访问链接，如 /api/user_temp_file/abc123.json
 */
export async function userTempFileFromFile(
  localPath: string,
  expire: number = 86400,
  pathKey?: string | null,
  ext?: string | null
): Promise<string> {
  const resolvedPath = pathKey ?? randomPath(6)
  const resolvedExt = ext ?? inferExt(localPath)
  const expireAt = new Date(Date.now() + expire * 1000)
  await userTempFileDb.create({
    tenantId: 1,
    userId: 0,
    path: resolvedPath,
    ext: resolvedExt,
    localPath,
    expireAt,
  })
  return `/api/user_temp_file/${resolvedPath}.${resolvedExt}`
}

/**
 * 从字符串内容创建临时访问链接（写入临时文件）
 * @returns 访问链接，如 /api/user_temp_file/abc123.txt
 */
export async function userTempFileFromContent(
  content: string,
  expire: number = 86400,
  pathKey?: string | null,
  ext: string = 'txt'
): Promise<string> {
  const resolvedPath = pathKey ?? randomPath(6)
  const resolvedExt = ext ?? 'txt'
  const tmpDir = resolvePath('data/tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  const tmpFile = path.join(tmpDir, `${resolvedPath}.${resolvedExt}`)
  fs.writeFileSync(tmpFile, content, 'utf8')
  const expireAt = new Date(Date.now() + expire * 1000)
  await userTempFileDb.create({
    tenantId: 1,
    userId: 0,
    path: resolvedPath,
    ext: resolvedExt,
    localPath: tmpFile,
    expireAt,
  })
  return `/api/user_temp_file/${resolvedPath}.${resolvedExt}`
}
