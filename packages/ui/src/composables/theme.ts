import { computed, ref, watch } from 'vue'
import { AppConfig } from '../config'
import { designTokens } from '../theme/tokens'

const DEFAULT_PRIMARY_COLOR = designTokens.color.primary
const DEFAULT_PRIMARY_COLOR_DARK = designTokens.color.primaryDark

const primaryColor = ref<string>(DEFAULT_PRIMARY_COLOR)
const primaryColorDark = ref<string>(DEFAULT_PRIMARY_COLOR_DARK)
const isDark = ref<boolean>(false)

const effectivePrimaryColor = computed(() =>
  isDark.value ? primaryColorDark.value : primaryColor.value
)

const loadThemeFromStorage = () => {
  try {
    const savedTheme = localStorage.getItem(AppConfig.storageKeys.theme)

    if (savedTheme) {
      isDark.value = savedTheme === 'dark'
    } else {
      // Fall back to system preference when no theme has been saved
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
  } catch (error) {
    console.error('Failed to load theme from storage:', error)
  }
}

const initTheme = () => {
  loadThemeFromStorage()
  applyThemeToDOM()
}

const applyThemeToDOM = () => {
  document.documentElement.style.setProperty(
    '--token-primary',
    effectivePrimaryColor.value
  )

  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

watch([primaryColor, primaryColorDark, isDark], () => {
  applyThemeToDOM()

  try {
    localStorage.setItem(
      AppConfig.storageKeys.theme,
      isDark.value ? 'dark' : 'light'
    )
  } catch (error) {
    console.error('Failed to save theme to storage:', error)
  }
})

/**
 * Hook for using theme
 */
export const useTheme = () => {
  return {
    primaryColor: computed(() => primaryColor.value),
    primaryColorDark: computed(() => primaryColorDark.value),
    effectivePrimaryColor,
    isDark: computed(() => isDark.value),

    setPrimaryColor: (color: string) => {
      primaryColor.value = color
    },

    setPrimaryColorDark: (color: string) => {
      primaryColorDark.value = color
    },

    toggleDarkMode: () => {
      isDark.value = !isDark.value
    },

    setDarkMode: (dark: boolean) => {
      isDark.value = dark
    },

    initTheme,

    getAntdThemeConfig: () => ({
      token: {
        colorPrimary: effectivePrimaryColor.value,
      },
      algorithm: isDark.value ? 'dark' : 'default',
    }),
  }
}
