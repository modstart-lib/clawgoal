import { logger } from './logger.js'
import { getUserAgent } from './utils.js'
import { AppConfig } from '../config.js'
import { BUILD_ID } from '../generated/buildId.js'

// ─── Beacon client ────────────────────────────────────────────────────────────

const BEACON_URL = 'https://g.tecmz.com/grow/load.gif'
const APP_NAME = 'clawgoal'

/**
 * Send an array of events to the Grow beacon in a single request.
 * Events are JSON-serialized, base64-encoded, and sent as a GET parameter.
 * Errors are silently caught and logged as warnings — never throw.
 */
export function sendToBeacon(events: unknown[]): void {
  if (events.length === 0) return

  try {
    const json = JSON.stringify(events)
    const encoded = encodeURIComponent(Buffer.from(json).toString('base64'))
    const url = `${BEACON_URL}?app=${APP_NAME}&data=${encoded}`

    fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': getUserAgent() },
    }).catch((err) => {
      logger.warn({ err }, 'beacon: flush failed')
    })
  } catch (err) {
    logger.warn({ err }, 'beacon: failed to encode events')
  }
}

// ─── System error reporter ────────────────────────────────────────────────────

const FLUSH_DELAY_MS = 5_000
const MAX_QUEUE_SIZE = 20

// Persistent identifiers for this process lifetime
const TYPE_PREFIX = `app-${AppConfig.version}`

// Simple random ID generator (no external deps)
function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`
}

const DID = randomId('did')
const SID = randomId('sid')

export interface ErrorReportPayload {
  type: string
  message: string
  stack?: string
  [key: string]: unknown
}

interface GrowEvent {
  et: 'error'
  path: string
  did: string
  sid: string
  ts: number
  type: string
  props: {
    msg: string
    stack?: string
    build_id: string
    [key: string]: unknown
  }
}

// Pending events buffer
const queue: GrowEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush(): void {
  if (flushTimer !== null) return
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS)
}

function flush(): void {
  flushTimer = null
  if (queue.length === 0) return

  const events = queue.splice(0)
  sendToBeacon(events)
}

/**
 * Enqueue a system-level error event for batch upload to the Grow beacon.
 * No-op when beacon is not reachable — errors are silently swallowed.
 */
export function reportSystemError(payload: ErrorReportPayload): void {
  try {
    const event: GrowEvent = {
      et: 'error',
      path: '/backend',
      did: DID,
      sid: SID,
      ts: Date.now(),
      type: `${TYPE_PREFIX}-${payload.type}`,
      props: {
        msg: payload.message,
        ...(payload.stack ? { stack: payload.stack } : {}),
        build_id: BUILD_ID,
      },
    }

    queue.push(event)

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
    // Swallow all errors to prevent recursive loops
  }
}
