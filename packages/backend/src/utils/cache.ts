/**
 * File-based persistent cache.
 * Data is stored at: <dataPath>/cache/<key>.json
 */

import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config'
import { createNamedLogger } from './logger'

const logger = createNamedLogger('cache')

function getCacheDir(): string {
  return path.join(config.dataPath, 'cache')
}

function getCachePath(key: string): string {
  // sanitize key to safe filename (colons and other special chars replaced with _)
  const safe = key.replace(/[^a-zA-Z0-9_\-.]/g, '_')
  return path.join(getCacheDir(), `${safe}.json`)
}

function ensureCacheDir(): void {
  const dir = getCacheDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function cacheSet<T>(key: string, value: T): void {
  try {
    ensureCacheDir()
    fs.writeFileSync(getCachePath(key), JSON.stringify(value), 'utf-8')
  } catch (err) {
    logger.warn({ key, err }, 'cache.set failed')
  }
}

export function cacheGet<T>(key: string): T | undefined {
  try {
    const filePath = getCachePath(key)
    if (!fs.existsSync(filePath)) return undefined
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err) {
    logger.warn({ key, err }, 'cache.get failed')
    return undefined
  }
}

/**
 * Returns cached value if present, otherwise calls `fn` to compute,
 * stores the result, and returns it.
 */
export async function cacheRemember<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = cacheGet<T>(key)
  if (existing !== undefined) return existing
  const value = await fn()
  cacheSet(key, value)
  return value
}

export function cacheDelete(key: string): void {
  try {
    const filePath = getCachePath(key)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (err) {
    logger.warn({ key, err }, 'cache.delete failed')
  }
}
