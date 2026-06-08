<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const fields = ref<any[]>([])
watch(
  () => props.properties?.inputFields,
  (v) => {
    fields.value = JSON.parse(JSON.stringify(v || []))
  },
  { immediate: true }
)

function addField() {
  fields.value.push({
    name: `${t('workflowEditor.startFieldPrefix')}${fields.value.length + 1}`,
    type: 'text',
    value: '',
    placeholder: '',
  })
  sync()
}
function removeField(i: number) {
  fields.value.splice(i, 1)
  sync()
}
function sync() {
  emit('update:properties', {
    inputFields: JSON.parse(JSON.stringify(fields.value)),
    outputFields: JSON.parse(JSON.stringify(fields.value)),
  })
}
</script>

<template>
  <div class="p-2">
    <div
      v-for="(field, i) in fields"
      :key="i"
      class="flex items-center gap-1 mb-1"
    >
      <a-input
        v-model:value="field.name"
        :placeholder="t('workflowEditor.startFieldName')"
        class="w-24"
        @change="sync"
      />
      <a-input
        v-model:value="field.value"
        :placeholder="t('workflowEditor.startDefaultValue')"
        class="flex-1"
        @change="sync"
      />
      <a-button danger class="inline-flex items-center" @click="removeField(i)">
        <span>×</span>
      </a-button>
    </div>
    <div
      v-if="fields.length === 0"
      class="text-xs text-gray-400 py-2 text-center"
    >
      {{ t('workflowEditor.startNoFields') }}
    </div>
    <a-button class="mt-1 w-full" @click="addField">{{
      t('workflowEditor.startAddField')
    }}</a-button>
  </div>
</template>
