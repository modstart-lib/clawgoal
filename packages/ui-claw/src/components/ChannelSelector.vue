<script setup lang="ts">
/**
 * ChannelSelector — 渠道多选下拉框
 *
 * Props:
 *   value    number[]  已选中的渠道 ID 列表
 *   disabled boolean   是否禁用
 *
 * Emits:
 *   update:value  (ids: number[]) => void
 *   change        (ids: number[]) => void
 */
import { getChannelList, type ChannelConfig } from '@/claw/api/channel'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

withDefaults(
  defineProps<{
    value?: number[]
    disabled?: boolean
  }>(),
  {
    value: () => [],
    disabled: false,
  }
)

const emit = defineEmits<{
  'update:value': [ids: number[]]
  change: [ids: number[]]
}>()

const channels = ref<ChannelConfig[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    channels.value = await getChannelList()
  } finally {
    loading.value = false
  }
})

const handleChange = (val: number[]) => {
  const unique = [...new Set(val)]
  emit('update:value', unique)
  emit('change', unique)
}

function channelTypeLabel(type: string): string {
  const { t } = useI18n()
  const map: Record<string, string> = {
    telegram: t('claw.compChannelSelector.typeTelegram'),
    feishu: t('claw.compChannelSelector.typeFeishu'),
    dingtalk: t('claw.compChannelSelector.typeDingtalk'),
    wecom: t('claw.compChannelSelector.typeWecom'),
    discord: t('claw.compChannelSelector.typeDiscord'),
    slack: t('claw.compChannelSelector.typeSlack'),
    msteams: t('claw.compChannelSelector.typeMsteams'),
    line: t('claw.compChannelSelector.typeLine'),
    matrix: t('claw.compChannelSelector.typeMatrix'),
    mattermost: t('claw.compChannelSelector.typeMattermost'),
  }
  return map[type] ?? type
}

function channelTypeColor(type: string): string {
  const map: Record<string, string> = {
    telegram: 'blue',
    feishu: 'green',
    dingtalk: 'orange',
    wecom: 'cyan',
    discord: 'purple',
    slack: 'magenta',
    msteams: 'geekblue',
    line: 'lime',
    matrix: 'volcano',
    mattermost: 'gold',
  }
  return map[type] ?? 'default'
}
</script>

<template>
  <a-select
    mode="multiple"
    :value="value"
    :disabled="disabled"
    :loading="loading"
    :placeholder="t('claw.compChannelSelector.placeholder')"
    allow-clear
    class="w-full"
    :options="
      channels.map((b) => ({
        value: b.id!,
        label: b.title,
        type: b.type,
        enable: b.enable,
      }))
    "
    option-label-prop="label"
    @change="handleChange"
  >
    <template #option="{ label, type, enable }">
      <div class="flex items-center gap-2">
        <a-tag :color="channelTypeColor(type)" class="shrink-0 text-xs">
          {{ channelTypeLabel(type) }}
        </a-tag>
        <span :class="{ 'text-gray-400': !enable }">{{ label }}</span>
        <span v-if="!enable" class="text-xs text-gray-400 ml-auto">{{
          t('claw.compChannelSelector.disabled')
        }}</span>
      </div>
    </template>
  </a-select>
</template>
