<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SystemDirSelector from './SystemDirSelector.vue'

const { t } = useI18n()

const emit = defineEmits<{
  select: [path: string]
}>()

const open = ref(false)

function handleSelect(path: string) {
  emit('select', path)
}
</script>

<template>
  <a-button type="primary" @click="open = true">{{
    t('common.select')
  }}</a-button>
  <SystemDirSelector v-model:open="open" @select="handleSelect" />
</template>
