<script setup lang="ts">
import { getProjectSummaryMarkdown } from '@/claw/api/project'
import LoadingState from '@/components/LoadingState.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()
const props = defineProps<{ projectId: number }>()

const loading = ref(false)
const summary = ref('')

async function load() {
  loading.value = true
  try {
    summary.value = await getProjectSummaryMarkdown(props.projectId)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  testActionSet('summary.refresh', () => load())
})
onUnmounted(() => {
  testActionUnset('summary.refresh')
})
</script>

<template>
  <div class="pt-4">
    <LoadingState :loading="loading">
      <MarkdownViewer v-if="summary" :content="summary" />
      <div
        v-else
        class="flex items-center justify-center py-16 text-gray-400 text-sm"
      >
        {{ t('claw.project.summaryEmpty') }}
      </div>
    </LoadingState>
  </div>
</template>
