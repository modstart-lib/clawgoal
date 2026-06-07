<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import NodeViewHeader from '../../components/NodeViewHeader.vue'

const { t } = useI18n()
defineProps<{ node: any; properties: any }>()
</script>
<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 w-[220px]">
    <NodeViewHeader :node="node" :properties="properties" />
    <div class="p-2 text-xs text-gray-500 space-y-1">
      <div>
        {{ t('workflowEditor.mcpServerLabel') }}:
        {{ properties?.data?.serverUrl || t('workflowEditor.notSet') }}
      </div>
      <div>
        {{ t('workflowEditor.mcpToolLabel') }}:
        {{ properties?.data?.selectedTool || t('workflowEditor.notSet') }}
      </div>
    </div>
  </div>
</template>
