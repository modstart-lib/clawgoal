export function jsonStringify(value: unknown, space?: number): string {
  return JSON.stringify(value, null, space)
}

export function jsonParse<T = unknown>(text: string): T {
  return JSON.parse(text) as T
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
