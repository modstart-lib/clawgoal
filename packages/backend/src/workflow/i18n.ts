import { enUS, zhCN } from '../locale/index.js'
import type { LocaleKey } from '../locale/index.js'
import type { WorkflowExecuteContext } from './type.js'

type MessageKey = keyof typeof enUS
const messages = { 'zh-CN': zhCN, 'en-US': enUS } as const

/**
 * Translate a locale key using the language from the workflow execution context.
 * Supports a single `%d` or `%s` placeholder.
 */
export function wt(
  ctx: WorkflowExecuteContext,
  key: MessageKey,
  ...args: (string | number)[]
): string {
  const lang = ctx.lang ?? 'zh-CN'
  let msg: string = messages[lang][key] ?? messages['zh-CN'][key] ?? key
  for (const arg of args) {
    msg = msg.replace('%s', String(arg)).replace('%d', String(arg))
  }
  return msg
}

/**
 * Translate a locale key using an explicit language string (no exec context needed).
 */
export function wtl(
  lang: LocaleKey | undefined,
  key: MessageKey,
  ...args: (string | number)[]
): string {
  const l = lang ?? 'zh-CN'
  let msg: string = messages[l][key] ?? messages['zh-CN'][key] ?? key
  for (const arg of args) {
    msg = msg.replace('%s', String(arg)).replace('%d', String(arg))
  }
  return msg
}
