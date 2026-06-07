<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import {
  useIsCreator,
  useIsSupervisor,
  useIsDatabaseMode,
} from '@/composables/setting'
import ConfigEmbeddingModel from '@/views/Config/ConfigEmbeddingModel.vue'
import ConfigModelProvider from '@/views/Config/ConfigModelProvider.vue'
import ConfigRuntime from '@/views/Config/ConfigRuntime.vue'
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BotMessageSquare from '~icons/lucide/bot-message-square'
import Braces from '~icons/lucide/braces'
import Monitor from '~icons/lucide/monitor'
import Plug from '~icons/lucide/plug'
import UserRound from '~icons/lucide/user-round'
import Channel from './Config/Channel.vue'
import ConfigUser from '@/views/Config/User.vue'
import ConfigBasic from './Config/ParamForm.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const route = useRoute()
const router = useRouter()
const activeTab = ref((route.query.tab as string) || 'chatSettings')
watch(activeTab, (val) => {
  router.replace({ query: { ...route.query, tab: val } })
})
const { isSupervisor } = useIsSupervisor()
const { isCreator } = useIsCreator()
const { isDatabaseMode } = useIsDatabaseMode()

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

<template>
  <div>
    <PageHeader :title="$t('config.title')" />

    <a-tabs v-model:active-key="activeTab" class="-mt-4">
      <a-tab-pane key="chatSettings">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <UserRound class="w-4 h-4" />
            {{ $t('config.chatSettings') }}
          </span>
        </template>
        <ConfigBasic />
      </a-tab-pane>

      <a-tab-pane key="channel">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Plug class="w-4 h-4" />
            {{ $t('claw.nav.channel') }}
          </span>
        </template>
        <Channel />
      </a-tab-pane>

      <a-tab-pane v-if="isDatabaseMode && isCreator" key="user">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <UserRound class="w-4 h-4" />
            {{ $t('config.user') }}
          </span>
        </template>
        <ConfigUser />
      </a-tab-pane>

      <a-tab-pane v-if="isSupervisor" key="modelProvider">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <BotMessageSquare class="w-4 h-4" />
            {{ $t('config.modelProvider') }}
          </span>
        </template>
        <ConfigModelProvider />
      </a-tab-pane>

      <a-tab-pane v-if="isSupervisor" key="embeddingModel">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Braces class="w-4 h-4" />
            {{ $t('config.embeddingModel') }}
          </span>
        </template>
        <ConfigEmbeddingModel />
      </a-tab-pane>

      <a-tab-pane v-if="isSupervisor" key="runtime">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Monitor class="w-4 h-4" />
            {{ $t('config.runtime') }}
          </span>
        </template>
        <ConfigRuntime />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>
