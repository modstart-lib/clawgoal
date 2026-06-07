<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  properties: any
  emptyText?: string
}>()
</script>

<template>
  <div v-if="properties?.inputFields?.length > 0" class="space-y-1">
    <div
      v-for="field in properties.inputFields"
      :key="field.name"
      class="text-xs"
    >
      <span class="text-gray-500">{{ field.name }}:</span>
      <span class="ml-1 text-gray-700 break-all">
        {{ field.value != null ? field.value : (field.defaultValue ?? '') }}
      </span>
    </div>
  </div>
  <div v-else class="text-xs text-gray-400">
    {{ emptyText || t('workflowEditor.noParams') }}
  </div>
</template>
