<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import NodeViewHeader from '../../components/NodeViewHeader.vue'

const { t } = useI18n()
defineProps<{ node: any; properties: any }>()
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 w-[220px]">
    <NodeViewHeader :node="node" :properties="properties" />
    <div class="p-2 text-xs text-gray-500 space-y-0.5">
      <div class="flex items-center gap-1">
        <span
          class="font-mono text-blue-600 uppercase text-[10px] bg-blue-50 px-1 rounded"
        >
          {{ properties?.data?.method || 'GET' }}
        </span>
        <span class="truncate">{{
          properties?.data?.url || t('workflowEditor.httpNoUrl')
        }}</span>
      </div>
    </div>
  </div>
</template>
