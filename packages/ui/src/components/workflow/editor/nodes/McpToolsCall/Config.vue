<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const serverUrl = ref('')
const selectedTool = ref('')
watch(
  () => props.properties?.data,
  (d) => {
    serverUrl.value = d?.serverUrl || ''
    selectedTool.value = d?.selectedTool || ''
  },
  { immediate: true }
)

function sync() {
  emit('update:properties', {
    data: { serverUrl: serverUrl.value, selectedTool: selectedTool.value },
  })
}
</script>

<template>
  <div class="p-2 space-y-2">
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.mcpServer') }}
      </div>
      <a-input
        v-model:value="serverUrl"
        placeholder="http://localhost:3001"
        @change="sync"
      />
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.mcpTool') }}
      </div>
      <a-input
        v-model:value="selectedTool"
        placeholder="tool_name"
        @change="sync"
      />
    </div>
  </div>
</template>
