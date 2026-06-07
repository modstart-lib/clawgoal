/**
 * Backend-claw i18n utility
 * Merges base locale messages with claw-specific messages
 */
import {
  enUS as baseEnUS,
  zhCN as baseZhCN,
  getLocale,
  createI18n,
} from '../../../backend/src/locale/index.js'
import { clawEnUS } from './en-US.js'
import { clawZhCN } from './zh-CN.js'

export type LocaleKey = 'zh-CN' | 'en-US'

const zhCN = { ...baseZhCN, ...clawZhCN } as const
const enUS = { ...baseEnUS, ...clawEnUS } as const

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
} as const

export type MessageKey = keyof (typeof messages)['zh-CN']

const { t, useI18n } = createI18n(messages)
export { getLocale, t, useI18n }
