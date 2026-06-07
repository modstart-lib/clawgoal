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
      <div
        v-if="properties?.data?.question"
        class="text-gray-600 truncate font-medium"
      >
        {{ properties.data.question }}
      </div>
      <div
        v-for="opt in properties?.data?.options || []"
        :key="opt.id"
        class="flex items-center gap-1"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
        <span class="truncate">{{ opt.label }}</span>
      </div>
      <div v-if="!properties?.data?.options?.length" class="text-gray-400">
        {{ t('workflowEditor.asksNoOptions') }}
      </div>
    </div>
  </div>
</template>
