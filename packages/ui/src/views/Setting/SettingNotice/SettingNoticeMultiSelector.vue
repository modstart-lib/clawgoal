<script setup lang="ts">
import type { NoticeItem } from '@/api/notice.ts'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  value: number[]
  notices: NoticeItem[]
}>()
const emit = defineEmits<{ 'update:value': [value: number[]] }>()
const { t } = useI18n()

function handleChange(val: number[]) {
  emit('update:value', val ?? [])
}
</script>

<template>
  <a-select
    mode="multiple"
    :value="props.value"
    style="width: 100%"
    :placeholder="t('settingNoticeSettings.defaultChannelPlaceholder')"
    allow-clear
    :options="props.notices.map((n) => ({ value: n.id, label: n.title }))"
    @change="handleChange"
  />
</template>
