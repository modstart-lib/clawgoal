/**
 * Logging utility
 * Implements logging with Pino, supporting log rotation and automatic cleanup
 */
import fs from 'fs'
import path from 'path'
import pino from 'pino'
import pinoPretty from 'pino-pretty'
import { createStream } from 'rotating-file-stream'
import { config } from '../config'
import { toConfigLocalTime } from './time'

function tryGetLogDir(): string | null {
  try {
    const logPath = path.join(config.dataPath, 'logs')
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true })
    }
    return logPath
  } catch {
    return null
  }
}

export let logDir: string | null = tryGetLogDir()

function makeLogFilename(prefix: string) {
  return (time: Date | number | null, _index?: number): string => {
    const rawDate =
      time instanceof Date ? time : time ? new Date(time) : new Date()
    const date = toConfigLocalTime(rawDate)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${prefix}-${year}${month}${day}.log`
  }
}

function makeFileStream(prefix: string, dir: string) {
  return createStream(makeLogFilename(prefix), {
    interval: '1d',
    maxSize: '10M',
    maxFiles: 30,
    compress: 'gzip',
    path: dir,
  })
}

const isDev = process.env.NODE_ENV === 'development'

function isDebugEnabled(): boolean {
  try {
    return config.debug === true
  } catch {
    return false
  }
}

function buildPrettyOptions() {
  return {
    colorize: isDev || process.stdout.isTTY,
    translateTime: 'yyyy-mm-dd HH:MM:ss',
    ignore: 'pid,hostname',
    singleLine: true,
    errorLikeObjectKeys: [] as string[],
  }
}

// 共享的控制台 pretty 流（全程只创建一份，避免多个 named logger 各自分配）
let _sharedPrettyStream = pinoPretty(buildPrettyOptions())

function buildLogger(filePrefix: string, dir: string | null): pino.Logger {
  const level = isDev || isDebugEnabled() ? 'debug' : 'info'
  const streams: pino.StreamEntry[] = [{ level, stream: _sharedPrettyStream }]
  if (dir) {
    streams.push({ level, stream: makeFileStream(filePrefix, dir) })
  }
  // errorKey 设为 'pinoErr'：防止 pino-pretty 在收到 PINO_CONFIG 时将默认的 'err' 追加
  // 到 errorLikeObjectKeys，导致 err 字段以多行渲染。
  return pino(
    { level, timestamp: pino.stdTimeFunctions.isoTime, errorKey: 'pinoErr' },
    pino.multistream(streams)
  )
}

let _loggerInstance = buildLogger('app', logDir)

export const logger = new Proxy({} as pino.Logger, {
  get(_, key) {
    return _loggerInstance[key as keyof pino.Logger]
  },
})

// ─── TTL 缓存：支持自动释放的 logger 池 ────────────────────────────────────

export function getLogDateStr(): string {
  const d = toConfigLocalTime(new Date())
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}${m}${day}`
}

const IDLE_TTL_MS = 30 * 60 * 1000

interface CachedEntry {
  logger: pino.Logger
  destroy: () => void
  lastUsed: number
}

const _loggerCache = new Map<string, CachedEntry>()

function _doRelease(key: string, entry: CachedEntry): void {
  try {
    entry.destroy()
  } catch {
    /* ignore */
  }
  _loggerCache.delete(key)
}

function _cleanup(): void {
  const now = Date.now()
  for (const [key, entry] of _loggerCache) {
    if (now - entry.lastUsed > IDLE_TTL_MS) _doRelease(key, entry)
  }
}

const _cleanupTimer = setInterval(_cleanup, 10 * 60 * 1000)
_cleanupTimer.unref()

/**
 * 创建或复用一个写入指定文件路径的缓存 logger，30分钟无使用则自动释放文件流。
 * key 由调用方保证全局唯一（建议包含 agent/id/sessionId/日期等维度）。
 */
export function createCachedFileLogger(
  key: string,
  filePath: string
): pino.Logger {
  const existing = _loggerCache.get(key)
  if (existing) {
    existing.lastUsed = Date.now()
    return existing.logger
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const fileStream = fs.createWriteStream(filePath, { flags: 'a' })
  const level = isDev ? 'debug' : 'info'
  const instance = pino(
    { level, timestamp: pino.stdTimeFunctions.isoTime, errorKey: 'pinoErr' },
    pino.multistream([
      { level, stream: _sharedPrettyStream },
      { level, stream: fileStream },
    ])
  )
  _loggerCache.set(key, {
    logger: instance,
    destroy: () => fileStream.destroy(),
    lastUsed: Date.now(),
  })
  return instance
}

/**
 * 手动释放指定 key 的缓存 logger。
 */
export function releaseCachedFileLogger(key: string): void {
  const entry = _loggerCache.get(key)
  if (entry) _doRelease(key, entry)
}

/**
 * 释放所有缓存 logger（服务关闭时调用）。
 */
export function releaseAllCachedFileLoggers(): void {
  for (const [key, entry] of _loggerCache) _doRelease(key, entry)
}

// ─── 命名 logger（复用 TTL 缓存，使用 rotating-file-stream）───────────────

export function reinitLogger(): void {
  const newDir = tryGetLogDir()
  if (newDir === logDir) return
  logDir = newDir
  // 仅释放命名 logger（key 以 'named:' 开头），不干扰外部的 file logger
  for (const [key, entry] of _loggerCache) {
    if (key.startsWith('named:')) _doRelease(key, entry)
  }
  _sharedPrettyStream = pinoPretty(buildPrettyOptions())
  _loggerInstance = buildLogger('app', logDir)
}

/**
 * 返回拥有独立日志文件的命名 logger（rotating-file-stream，按日切割）。
 * 控制台输出复用共享 prettyStream，30分钟无使用自动释放。
 */
export function createNamedLogger(name: string): pino.Logger {
  const key = `named:${name}`
  const existing = _loggerCache.get(key)
  if (existing) {
    existing.lastUsed = Date.now()
    return existing.logger
  }
  const level = isDev ? 'debug' : 'info'
  const streams: pino.StreamEntry[] = [{ level, stream: _sharedPrettyStream }]
  let destroyFn = () => {}
  if (logDir) {
    const rotatingStream = makeFileStream(name, logDir)
    streams.push({ level, stream: rotatingStream })
    destroyFn = () => {
      try {
        rotatingStream.destroy()
      } catch {}
    }
  }
  const instance = pino(
    { level, timestamp: pino.stdTimeFunctions.isoTime, errorKey: 'pinoErr' },
    pino.multistream(streams)
  )
  _loggerCache.set(key, {
    logger: instance,
    destroy: destroyFn,
    lastUsed: Date.now(),
  })
  return instance
}

/**
 * 生成日志文件路径：config.logPath/<scope>/YYYYMMDDHHmmss_random.log
 * 目录不存在时自动创建。
 */
export function generateTempLogPath(scope: string = 'default'): string {
  const dir = path.join(config.logPath, scope)
  fs.mkdirSync(dir, { recursive: true })
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const rand = Math.random().toString(36).slice(2, 8)
  return path.join(dir, `${ts}_${rand}.log`)
}
