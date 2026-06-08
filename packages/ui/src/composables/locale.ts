import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import { setLocale, LOCALE_KEY, type LocaleKey, i18n } from '../locale'

export const useLocale = defineStore('locale', () => {
  const locale = ref<LocaleKey>(
    (localStorage.getItem(LOCALE_KEY) as LocaleKey) || 'zh-CN'
  )

  const antdLocale = computed(() => {
    return locale.value === 'zh-CN' ? zhCN : enUS
  })

  const localeLabel = computed(() => {
    return locale.value === 'zh-CN'
      ? i18n.global.t('setting.langZhCN')
      : i18n.global.t('setting.langEnUS')
  })

  function switchLocale(newLocale: LocaleKey) {
    locale.value = newLocale
    setLocale(newLocale)
  }

  function toggleLocale() {
    switchLocale(locale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
  }

  return {
    locale,
    antdLocale,
    localeLabel,
    switchLocale,
    toggleLocale,
  }
})
