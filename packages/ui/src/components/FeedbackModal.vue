<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { AppConfig } from '@/config'
import apiClient from '@/api/client'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const iframeHeight = ref('700px')

async function handleMessage(e: MessageEvent) {
  if (e.data?.type === 'FeedbackTicket:env') {
    try {
      const res = await apiClient.post('/system/collectEnv')
      e.source?.postMessage(
        { type: 'FeedbackTicket:env', data: res.data.data },
        { targetOrigin: '*' } as any
      )
    } catch {
      e.source?.postMessage({ type: 'FeedbackTicket:env', data: {} }, {
        targetOrigin: '*',
      } as any)
    }
  } else if (e.data?.type === 'FeedbackTicket:log') {
    try {
      const option = e.data.option ?? {}
      const res = await apiClient.post('/system/collectLog', option)
      e.source?.postMessage(
        { type: 'FeedbackTicket:log', data: res.data.data },
        { targetOrigin: '*' } as any
      )
    } catch {
      e.source?.postMessage(
        {
          type: 'FeedbackTicket:log',
          data: { logs: '', startTime: '', endTime: '' },
        },
        { targetOrigin: '*' } as any
      )
    }
  } else if (
    e.data?.type === 'FeedbackTicket:resize' &&
    typeof e.data.height === 'number'
  ) {
    iframeHeight.value = `${e.data.height}px`
  }
}

onMounted(() => window.addEventListener('message', handleMessage))
onBeforeUnmount(() => window.removeEventListener('message', handleMessage))
</script>

<template>
  <a-modal
    :title="$t('mainLayout.feedback')"
    width="min(700px, 90vw)"
    :open="open"
    :footer="null"
    :keyboard="true"
    :mask-closable="true"
    :body-style="{ padding: 0, overflow: 'hidden', borderRadius: '1rem' }"
    @cancel="emit('update:open', false)"
  >
    <iframe
      :src="AppConfig.feedbackUrl"
      class="w-full border-0 block"
      :style="{ height: iframeHeight, overflow: 'hidden' }"
      allow="clipboard-write"
      scrolling="no"
    />
  </a-modal>
</template>
