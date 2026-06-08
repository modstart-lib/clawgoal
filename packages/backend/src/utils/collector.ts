/**
 * Usage data collector.
 *
 * Batches analytics events and periodically forwards them to the remote
 * collection endpoint (AppConfig.analyticsUrl).
 *
 * Frontend → POST /api/collect { name, data } → collector queue → batch POST → remote analytics server
 *
 * The remote server receives the full payload including uuid, version, platform info:
 *   POST {analyticsUrl}
 *   Body: { uuid, version, platform: { name, arch, version }, data: [{ name, data }] }
 */
import { logger } from './logger.js'
import { AppConfig } from '../config.js'
import { getPlatformInfo, getDeviceUUID, buildUserAgent } from './platform.js'

const COLLECTOR_URL = AppConfig.analyticsUrl
const APP_VERSION = AppConfig.version
const FLUSH_DELAY_MS = 10_000
const MAX_QUEUE_SIZE = 20

interface CollectDataItem {
  name: string
  data: unknown
}

const queue: CollectDataItem[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush(): void {
  if (flushTimer !== null) return
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS)
}

async function flush(): Promise<void> {
  flushTimer = null
  if (queue.length === 0) return

  const items = queue.splice(0)
  try {
    const response = await fetch(COLLECTOR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': buildUserAgent(),
      },
      body: JSON.stringify({
        uuid: getDeviceUUID(),
        version: APP_VERSION,
        platform: getPlatformInfo(),
        data: items,
      }),
    })

    if (!response.ok) {
      logger.warn({ status: response.status }, 'collector: flush failed')
    }
  } catch (err) {
    logger.warn({ err }, 'collector: flush error')
  }
}

/**
 * Enqueue a data item for batch collection.
 * Flushes immediately when the queue reaches MAX_QUEUE_SIZE.
 */
export function collectData(name: string, data: unknown): void {
  try {
    queue.push({ name, data })

    if (queue.length >= MAX_QUEUE_SIZE) {
      if (flushTimer !== null) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      flush()
    } else {
      scheduleFlush()
    }
  } catch {
    // Swallow to avoid interference
  }
}
