<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { nodeIconMap, DefaultNodeIcon } from '../core/nodeIconMap'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  PauseCircle,
  PlayCircle,
  MinusCircle,
  MousePointerClick,
} from 'lucide-vue-next'
import { dispatchAsksAction } from '@/composables/asksActionBus'

const props = defineProps<{
  node: any
  properties: any
}>()

function handleAsksAction() {
  dispatchAsksAction()
}

const { t } = useI18n()

const nodeIcon = computed(
  () =>
    nodeIconMap[props.node?.type] ??
    nodeIconMap[props.properties?.data?.functionCallName] ??
    DefaultNodeIcon
)

const statusInfo = computed(() => {
  const s = props.properties?.status
  const msg = props.properties?.statusMsg || ''
  switch (s) {
    case 'running':
      return {
        icon: Loader2,
        color: 'text-blue-500',
        spin: true,
        tip: t('workflowEditor.running'),
      }
    case 'success':
      return {
        icon: CheckCircle2,
        color: 'text-green-500',
        spin: false,
        tip: t('workflowEditor.runSuccess'),
      }
    case 'success_ignore':
      return {
        icon: MinusCircle,
        color: 'text-gray-400',
        spin: false,
        tip: t('workflowEditor.branchInactive'),
      }
    case 'error':
      return {
        icon: XCircle,
        color: 'text-red-500',
        spin: false,
        tip: msg || t('workflowEditor.runError'),
      }
    case 'pause':
      return {
        icon: PauseCircle,
        color: 'text-orange-500',
        spin: false,
        tip: msg || t('workflowEditor.paused'),
      }
    case 'idle':
      return {
        icon: PlayCircle,
        color: 'text-gray-400',
        spin: false,
        tip: t('workflowEditor.pending'),
      }
    default:
      return null
  }
})
</script>

<template>
  <div
    class="node-header flex items-center gap-2 px-3 py-2 border-b border-gray-100"
  >
    <component
      :is="nodeIcon"
      class="w-4 h-4 shrink-0 text-gray-600"
      aria-hidden="true"
    />
    <span class="flex-1 text-sm font-medium truncate">{{
      properties?.title
    }}</span>
    <a-button
      v-if="properties?.status === 'pause'"
      size="small"
      type="primary"
      class="inline-flex items-center gap-1 text-xs shrink-0"
      @click.stop="handleAsksAction"
    >
      <MousePointerClick class="w-3 h-3" aria-hidden="true" />{{
        t('workflowEditor.handleSelect')
      }}
    </a-button>
    <a-tooltip v-else-if="statusInfo" :title="statusInfo.tip" placement="top">
      <component
        :is="statusInfo.icon"
        :class="[
          'w-4 h-4 shrink-0',
          statusInfo.color,
          statusInfo.spin ? 'animate-spin' : '',
        ]"
        aria-hidden="true"
      />
    </a-tooltip>
  </div>
</template>
