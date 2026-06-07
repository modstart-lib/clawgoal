<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const regex = ref('')
const flags = ref('g')
watch(
  () => props.properties?.data,
  (d) => {
    regex.value = d?.regex || ''
    flags.value = d?.flags || 'g'
  },
  { immediate: true }
)
function sync() {
  emit('update:properties', {
    data: { regex: regex.value, flags: flags.value },
  })
}
</script>

<template>
  <div class="p-2 space-y-2">
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.regexLabel') }}
      </div>
      <a-input
        v-model:value="regex"
        :placeholder="t('workflowEditor.regexPlaceholder')"
        @change="sync"
      />
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.regexFlags') }}
      </div>
      <a-input v-model:value="flags" placeholder="g/i/m" @change="sync" />
    </div>
  </div>
</template>
