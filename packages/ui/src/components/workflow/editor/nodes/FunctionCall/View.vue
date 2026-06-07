<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import NodeViewHeader from '../../components/NodeViewHeader.vue'
import NodeInfoTag from '../../components/NodeInfoTag.vue'
import { getFunctionCallNodes } from './lib'

const props = defineProps<{ node: any; properties: any }>()

const { t } = useI18n()

const nodeDef = computed(() =>
  getFunctionCallNodes().find(
    (n) => n.name === props.properties?.data?.functionCallName
  )
)
</script>

<template>
  <component
    :is="nodeDef.viewComp"
    v-if="nodeDef?.viewComp"
    :node="node"
    :properties="properties"
  />
  <div
    v-else
    class="bg-white rounded-lg shadow-sm border border-gray-200 w-[220px]"
  >
    <NodeViewHeader :node="node" :properties="properties" />
    <div class="p-2 space-y-1">
      <div
        v-if="properties?.data?.functionCallName"
        class="text-xs text-gray-500"
      >
        {{ t('workflowEditor.funcCallLabel') }}:
        {{ properties.data.functionCallName }}
      </div>
      <NodeInfoTag
        v-if="properties?.nodeInfo"
        :summary="properties.nodeInfo.summary"
        :details="properties.nodeInfo.details"
      />
    </div>
  </div>
</template>
