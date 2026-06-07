<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VariableInput from '../../components/VariableInput.vue'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const variables = ref<{ name: string; value: string }[]>([])
watch(
  () => props.properties?.data?.variables,
  (v) => {
    variables.value = JSON.parse(JSON.stringify(v || []))
  },
  { immediate: true }
)

function addVar() {
  variables.value.push({ name: '', value: '' })
  sync()
}
function removeVar(i: number) {
  variables.value.splice(i, 1)
  sync()
}
function sync() {
  emit('update:properties', {
    data: { variables: JSON.parse(JSON.stringify(variables.value)) },
  })
}
</script>

<template>
  <div class="p-2">
    <div v-for="(v, i) in variables" :key="i" class="flex gap-1 mb-1">
      <a-input
        v-model:value="v.name"
        :placeholder="t('workflowEditor.varNamePlaceholder')"
        class="w-24"
        @change="sync"
      />
      <VariableInput
        :model-value="v.value"
        :node-id="props.node?.id"
        :placeholder="t('workflowEditor.varValuePlaceholder')"
        class="flex-1"
        @change="
          (val: string) => {
            v.value = val
            sync()
          }
        "
      />
      <a-button danger class="inline-flex items-center" @click="removeVar(i)"
        ><span>×</span></a-button
      >
    </div>
    <div
      v-if="!variables.length"
      class="text-xs text-gray-400 py-2 text-center"
    >
      {{ t('workflowEditor.varNoVars') }}
    </div>
    <a-button class="mt-1 w-full" @click="addVar">{{
      t('workflowEditor.varAddVar')
    }}</a-button>
  </div>
</template>
