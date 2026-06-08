<template>
  <div>
    <PageHeader :title="$t('claw.resource.title')" />

    <a-tabs v-model:active-key="activeTab" class="-mt-4">
      <a-tab-pane key="runtime">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Plug class="w-4 h-4" />
            {{ $t('claw.resource.tabRuntime') }}
          </span>
        </template>
        <ResourceRuntime />
      </a-tab-pane>
      <a-tab-pane key="mcp">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Server class="w-4 h-4" />
            {{ $t('claw.resource.tabMcp') }}
          </span>
        </template>
        <ResourceMcp />
      </a-tab-pane>
      <a-tab-pane key="skills">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Puzzle class="w-4 h-4" />
            {{ $t('claw.resource.tabSkills') }}
          </span>
        </template>
        <ResourceSkill />
      </a-tab-pane>
      <a-tab-pane key="modelmonitor">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <BarChart2 class="w-4 h-4" />
            {{ $t('claw.resource.tabModelMonitor') }}
          </span>
        </template>
        <DashboardModelLog />
      </a-tab-pane>
      <a-tab-pane key="os">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <Monitor class="w-4 h-4" />
            {{ $t('claw.resource.tabOS') }}
          </span>
        </template>
        <OSMonitor />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BarChart2 from '~icons/lucide/bar-chart-2'
import Monitor from '~icons/lucide/monitor'
import Plug from '~icons/lucide/plug'
import Puzzle from '~icons/lucide/puzzle'
import Server from '~icons/lucide/server'
import OSMonitor from '../../../ui/src/components/OSMonitor.vue'
import DashboardModelLog from '../../../ui/src/views/Dashboard/DashboardModelLog.vue'
import ResourceMcp from './Resource/ResourceMcp.vue'
import ResourceRuntime from './Resource/ResourceRuntime.vue'
import ResourceSkill from './Resource/ResourceSkill.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const route = useRoute()
const router = useRouter()
const activeTab = ref((route.query.tab as string) || 'runtime')
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
