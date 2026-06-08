<template>
  <div class="max-w-lg pt-2 space-y-4">
    <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-5 space-y-3">
      <div class="flex items-center gap-3">
        <img src="@/assets/logo.svg" alt="Logo" class="w-10 h-10" />
        <div>
          <div class="text-lg font-bold text-gray-900 dark:text-gray-100">
            {{ appConfig.title }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {{ appConfig.description }}
          </div>
        </div>
      </div>
      <div class="border-t border-gray-200 dark:border-gray-600 pt-3 space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">{{
            $t('setting.versionLabel')
          }}</span>
          <span class="text-gray-900 dark:text-gray-100 font-mono">{{
            appConfig.version
          }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">{{
            $t('setting.buildTime')
          }}</span>
          <span class="text-gray-900 dark:text-gray-100">{{
            appConfig.buildTime
          }}</span>
        </div>
        <div
          class="border-t border-gray-200 dark:border-gray-600 pt-3 flex items-center justify-between"
        >
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('setting.updateCheckDesc') }}
          </span>
          <a-button
            type="primary"
            :loading="checking"
            @click="handleCheckUpdate"
          >
            <div class="inline-flex items-center gap-1">
              <RefreshCwIcon class="w-4 h-4" aria-hidden="true" />
              {{
                checking
                  ? $t('setting.checkingUpdate')
                  : $t('setting.checkUpdate')
              }}
            </div>
          </a-button>
        </div>
      </div>
    </div>

    <UpgradePanel ref="upgradePanel" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AppConfig } from '../../config'
import RefreshCwIcon from '~icons/lucide/refresh-cw'
import UpgradePanel from '@/components/UpgradePanel.vue'

const appConfig = AppConfig
const checking = ref(false)
const upgradePanel = ref<InstanceType<typeof UpgradePanel> | null>(null)

async function handleCheckUpdate() {
  checking.value = true
  try {
    await upgradePanel.value?.check()
  } finally {
    checking.value = false
  }
}
</script>
