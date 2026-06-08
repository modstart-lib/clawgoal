<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const form = ref({
  method: 'GET',
  url: '',
  headers: '',
  body: '',
})

watch(
  () => props.properties?.data,
  (d) => {
    if (d) {
      form.value.method = d.method || 'GET'
      form.value.url = d.url || ''
      form.value.headers = d.headers || ''
      form.value.body = d.body || ''
    }
  },
  { immediate: true }
)

function update() {
  emit('update:properties', { data: { ...form.value } })
}
</script>

<template>
  <div class="p-3 space-y-2">
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.httpMethod') }}
      </div>
      <a-select
        v-model:value="form.method"
        style="width: 100%"
        @change="update"
      >
        <a-select-option value="GET">GET</a-select-option>
        <a-select-option value="POST">POST</a-select-option>
        <a-select-option value="PUT">PUT</a-select-option>
        <a-select-option value="DELETE">DELETE</a-select-option>
      </a-select>
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-1">URL</div>
      <a-input
        v-model:value="form.url"
        placeholder="https://example.com/api"
        @change="update"
      />
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.httpHeaders') }}
      </div>
      <a-textarea
        v-model:value="form.headers"
        :rows="3"
        placeholder='{"Content-Type":"application/json"}'
        @change="update"
      />
    </div>
    <div v-if="form.method !== 'GET'">
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.httpBody') }}
      </div>
      <a-textarea
        v-model:value="form.body"
        :rows="4"
        placeholder='{"key":"value"}'
        @change="update"
      />
    </div>
  </div>
</template>
