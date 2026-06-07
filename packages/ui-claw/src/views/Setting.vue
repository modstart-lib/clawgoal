<template>
  <div>
    <PageHeader :title="$t('setting.pageTitle')" />

    <a-tabs v-model:active-key="activeTab">
      <!-- 系统设置 -->
      <a-tab-pane v-if="isSupervisor" key="basic">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Settings class="w-4 h-4" />
            {{ $t('setting.tabSystem') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingBasic />
        </div>
      </a-tab-pane>

      <!-- 账号安全（仅管理员显示） -->
      <a-tab-pane v-if="isSupervisor && viewMode !== 'client'" key="security">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Shield class="w-4 h-4" />
            {{ $t('setting.tabSecurity') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingAccount />
        </div>
      </a-tab-pane>

      <!-- API Token 管理 -->
      <a-tab-pane v-if="isSupervisor && viewMode !== 'client'" key="apiToken">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <KeyRound class="w-4 h-4" />
            {{ $t('setting.tabApi') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingApiToken />
        </div>
      </a-tab-pane>

      <!-- 通知 -->
      <a-tab-pane v-if="isSupervisor" key="notice">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Bell class="w-4 h-4" />
            {{ $t('setting.tabNotice') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingNotice />
        </div>
      </a-tab-pane>

      <!-- 代理 -->
      <a-tab-pane v-if="isSupervisor" key="proxy">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Globe class="w-4 h-4" />
            {{ $t('setting.tabProxy') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingProxy />
        </div>
      </a-tab-pane>

      <!-- 文件上传 -->
      <a-tab-pane v-if="isSupervisor" key="upload">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Upload class="w-4 h-4" />
            {{ $t('setting.tabUpload') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingUpload />
        </div>
      </a-tab-pane>

      <!-- 文件管理 -->
      <a-tab-pane v-if="isSupervisor" key="file">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <FolderOpen class="w-4 h-4" />
            {{ $t('setting.tabFile') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingFile />
        </div>
      </a-tab-pane>

      <!-- 数据库 -->
      <a-tab-pane v-if="isSupervisor" key="sqlite">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Database class="w-4 h-4" />
            {{ $t('setting.tabDatabase') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingSqlite />
        </div>
      </a-tab-pane>

      <!-- 模型日志 -->
      <a-tab-pane v-if="isSupervisor" key="modelLog">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <ScrollText class="w-4 h-4" />
            {{ $t('setting.tabModelLog') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingModelLog />
        </div>
      </a-tab-pane>

      <!-- 关于系统 -->
      <a-tab-pane key="about">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Info class="w-4 h-4" />
            {{ $t('setting.tabAbout') }}
          </span>
        </template>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5">
          <SettingAbout />
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { useIsSupervisor, useAppEnvComputed } from '@/composables/setting'
import SettingAbout from '@/views/Setting/SettingAbout.vue'
import SettingAccount from '@/views/Setting/SettingAccount.vue'
import SettingApiToken from '@/views/Setting/SettingApiToken.vue'
import SettingBasic from '@/views/Setting/SettingBasic.vue'
import SettingFile from '@/views/Setting/SettingFile.vue'
import SettingModelLog from '@/views/Setting/SettingModelLog.vue'
import SettingNotice from '@/views/Setting/SettingNotice.vue'
import SettingProxy from '@/views/Setting/SettingProxy.vue'
import SettingSqlite from '@/views/Setting/SettingSqlite.vue'
import SettingUpload from '@/views/Setting/SettingUpload.vue'
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Bell from '~icons/lucide/bell'
import Database from '~icons/lucide/database'
import FolderOpen from '~icons/lucide/folder-open'
import Globe from '~icons/lucide/globe'
import Info from '~icons/lucide/info'
import KeyRound from '~icons/lucide/key-round'
import ScrollText from '~icons/lucide/scroll-text'
import Settings from '~icons/lucide/settings'
import Shield from '~icons/lucide/shield'
import Upload from '~icons/lucide/upload'
import { testActionSet, testActionUnset } from '@/utils/test'

const route = useRoute()
const router = useRouter()
const { isSupervisor } = useIsSupervisor()
const { viewMode } = useAppEnvComputed()
const activeTab = ref((route.query.tab as string) || 'basic')
watch(activeTab, (val) => {
  router.replace({ query: { ...route.query, tab: val } })
})

onMounted(() => {
  testActionSet('page.ready', () => {})
  testActionSet('tab.switch', (tab: string) => {
    activeTab.value = tab
  })
})
onUnmounted(() => {
  testActionUnset('page.ready')
  testActionUnset('tab.switch')
})
</script>
