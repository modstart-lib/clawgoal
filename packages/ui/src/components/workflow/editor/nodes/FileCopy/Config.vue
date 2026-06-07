<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const overwrite = ref(false)
watch(
  () => props.properties?.data,
  (d) => {
    overwrite.value = d?.overwrite ?? false
  },
  { immediate: true }
)
function sync() {
  emit('update:properties', { data: { overwrite: overwrite.value } })
}
</script>

<template>
  <div class="p-2">
    <a-checkbox v-model:checked="overwrite" @change="sync">{{
      t('workflowEditor.fileOverwrite')
    }}</a-checkbox>
  </div>
</template>
