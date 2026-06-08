<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import NodeViewHeader from '../../components/NodeViewHeader.vue'

const { t } = useI18n()
const props = defineProps<{ node: any; properties: any }>()

const branches = computed(() => {
  const conds = props.properties?.data?.conditions
  if (conds && Array.isArray(conds) && conds.length > 0) {
    return [
      ...conds.map((c: any) => ({ id: c.id, label: c.label })),
      { id: 'else', label: t('workflowEditor.ifElseElseLabel') },
    ]
  }
  // 旧格式兼容
  return [
    { id: 'output_default', label: t('workflowEditor.ifElseYes') },
    { id: 'output_else', label: t('workflowEditor.ifElseNo') },
  ]
})
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 w-[220px]">
    <NodeViewHeader :node="node" :properties="properties" />
    <div class="flex flex-col justify-evenly py-1 min-h-[40px]">
      <div
        v-for="branch in branches"
        :key="branch.id"
        class="flex items-center justify-end px-2 py-0.5"
      >
        <span class="text-xs text-gray-500 truncate max-w-[140px]">{{
          branch.label
        }}</span>
        <span
          class="ml-1 w-2 h-2 rounded-full border border-indigo-400 bg-white shrink-0"
        ></span>
      </div>
    </div>
  </div>
</template>
