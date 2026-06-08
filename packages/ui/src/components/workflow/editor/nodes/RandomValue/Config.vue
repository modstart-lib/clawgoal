<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const values = ref<string[]>([])
watch(
  () => props.properties?.data?.values,
  (v) => {
    values.value = JSON.parse(JSON.stringify(v || []))
  },
  { immediate: true }
)

function addVal() {
  values.value.push('')
  sync()
}
function removeVal(i: number) {
  values.value.splice(i, 1)
  sync()
}
function sync() {
  emit('update:properties', {
    data: { values: JSON.parse(JSON.stringify(values.value)) },
  })
}
</script>

<template>
  <div class="p-2">
    <div v-for="(_, i) in values" :key="i" class="flex gap-1 mb-1">
      <a-input
        v-model:value="values[i]"
        :placeholder="t('workflowEditor.randomValuePlaceholder')"
        class="flex-1"
        @change="sync"
      />
      <a-button danger class="inline-flex items-center" @click="removeVal(i)"
        ><span>×</span></a-button
      >
    </div>
    <div v-if="!values.length" class="text-xs text-gray-400 py-2 text-center">
      {{ t('workflowEditor.randomNoValues') }}
    </div>
    <a-button class="mt-1 w-full" @click="addVal">{{
      t('workflowEditor.randomAddValue')
    }}</a-button>
  </div>
</template>
