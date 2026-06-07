/**
 * Backend i18n utility
 * Reads Accept-Language header from the request and returns localized messages
 */
import type { Request } from 'express'
import { config } from '../config/index.js'
import { getParam } from '../utils/userParam.js'
import { enUS } from './en-US'
import { zhCN } from './zh-CN'

export { enUS } from './en-US'
export { zhCN } from './zh-CN'

export type LocaleKey = 'en-US' | 'zh-CN'

export const LocaleKeyDefault = 'zh-CN' as const

/** Param key used to store the user's language preference */
export const PARAM_KEY_LANG = 'UserLang'
/** Legacy: ui-claw 曾用该键保存对话语言，值为 zh / en */
const PARAM_KEY_LANG_LEGACY = 'Language'
/** Param key used to store the user's theme preference */
export const PARAM_KEY_THEME = 'UserTheme'

const messages = {
  'en-US': enUS,
  'zh-CN': zhCN,
} as const

export type MessageKey = keyof (typeof messages)['en-US']

/**
 * Detect locale from the Accept-Language header.
 * Falls back to the system default (config.lang) when no header is present.
 * Priority: Accept-Language header → config.lang
 */
export function getLocale(req: Request): LocaleKey {
  const acceptLanguage = req.headers['accept-language'] || ''
  if (acceptLanguage) {
    if (acceptLanguage.toLowerCase().includes('zh')) {
      return 'zh-CN'
    }
    return 'en-US'
  }
  // No Accept-Language header — fall back to system default
  return config.lang
}

/**
 * Create a translator bound to socket.data (WebSocket, no HTTP req).
 * Usage: const { t } = useWsI18n(socket.data); t('authLoginSuccess')
 */
export function useWsI18n(socketData: { locale?: LocaleKey }) {
  const locale = socketData.locale || config.lang
  return {
    locale,
    t: (key: MessageKey): string =>
      messages[locale][key] ?? messages['en-US'][key] ?? key,
  }
}

/**
 * Resolve the language for a background task (no HTTP request available).
 * Priority: user's saved param 'UserLang' → config.lang
 */

/** In-memory cache: `${tenantId}:${userId}` → { lang, expiresAt } */
const _userLangCache = new Map<string, { lang: LocaleKey; expiresAt: number }>()
/** Cache TTL: 5 minutes */
const _USER_LANG_TTL = 5 * 60 * 1000

export async function getUserLang(
  tenantId: number,
  userId: number
): Promise<LocaleKey> {
  const cacheKey = `${tenantId}:${userId}`
  const cached = _userLangCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.lang
  }
  let saved = await getParam(tenantId, userId, PARAM_KEY_LANG, '')
  if (saved !== 'zh-CN' && saved !== 'en-US') {
    const legacy = await getParam(tenantId, userId, PARAM_KEY_LANG_LEGACY, '')
    if (legacy === 'zh') saved = 'zh-CN'
    else if (legacy === 'en') saved = 'en-US'
  }
  const lang: LocaleKey =
    saved === 'zh-CN' || saved === 'en-US' ? saved : config.lang
  _userLangCache.set(cacheKey, { lang, expiresAt: Date.now() + _USER_LANG_TTL })
  return lang
}

/**
 * Invalidate the cached language for a specific user.
 * Call this whenever PARAM_KEY_LANG is written so the next getUserLang()
 * call picks up the latest value immediately.
 */
export function clearUserLangCache(tenantId: number, userId: number): void {
  _userLangCache.delete(`${tenantId}:${userId}`)
}
/**
 * Get a localized message for the given key, using the request's Accept-Language header.
 */
export function t(req: Request, key: MessageKey): string {
  const locale = getLocale(req)
  return messages[locale][key] ?? messages['en-US'][key] ?? key
}

/**
 * Create a translator bound to a specific request.
 * Usage: const { t } = useI18n(req); t('authLoginSuccess')
 */
export function useI18n(req: Request) {
  const locale = getLocale(req)
  return {
    locale,
    t: (key: MessageKey): string =>
      messages[locale][key] ?? messages['en-US'][key] ?? key,
  }
}

/**
 * Factory: create `t` and `useI18n` helpers bound to a custom merged messages object.
 * Sub-packages use this to avoid duplicating the same logic.
 *
 * Usage:
 *   const { t, useI18n } = createI18n(messages);
 *   export { getLocale, t, useI18n };
 */
export function createI18n<
  TMessages extends {
    'zh-CN': Record<string, string>
    'en-US': Record<string, string>
  },
>(msgs: TMessages) {
  type MsgKey = keyof TMessages['zh-CN'] & string
  const fallback = msgs['en-US'] as Record<string, string>
  return {
    t(req: Request, key: MsgKey): string {
      const locale = getLocale(req)
      return (
        (msgs[locale] as Record<string, string>)[key] ?? fallback[key] ?? key
      )
    },
    useI18n(req: Request) {
      const locale = getLocale(req)
      return {
        locale,
        t: (key: MsgKey): string =>
          (msgs[locale] as Record<string, string>)[key] ?? fallback[key] ?? key,
      }
    },
  }
}

// ─── T() placeholder resolver ──────────────────────────────────────────────

const _T_PATTERN = /^T\((.+)\)$/

/**
 * Resolve a single `T(key)` placeholder against a locale messages map.
 * Returns the original value unchanged when it is not a T() expression.
 * Falls back to 'en-US', then to the raw placeholder string when key is absent.
 *
 * Usage: pass the merged messages object from the sub-package locale.
 */
export function resolveT(
  value: string,
  locale: LocaleKey,
  msgs: Record<LocaleKey, Record<string, string>>
): string {
  const match = _T_PATTERN.exec(value)
  if (!match) return value
  const key = match[1]
  return msgs[locale]?.[key] ?? msgs['en-US']?.[key] ?? value
}

/**
 * Recursively resolve all `T(key)` placeholder strings anywhere in a nested value.
 * - Strings matching `T(key)` are resolved via `resolveT`.
 * - Arrays and plain objects are walked recursively (new copies created, originals never mutated).
 * - Numbers, booleans, null, and undefined pass through unchanged.
 *
 * This is a generic replacement for fixed-shape resolvers — any object structure is supported.
 *
 * @example
 * const resolved = resolveAllT(roleConfig, locale, agentMessages)
 */
export function resolveAllT<T>(
  value: T,
  locale: LocaleKey,
  msgs: Record<LocaleKey, Record<string, string>>
): T {
  if (typeof value === 'string') {
    return resolveT(value, locale, msgs) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveAllT(item, locale, msgs)) as unknown as T
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = resolveAllT(v, locale, msgs)
    }
    return result as unknown as T
  }
  return value
}
