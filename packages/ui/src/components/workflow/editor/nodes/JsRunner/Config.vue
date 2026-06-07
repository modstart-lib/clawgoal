<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const code = ref('')
watch(
  () => props.properties?.data?.code,
  (v) => {
    code.value = v || ''
  },
  { immediate: true }
)
function sync() {
  emit('update:properties', { data: { code: code.value } })
}
</script>

<template>
  <div class="p-2">
    <div class="text-xs text-gray-500 mb-1">
      {{ t('workflowEditor.jsInputHint') }}
    </div>
    <a-textarea
      v-model:value="code"
      :rows="10"
      :placeholder="t('workflowEditor.jsPlaceholder')"
      class="font-mono text-xs"
      @change="sync"
    />
  </div>
</template>
