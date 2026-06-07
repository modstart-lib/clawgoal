<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import NodeViewHeader from '../../components/NodeViewHeader.vue'
import NodeInfoTag from '../../components/NodeInfoTag.vue'
import ModelViewer from '@/components/ModelViewer.vue'

const { t } = useI18n()
defineProps<{ node: any; properties: any }>()
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 w-[220px]">
    <NodeViewHeader :node="node" :properties="properties" />
    <div class="p-2 space-y-1">
      <ModelViewer
        v-if="properties?.data?.model"
        :value="properties.data.model"
        class="w-full"
      />
      <div v-else class="text-xs text-gray-400">
        {{ properties?.modelSlot ?? t('workflowEditor.llmNotConfigured') }}
      </div>
      <NodeInfoTag
        v-if="properties?.nodeInfo"
        :summary="properties.nodeInfo.summary"
        :details="properties.nodeInfo.details"
      />
    </div>
  </div>
</template>
