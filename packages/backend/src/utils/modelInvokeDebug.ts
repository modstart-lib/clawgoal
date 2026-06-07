/**
 * Serialize thrown values from model.invoke / OpenAI client for structured logs.
 */

const MAX_STRING = 8000

export function serializeModelInvokeError(
  error: unknown
): Record<string, unknown> {
  if (error == null) return { raw: String(error) }
  if (typeof error !== 'object')
    return { raw: String(error).slice(0, MAX_STRING) }

  const e = error as Record<string, unknown> & {
    constructor?: { name?: string }
  }
  const out: Record<string, unknown> = {
    ctor: e.constructor?.name,
    name: typeof e.name === 'string' ? e.name : undefined,
    message:
      typeof e.message === 'string'
        ? e.message.slice(0, MAX_STRING)
        : undefined,
  }

  if (typeof e.status === 'number') out.httpStatus = e.status
  if (e.code !== undefined) out.code = e.code
  if (e.param !== undefined) out.param = e.param
  if (typeof e.type === 'string') out.type = e.type

  if (e.error !== undefined) {
    try {
      out.apiErrorBody = JSON.parse(JSON.stringify(e.error))
    } catch {
      out.apiErrorBody = String(e.error).slice(0, MAX_STRING)
    }
  }

  if (e.headers && typeof (e.headers as Headers).get === 'function') {
    const h = e.headers as Headers
    const rid = h.get('x-request-id') ?? h.get('request-id')
    if (rid) out.requestId = rid
  }

  if (e.cause != null) {
    out.cause =
      e.cause instanceof Error
        ? e.cause.message.slice(0, MAX_STRING)
        : String(e.cause).slice(0, MAX_STRING)
  }

  return out
}
