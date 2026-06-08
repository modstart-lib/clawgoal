<script setup lang="ts">
/**
 * ChannelViewer — 渠道列表只读展示
 *
 * Props:
 *   value     number[]  渠道 ID 列表
 *   channels  ChannelConfig[]  全部渠道列表（通常由父组件注入避免重复请求）
 *
 * 如果未传 channels 则组件自行请求。
 */
import { getChannelList, type ChannelConfig } from '@/claw/api/channel'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  value?: number[]
  channels?: ChannelConfig[]
}>()

const localChannels = ref<ChannelConfig[]>([])

onMounted(async () => {
  if (!props.channels) {
    localChannels.value = await getChannelList().catch(() => [])
  }
})

const allChannels = computed(() => props.channels ?? localChannels.value)

const selected = computed(() =>
  (props.value ?? [])
    .map((id) => allChannels.value.find((b) => b.id === id))
    .filter((b): b is ChannelConfig => !!b)
)
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <template v-if="selected.length > 0">
      <a-tag
        v-for="b in selected"
        :key="b.id"
        :color="b.type === 'telegram' ? 'blue' : 'green'"
        class="text-xs"
      >
        {{ b.title }}
      </a-tag>
    </template>
    <span v-else class="text-sm text-gray-400">{{
      t('claw.compChannelViewer.empty')
    }}</span>
  </div>
</template>
