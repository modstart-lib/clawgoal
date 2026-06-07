<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import NodeViewHeader from '../../components/NodeViewHeader.vue'

const { t } = useI18n()
defineProps<{ node: any; properties: any }>()
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 w-[220px]">
    <NodeViewHeader :node="node" :properties="properties" />
    <div class="p-2 text-xs text-gray-500">
      <span v-if="properties?.data?.ms"
        >{{ t('workflowEditor.delayLabel') }} {{ properties.data.ms }}ms</span
      >
      <span v-else class="text-gray-400">{{
        t('workflowEditor.delayNotSet')
      }}</span>
    </div>
  </div>
</template>
