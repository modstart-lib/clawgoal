/**
 * Common utility functions
 */

/**
 * Safe JSON parse — returns `defaultVal` when the input is falsy or not valid JSON.
 * Use this for all JSON.parse calls to avoid unhandled exceptions.
 */
export function safeJsonParse<T = any>(
  text: string | null | undefined,
  defaultVal: T
): T {
  if (!text) return defaultVal
  try {
    return JSON.parse(text) as T
  } catch {
    return defaultVal
  }
}

/**
 * Copy text to clipboard (with fallback for older browsers)
 * @param toast - success message to show, pass false to suppress
 */
export async function copyText(
  text: string,
  toast: string | false = ''
): Promise<void> {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
  } else {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.top = '-9999px'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  if (toast) {
    const { message } = await import('ant-design-vue')
    message.success(toast)
  }
}

/**
 * Generate unique ID
 * Format: timestamp_random (e.g.: 1771038774975_a1b2c3d4e)
 * @returns Unique ID string
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Format KB value to human-readable size string
 */
export function formatBytes(
  kb: number | null | undefined,
  unit: 'GB' | 'MB' = 'GB'
): string {
  if (kb == null) return '-'
  if (unit === 'GB') return (kb / 1024 / 1024).toFixed(1) + ' GB'
  return (kb / 1024).toFixed(0) + ' MB'
}

/**
 * Format uptime seconds to human-readable string (e.g. "3天5时" or "5时")
 * @param t - vue-i18n translate function
 */
export function formatUptime(
  seconds: number | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  if (seconds == null) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return t('utils.uptime.dayHour', { d, h })
  return t('utils.uptime.hour', { h })
}

/**
 * Deep merge two plain objects recursively.
 * Nested objects are merged; arrays and primitives are overwritten.
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target }
  for (const key of Object.keys(source)) {
    const sv = source[key]
    const tv = target[key]
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>
      )
    } else {
      result[key] = sv
    }
  }
  return result
}

/**
 * Build the app_manager/enter URL with auth and dark-mode params.
 * The enter endpoint handles auth and redirects to the target url.
 */
export function getWebEnterUrl(
  targetUrl: string,
  apiToken?: string | null,
  baseUrl?: string,
  themeKey?: string
): string {
  const params: string[] = []
  if (apiToken) {
    params.push(`api_token=${encodeURIComponent(apiToken)}`)
  }
  const theme =
    typeof localStorage !== 'undefined' && themeKey
      ? localStorage.getItem(themeKey)
      : null
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  if (theme === 'dark' || (theme !== 'light' && prefersDark)) {
    params.push('is_dark=1')
  }
  params.push(`url=${encodeURIComponent(targetUrl)}`)
  return `${baseUrl ?? ''}/app_manager/enter?${params.join('&')}`
}

/**
 * Open a URL in the browser.
 * - In Wails client mode: delegates to the Go layer via wailsCall to open in the system browser.
 * - In web mode: opens a new tab via window.open.
 */
export async function openUrl(url: string): Promise<void> {
  const { isWailsEnv, wailsCall } = await import('./wails')
  if (isWailsEnv()) {
    await wailsCall('openUrl', { url })
  } else {
    window.open(url, '_blank')
  }
}

/**
 * CRC32 hash of a string
 * @returns Unsigned 32-bit integer
 */
export function crc32(str: string): number {
  let crc = 0xffffffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i)
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Set the browser tab title
 */
export function setPageTitle(title: string): void {
  document.title = title
}
