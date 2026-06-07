<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const ext = ref('')
watch(
  () => props.properties?.data,
  (d) => {
    ext.value = d?.ext || ''
  },
  { immediate: true }
)
function sync() {
  emit('update:properties', { data: { ext: ext.value } })
}
</script>

<template>
  <div class="p-2">
    <div class="text-xs text-gray-500 mb-1">
      {{ t('workflowEditor.fileListExtFilter') }}
    </div>
    <a-input v-model:value="ext" placeholder=".jpg" @change="sync" />
  </div>
</template>
