<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownViewer from './MarkdownViewer.vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    text: string
    lines?: number
    dialogShowFull?: boolean
    size?: 'default' | 'small'
  }>(),
  { lines: 2, dialogShowFull: false, size: 'default' }
)

const markdownTextSize = computed(() =>
  props.size === 'small' ? 'xs' : 'base'
)

const expanded = ref(false)
const dialogVisible = ref(false)
const contentRef = ref<HTMLElement | null>(null)
const needsExpand = ref(false)

const maxHeight = computed(() => `${props.lines * 1.5}rem`)

const checkOverflow = async () => {
  await nextTick()
  if (!contentRef.value) return
  needsExpand.value =
    contentRef.value.scrollHeight > contentRef.value.clientHeight + 2
}

onMounted(checkOverflow)
watch(
  () => props.text,
  () => {
    expanded.value = false
    checkOverflow()
  }
)

const handleToggle = () => {
  if (props.dialogShowFull) {
    dialogVisible.value = true
  } else {
    expanded.value = !expanded.value
  }
}
</script>

<template>
  <div v-if="text">
    <div
      ref="contentRef"
      :style="!expanded ? { maxHeight: maxHeight, overflow: 'hidden' } : {}"
    >
      <MarkdownViewer :content="text" :text-size="markdownTextSize" />
    </div>
    <div
      v-if="needsExpand || expanded"
      class="mt-0.5 text-xs text-primary-500 cursor-pointer select-none hover:text-primary-600 transition-colors"
      @click="handleToggle"
    >
      {{ expanded ? t('common.collapse') : t('common.expand') }}
    </div>
    <a-modal
      v-if="dialogShowFull"
      v-model:open="dialogVisible"
      :keyboard="false"
      :footer="null"
      width="95vw"
    >
      <div class="max-h-[70vh] overflow-y-auto py-2">
        <MarkdownViewer :content="text" />
      </div>
    </a-modal>
  </div>
</template>
