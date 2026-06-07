<template>
  <a-modal
    :open="visible"
    width="min(600px, 90vw)"
    :footer="null"
    :closable="true"
    :mask-closable="true"
    @cancel="visible = false"
  >
    <div class="py-2">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-5">
        <div
          class="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 flex items-center justify-center shadow-lg shadow-green-500/20"
        >
          <svg
            class="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 5v14m-7-7l7 7 7-7" />
          </svg>
        </div>
        <div>
          <div class="text-lg font-bold text-gray-900 dark:text-gray-100">
            {{ t('setting.updateFoundTitle') }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {{
              t('setting.newVersionTag', { version: `v${data.latestVersion}` })
            }}
          </div>
        </div>
      </div>

      <!-- Summary (HTML detail content) -->
      <div
        v-if="data.summary"
        class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30"
      >
        <div
          class="text-sm text-blue-700 dark:text-blue-300 leading-relaxed"
          v-html="data.summary"
        />
      </div>

      <!-- Feature (short plain text) -->
      <div v-if="data.feature" class="mb-5">
        <div
          class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2"
        >
          {{ t('setting.updateFeatureTitle') }}
        </div>
        <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {{ data.feature }}
        </div>
      </div>

      <!-- Actions -->
      <div
        class="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-700"
      >
        <a-button @click="handleLater">
          {{ t('setting.updateLater') }}
        </a-button>
        <a-button
          type="primary"
          class="shadow-lg shadow-primary/20"
          @click="handleDownload"
        >
          <div class="inline-flex items-center gap-1.5">
            <DownloadIcon class="w-4 h-4" aria-hidden="true" />
            {{ t('setting.goToDownload') }}
          </div>
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { openUrl } from '@/utils/utils'
import { AppConfig } from '@/config'
import { systemApi, type VersionCheckResult } from '@/api/system'
import { VersionUtil } from '@/utils/version'
import DownloadIcon from '~icons/lucide/download'
import { Modal } from 'ant-design-vue'

const IGNORED_KEY = `${AppConfig.name}_upgrade_ignored`

const props = withDefaults(
  defineProps<{
    /** When true, auto-check for updates on mount (silent if no update) */
    autoCheck?: boolean
  }>(),
  {
    autoCheck: false,
  }
)

const { t } = useI18n()
const visible = ref(false)
const data = ref<VersionCheckResult>({
  hasNew: false,
  latestVersion: '',
  summary: '',
  feature: '',
  releaseDate: '',
  downloadUrl: '',
  currentVersion: '',
})

/** Get the version that user chose to ignore */
function getIgnoredVersion(): string {
  try {
    return localStorage.getItem(IGNORED_KEY) || ''
  } catch {
    return ''
  }
}

/** Save the version to ignore on future auto-checks */
function setIgnoredVersion(v: string) {
  try {
    if (v) {
      localStorage.setItem(IGNORED_KEY, v)
    } else {
      localStorage.removeItem(IGNORED_KEY)
    }
  } catch {
    // Best-effort
  }
}

/**
 * Manually trigger an upgrade check (from button click).
 * Always shows result regardless of ignored version.
 */
async function check() {
  const versionStr = (AppConfig.version || '').replace(/^v/i, '')
  const result = await systemApi.checkVersion(versionStr)
  if (
    !result.latestVersion ||
    VersionUtil.le(result.latestVersion, result.currentVersion)
  ) {
    Modal.success({
      title: t('setting.checkUpdate'),
      content: t('setting.alreadyLatest'),
    })
    setIgnoredVersion('')
    return
  }
  data.value = result
  visible.value = true
}

/**
 * Auto-check on startup (silent when no update or version is ignored).
 */
async function checkSilently() {
  const versionStr = (AppConfig.version || '').replace(/^v/i, '')
  const result = await systemApi.checkVersion(versionStr)
  if (!result.latestVersion) return
  if (!VersionUtil.gt(result.latestVersion, result.currentVersion)) return

  // Skip if this version was already ignored by user
  const ignored = getIgnoredVersion()
  if (ignored && VersionUtil.le(result.latestVersion, ignored)) return

  data.value = result
  visible.value = true
}

if (props.autoCheck) {
  setTimeout(() => {
    checkSilently().catch(() => {})
  }, 6000)
}

function handleLater() {
  setIgnoredVersion(data.value.latestVersion)
  visible.value = false
}

function handleDownload() {
  visible.value = false
  setIgnoredVersion('')
  setTimeout(() => {
    openUrl(data.value.downloadUrl || AppConfig.website)
  }, 300)
}

defineExpose({ check })
</script>
