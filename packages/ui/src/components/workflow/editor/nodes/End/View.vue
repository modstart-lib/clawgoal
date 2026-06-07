<script setup lang="ts">
import NodeViewHeader from '../../components/NodeViewHeader.vue'
defineProps<{ node: any; properties: any }>()
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 w-[220px]">
    <NodeViewHeader :node="node" :properties="properties" />
  </div>
</template>
