<script setup lang="ts">
import PageMenu from '@/components/PageMenu.vue'
import type { Agent } from '@/types'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BrainCircuit,
  ClipboardList,
  Clock,
  FileText,
  Layers,
  Settings,
  Sparkles,
} from 'lucide-vue-next'
import AgentDetailConfig from './AgentDetailConfig.vue'
import AgentDetailCron from './AgentDetailCron.vue'
import AgentDetailMemory from './AgentDetailMemory.vue'
import AgentDetailSetting from './AgentDetailSetting.vue'
import AgentDetailSoul from './AgentDetailSoul.vue'
import AgentDetailTask from './AgentDetailTask.vue'
import AgentDetailWorkflow from './AgentDetailWorkflow.vue'
import { computed, onMounted, onUnmounted } from 'vue'
import { testActionSet, testActionUnset } from '@/utils/test'

defineProps<{
  open: boolean
  agentId: number
  agent: Agent | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: [patch: Partial<Agent>]
}>()

const { t } = useI18n()

const activeMenu = ref('workItems')

onMounted(() => {
  testActionSet('config.switchMenu', (menu: string) => {
    activeMenu.value = menu
  })
})
onUnmounted(() => {
  testActionUnset('config.switchMenu')
})

const menuItems = computed(() => [
  {
    key: 'workItems',
    label: t('claw.agent.menuWorkItems'),
    icon: ClipboardList,
  },
  { key: 'cron', label: t('claw.agent.menuCron'), icon: Clock },
  { key: 'memory', label: t('claw.agent.tabMemory'), icon: BrainCircuit },
  { key: 'soul', label: t('claw.agent.menuSoul'), icon: Sparkles },
  { key: 'workflow', label: t('claw.agent.menuWorkflow'), icon: Layers },
  { key: 'config', label: t('claw.agent.tabConfig'), icon: FileText },
  { key: 'settings', label: t('claw.agent.settingsTitle'), icon: Settings },
])
</script>

<template>
  <a-modal
    :open="open"
    :title="t('claw.agent.settingsTitle')"
    width="95vw"
    :footer="null"
    destroy-on-close
    @update:open="emit('update:open', $event)"
  >
    <div class="flex gap-4" style="min-height: 60vh">
      <PageMenu v-model="activeMenu" :items="menuItems" />
      <div class="flex-1 min-w-0 overflow-auto">
        <AgentDetailTask
          v-if="activeMenu === 'workItems'"
          :agent-id="agentId"
        />
        <AgentDetailCron
          v-else-if="activeMenu === 'cron'"
          :agent-id="agentId"
        />
        <AgentDetailMemory
          v-else-if="activeMenu === 'memory'"
          :agent-id="agentId"
        />
        <AgentDetailSoul
          v-else-if="activeMenu === 'soul'"
          :agent-id="agentId"
        />
        <AgentDetailWorkflow
          v-else-if="activeMenu === 'workflow' && agent"
          :agent="agent"
        />
        <AgentDetailConfig v-else-if="activeMenu === 'config'" />
        <AgentDetailSetting
          v-else-if="activeMenu === 'settings' && agent"
          :agent="agent"
          @updated="emit('updated', $event)"
        />
      </div>
    </div>
  </a-modal>
</template>
