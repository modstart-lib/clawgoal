<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const ms = ref(1000)

watch(
  () => props.properties?.data?.ms,
  (v) => {
    ms.value = v ?? 1000
  },
  { immediate: true }
)

function update() {
  emit('update:properties', { data: { ms: ms.value } })
}
</script>

<template>
  <div class="p-3 space-y-2">
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.delayMs') }}
      </div>
      <a-input-number
        v-model:value="ms"
        :min="0"
        :max="60000"
        :step="500"
        style="width: 100%"
        @change="update"
      />
    </div>
  </div>
</template>
