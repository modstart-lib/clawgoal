/**
 * Wails 客户端桥接工具
 *
 * 提供通用的 wailsCall(name, args) 方法，供前端调用 Go 层功能。
 * 非 Wails 环境（普通浏览器）下自动降级，不报错。
 *
 * 支持的 name：
 *   - openUrl       { url: string }   — 用系统默认浏览器打开链接
 *   - openDevTools  {}                — 打开 Wails 审查元素调试面板
 */

type WailsCallArgs = Record<string, unknown>

interface WailsResult<T = unknown> {
  code: number
  msg: string
  data: T | null
}

/** 是否运行在 Wails 客户端环境 */
export function isWailsEnv(): boolean {
  return typeof window !== 'undefined' && 'go' in window
}

/**
 * 通用 Wails Go 方法调用。
 * 直接通过 window.go 调用，非 Wails 环境下静默忽略，返回 null。
 */
export async function wailsCall<T = unknown>(
  name: string,
  args: WailsCallArgs = {}
): Promise<WailsResult<T> | null> {
  if (!isWailsEnv()) return null

  const goApp = (window as any)['go']?.['main']?.['App']
  if (!goApp?.Call) return null
  const raw: string = await goApp.Call(name, JSON.stringify(args))
  return JSON.parse(raw) as WailsResult<T>
}

/** 用系统默认浏览器打开链接 */
export async function openUrl(url: string): Promise<void> {
  await wailsCall('openUrl', { url })
}

/** 打开 Wails DevTools 调试面板 */
export async function openDevTools(): Promise<void> {
  await wailsCall('openDevTools')
}
