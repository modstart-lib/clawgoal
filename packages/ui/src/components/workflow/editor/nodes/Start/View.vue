<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import NodeViewHeader from '../../components/NodeViewHeader.vue'
import NodeViewInputFields from '../../components/NodeViewInputFields.vue'

const { t } = useI18n()
defineProps<{ node: any; properties: any }>()
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 w-[220px]">
    <NodeViewHeader :node="node" :properties="properties" />
    <div class="p-2">
      <NodeViewInputFields
        :properties="properties"
        :empty-text="t('workflowEditor.startClickToSet')"
      />
    </div>
  </div>
</template>
