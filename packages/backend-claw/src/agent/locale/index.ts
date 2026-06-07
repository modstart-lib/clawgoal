/**
 * Agent-level i18n for role configs.
 *
 * Role config fields (title, description, toolActions[*].title / template,
 * toolActions[*].config.fields[*].title, etc.) that need i18n are stored as
 * T(key) placeholders in config.yaml.
 * This module resolves ALL placeholders via the generic recursive resolveAllT
 * from backend/locale — no structural constraints, any nested string is handled.
 *
 * Add new role translations to zh-CN.ts / en-US.ts under the role's namespace.
 */

import type { LocaleKey } from '../../../../backend/src/locale/index.js'
import {
  resolveAllT,
  resolveT as _resolveT,
} from '../../../../backend/src/locale/index.js'
import enUS from './en-US.js'
import zhCN from './zh-CN.js'

const agentMessages: Record<LocaleKey, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

/**
 * Resolve a single T(key) placeholder using agent role locale messages.
 */
export function resolveT(value: string, locale: LocaleKey): string {
  return _resolveT(value, locale, agentMessages)
}

/**
 * Recursively resolve ALL T() placeholders in a role config object.
 * Every string at any depth is checked — title, description, toolAction titles,
 * templates, field titles, etc.
 */
export function resolveRoleLocale<T>(role: T, locale: LocaleKey): T {
  return resolveAllT(role, locale, agentMessages)
}
