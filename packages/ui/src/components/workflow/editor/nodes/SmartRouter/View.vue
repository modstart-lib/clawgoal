<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import NodeViewHeader from '../../components/NodeViewHeader.vue'
import NodeInfoTag from '../../components/NodeInfoTag.vue'

const { t } = useI18n()
const props = defineProps<{ node: any; properties: any }>()

const branches = computed(() => {
  const bs = props.properties?.data?.branches
  if (bs && Array.isArray(bs) && bs.length > 0) {
    return [
      ...bs.map((b: any) => ({ id: b.id, label: b.name })),
      { id: 'default', label: t('workflowEditor.routerDefault') },
    ]
  }
  return []
})
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 w-[220px]">
    <NodeViewHeader :node="node" :properties="properties" />
    <div class="flex flex-col justify-evenly py-1 min-h-[40px]">
      <div
        v-for="branch in branches"
        :key="branch.id"
        class="relative flex items-center justify-end pl-2 pr-4 py-0.5"
      >
        <span class="text-xs text-gray-500 truncate max-w-[140px]">{{
          branch.label
        }}</span>
        <span
          class="absolute -right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-indigo-400 bg-white shrink-0 z-10"
        ></span>
      </div>
    </div>
    <div v-if="properties?.nodeInfo" class="px-2 pb-2">
      <NodeInfoTag
        :summary="properties.nodeInfo.summary"
        :details="properties.nodeInfo.details"
      />
    </div>
  </div>
</template>
