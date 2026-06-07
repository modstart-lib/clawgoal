import { createI18n } from 'vue-i18n'
import { AppConfig } from '../config'

// 公共翻译（common / nav / auth / login / home / utils）
import enUS from './en-US'
import zhCN from './zh-CN'

// 组件翻译
import componentsEnUS from '../components/locale/en-US'
import componentsZhCN from '../components/locale/zh-CN'

// 视图翻译 - Config
import configEnUS from '../views/Config/locale/en-US'
import configZhCN from '../views/Config/locale/zh-CN'

// 视图翻译 - Setting
import settingEnUS from '../views/Setting/locale/en-US'
import settingZhCN from '../views/Setting/locale/zh-CN'

import { useClawLocales } from '../../../ui-claw/src/locale'

const clawLocales = useClawLocales()

export type LocaleKey = 'zh-CN' | 'en-US'

export const LOCALE_KEY = AppConfig.storageKeys.locale

export const defaultLocale: LocaleKey =
  (localStorage.getItem(LOCALE_KEY) as LocaleKey) || 'zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': {
      ...zhCN,
      ...componentsZhCN,
      ...configZhCN,
      ...settingZhCN,
      ...clawLocales.zhCN,
    },
    'en-US': {
      ...enUS,
      ...componentsEnUS,
      ...configEnUS,
      ...settingEnUS,
      ...clawLocales.enUS,
    },
  },
})

export const setLocale = (locale: LocaleKey) => {
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_KEY, locale)
}

export const getLocale = (): LocaleKey => {
  return i18n.global.locale.value as LocaleKey
}

export default i18n
