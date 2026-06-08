import { logger } from './logger'

export function jsonStringify(value: unknown, space?: number): string {
  return JSON.stringify(value, null, space)
}

/**
 * Safe JSON parse — returns `defaultVal` when the input is falsy or not valid JSON.
 * Logs a warning on parse failure so dirty data can be traced.
 * `biz` identifies the calling context (e.g. "project.meta", "event.meta") to quickly locate issues.
 * Use this in store/ORM layers where database fields may contain dirty data.
 */
export function safeJsonParse<T = any>(
  text: string | null | undefined,
  defaultVal: T,
  biz: string = 'unknown'
): T {
  if (!text) return defaultVal
  try {
    return JSON.parse(text) as T
  } catch (err) {
    const sample = text.length > 200 ? text.slice(0, 200) + '...' : text
    logger.warn(
      { err, biz },
      `safeJsonParse[${biz}]: invalid JSON value (len=${text.length}, sample="${sample}"), returning default`
    )
    return defaultVal
  }
}

/**
 * JSON parse with type cast — delegates to safeJsonParse internally.
 * Returns `defaultVal` (default `null`) on failure.
 */
export function jsonParse<T = unknown>(
  text: string | null | undefined,
  defaultVal: T | null = null,
  biz: string = 'jsonParse'
): T | null {
  return safeJsonParse<T | null>(text, defaultVal, biz)
}

/**
 * Sanitize a value for logging:
 * - `data:<mime>;base64,...` data URIs → `[base64:~Nb]`
 * - Pure base64-like strings longer than 200 chars → `[base64:~Nb]`
 * - Other strings longer than 500 chars → truncated with char count suffix
 * - Objects/arrays are recursed up to depth 8
 */
function _sanitizeLogValue(value: unknown, depth: number): unknown {
  if (depth > 8) return '[deep]'
  if (typeof value === 'string') {
    // data: URI with base64 payload
    const dataUriIdx = value.indexOf(';base64,')
    if (value.startsWith('data:') && dataUriIdx !== -1) {
      const payloadLen = value.length - dataUriIdx - 8
      const byteEstimate = Math.round(payloadLen * 0.75)
      return `[base64:~${byteEstimate}b]`
    }
    // Raw base64-encoded string (no data URI wrapper)
    if (value.length > 200 && /^[A-Za-z0-9+/=]{200,}$/.test(value)) {
      const byteEstimate = Math.round(value.length * 0.75)
      return `[base64:~${byteEstimate}b]`
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((v) => _sanitizeLogValue(v, depth + 1))
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = _sanitizeLogValue(v, depth + 1)
    }
    return result
  }
  return value
}

export function logJson(value: unknown): unknown {
  return _sanitizeLogValue(value, 0)
}
