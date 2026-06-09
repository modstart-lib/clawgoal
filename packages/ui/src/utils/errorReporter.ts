/**
 * 前端错误上报
 *
 * 将 JS 运行时错误批量上报到后端 /api/error 接口，由后端统一转发到 Grow 埋点：
 *   POST /api/error  { events: [...] }
 *
 * 采用延迟批量策略，积累 5s 或达到 20 条时统一发送，避免逐条请求。
 */

const REPORT_URL = '/api/error'
const FLUSH_DELAY_MS = 5_000
const MAX_QUEUE_SIZE = 20

// 构建时注入的版本号 & 构建 ID
const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'
const BUILD_ID: string =
  typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : `v${APP_VERSION}`
const TYPE_PREFIX = `app-${APP_VERSION}`

// 会话 & 设备标识（持久化到 sessionStorage / localStorage）
function getOrCreate(storage: Storage, key: string, prefix: string): string {
  let val = storage.getItem(key)
  if (!val) {
    val = `${prefix}_${Math.random().toString(36).slice(2, 11)}`
    try {
      storage.setItem(key, val)
    } catch {
      // 存储满了或隐私模式，忽略
    }
  }
  return val
}

const DID = getOrCreate(localStorage, '__awx_did', 'did')
const SID = getOrCreate(sessionStorage, '__awx_sid', 'sid')

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
    src?: string
    line?: number
    col?: number
    build_id: string
  }
}

// 忽略特定错误模式，避免无效噪音上报
const IGNORE_PATTERNS: RegExp[] = [
  // WebSocket 连接本地开发服务器失败（socket.io 重连机制会自行处理）
  /WebSocket connection to/,
]

function isErrorIgnored(msg: string, stack?: string): boolean {
  try {
    const text = `${msg} ${stack ?? ''}`
    return IGNORE_PATTERNS.some((p) => p.test(text))
  } catch {
    return false
  }
}

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
  try {
    const body = JSON.stringify({ events })
    // 优先用 sendBeacon，退回到 fetch
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        REPORT_URL,
        new Blob([body], { type: 'application/json' })
      )
    } else {
      fetch(REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // 忽略序列化失败
  }
}

function enqueue(event: GrowEvent): void {
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
}

export interface FrontendErrorOptions {
  msg: string
  stack?: string
  src?: string
  line?: number
  col?: number
  type?: string
}

/** 上报一条前端错误（内部调用，也可手动调用） */
export function reportError(opts: FrontendErrorOptions): void {
  try {
    const event: GrowEvent = {
      et: 'error',
      path: typeof location !== 'undefined' ? location.pathname : '/',
      did: DID,
      sid: SID,
      ts: Date.now(),
      type: `${TYPE_PREFIX}-${opts.type ?? 'RuntimeError'}`,
      props: {
        msg: opts.msg,
        ...(opts.stack ? { stack: opts.stack } : {}),
        ...(opts.src ? { src: opts.src } : {}),
        ...(opts.line !== undefined ? { line: opts.line } : {}),
        ...(opts.col !== undefined ? { col: opts.col } : {}),
        build_id: BUILD_ID,
      },
    }
    enqueue(event)
  } catch {
    // 防止上报逻辑本身抛错
  }
}

/** 初始化全局错误监听，在 main.ts 调用一次即可 */
export function initErrorReporter(): void {
  // 未捕获的同步错误
  window.addEventListener('error', (e: ErrorEvent) => {
    const msg = e.message || 'Unknown error'
    const stack = e.error instanceof Error ? e.error.stack : undefined
    if (isErrorIgnored(msg, stack)) return
    console.error(`[ErrorReporter] ${msg}`, e.error || e)
    reportError({
      msg,
      stack,
      src: e.filename,
      line: e.lineno,
      col: e.colno,
      type: e.error?.name ?? 'Error',
    })
  })

  // 未处理的 Promise rejection
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const reason = e.reason
    const isError = reason instanceof Error
    const msg = isError ? reason.message : String(reason)
    const stack = isError ? reason.stack : undefined
    if (isErrorIgnored(msg, stack)) return
    console.error(`[ErrorReporter] Unhandled Rejection: ${msg}`, reason)
    reportError({
      msg,
      stack,
      type: isError ? reason.name : 'UnhandledRejection',
    })
  })

  // 页面卸载前强制 flush（兜底）
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}
