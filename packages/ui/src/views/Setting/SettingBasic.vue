<template>
  <div class="max-w-lg space-y-6 pt-2">
    <!-- 界面 -->
    <div
      class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4"
    >
      <div
        class="text-sm font-bold text-gray-700 dark:text-gray-300 pb-2 border-b border-gray-200 dark:border-gray-700"
      >
        {{ $t('settingBasic.uiSection') }}
      </div>

      <!-- Language -->
      <div>
        <div class="flex items-center gap-2 mb-2">
          <Languages class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span
            class="text-sm font-semibold text-gray-700 dark:text-gray-300"
            >{{ $t('setting.language') }}</span
          >
        </div>
        <a-button-group>
          <a-button
            v-for="lang in languages"
            :key="lang.key"
            :type="localeStore.locale === lang.key ? 'primary' : undefined"
            @click="setLanguage(lang.key)"
          >
            <div class="inline-flex items-center gap-1">
              <component :is="lang.icon" class="w-4 h-4" aria-hidden="true" />
              {{ lang.label }}
            </div>
          </a-button>
        </a-button-group>
      </div>

      <!-- Theme -->
      <div>
        <div class="flex items-center gap-2 mb-2">
          <Palette class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span
            class="text-sm font-semibold text-gray-700 dark:text-gray-300"
            >{{ $t('setting.theme') }}</span
          >
        </div>
        <a-button-group>
          <a-button
            v-for="theme in themes"
            :key="theme.key"
            :type="currentTheme === theme.key ? 'primary' : undefined"
            @click="setTheme(theme.key)"
          >
            <div class="inline-flex items-center gap-1">
              <component :is="theme.icon" class="w-4 h-4" aria-hidden="true" />
              {{ theme.label }}
            </div>
          </a-button>
        </a-button-group>
      </div>
    </div>

    <!-- 功能 -->
    <div
      class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4"
    >
      <div
        class="text-sm font-bold text-gray-700 dark:text-gray-300 pb-2 border-b border-gray-200 dark:border-gray-700"
      >
        {{ $t('settingBasic.featureSection') }}
      </div>

      <!-- 访问地址 -->
      <div v-if="viewMode !== 'client'" class="space-y-1">
        <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ $t('settingBasic.siteUrlTitle') }}
        </div>
        <div class="text-xs text-gray-400 dark:text-gray-500 mb-2">
          {{ $t('settingBasic.siteUrlDesc') }}
        </div>
        <a-input
          v-model:value="form.url"
          :placeholder="$t('settingBasic.siteUrlPlaceholder')"
          allow-clear
        />
        <div
          v-if="form.url"
          class="text-xs text-gray-400 dark:text-gray-500 mt-1"
        >
          {{ $t('settingBasic.siteUrlCurrent', { url: form.url }) }}
        </div>
        <div v-else class="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {{ $t('settingBasic.siteUrlFallback', { url: fallbackOrigin }) }}
        </div>
      </div>

      <a-button type="primary" :loading="saving" @click="handleSave">{{
        $t('settingBasic.save')
      }}</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { userParamBatchGet, userParamSet } from '@/api/userParam.ts'
import { getSystemSetting, saveSystemSetting } from '@/api/setting'
import { useLocale } from '@/composables/locale.ts'
import { useSiteUrl, useAppEnvComputed } from '@/composables/setting.ts'
import { useTheme } from '@/composables/theme.ts'
import type { LocaleKey } from '@/locale'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Languages from '~icons/lucide/languages'
import Moon from '~icons/lucide/moon'
import Palette from '~icons/lucide/palette'
import Sun from '~icons/lucide/sun'
import { testActionSet, testActionUnset } from '@/utils/test'

const PARAM_LANG = 'UserLang'
const PARAM_THEME = 'UserTheme'

const { t } = useI18n()
const localeStore = useLocale()
const { isDark, setDarkMode } = useTheme()
const siteUrlStore = useSiteUrl()
const { viewMode } = useAppEnvComputed()
const saving = ref(false)
const fallbackOrigin =
  typeof window !== 'undefined' ? window.location.origin : ''

const currentTheme = computed(() => (isDark.value ? 'dark' : 'light'))

const languages = computed(() => [
  { key: 'zh-CN' as LocaleKey, label: t('setting.langZhCN'), icon: Languages },
  { key: 'en-US' as LocaleKey, label: t('setting.langEnUS'), icon: Languages },
])

const themes = computed(() => [
  { key: 'light', label: t('setting.themeLight'), icon: Sun },
  { key: 'dark', label: t('setting.themeDark'), icon: Moon },
])

const form = reactive({ url: '' })

onMounted(async () => {
  try {
    const [values, data] = await Promise.all([
      userParamBatchGet({
        // 无服务端记录时必须用空串默认，勿用 en-US，否则会把「未保存」误判为英文并覆盖本地语言
        [PARAM_LANG]: '',
        [PARAM_THEME]: '',
      }),
      getSystemSetting(),
    ])
    const savedLang = values[PARAM_LANG]
    const savedTheme = values[PARAM_THEME]
    if (
      (savedLang === 'zh-CN' || savedLang === 'en-US') &&
      savedLang !== localeStore.locale
    ) {
      localeStore.switchLocale(savedLang as LocaleKey)
    }
    if (
      (savedTheme === 'light' || savedTheme === 'dark') &&
      savedTheme !== currentTheme.value
    ) {
      setDarkMode(savedTheme === 'dark')
    }
    form.url = data.url ?? ''
  } catch {
    // ignore
  }
})

onMounted(() => {
  testActionSet('setting.basic.save', () => handleSave())
})
onUnmounted(() => {
  testActionUnset('setting.basic.save')
})

async function setLanguage(key: LocaleKey) {
  localeStore.switchLocale(key)
  try {
    await userParamSet(PARAM_LANG, key, { scope: 'system' })
  } catch {
    /* ignore */
  }
}

async function setTheme(key: string) {
  setDarkMode(key === 'dark')
  try {
    await userParamSet(PARAM_THEME, key, { scope: 'system' })
  } catch {
    /* ignore */
  }
}

async function handleSave() {
  saving.value = true
  try {
    await saveSystemSetting({ url: form.url.trim() })
    siteUrlStore.configuredUrl = form.url.trim()
    message.success(t('settingBasic.saveSuccess'))
  } catch {
    message.error(t('settingBasic.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>
