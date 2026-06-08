<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{ text: string; lines?: number; dialogShowFull?: boolean }>(),
  {
    lines: 2,
    dialogShowFull: false,
  }
)

const expanded = ref(false)
const dialogVisible = ref(false)
const textRef = ref<HTMLElement | null>(null)
const needsExpand = ref(false)

const checkOverflow = async () => {
  await nextTick()
  if (!textRef.value) return
  needsExpand.value = textRef.value.scrollHeight > textRef.value.clientHeight
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
      ref="textRef"
      class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-wrap wrap-break-word"
      :style="
        !expanded
          ? {
              display: '-webkit-box',
              WebkitLineClamp: lines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }
          : {}
      "
    >
      {{ text }}
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
      width="min(600px, 90vw)"
    >
      <div
        class="whitespace-pre-wrap wrap-break-word text-sm text-gray-700 dark:text-gray-300 leading-relaxed pt-2"
      >
        {{ text }}
      </div>
    </a-modal>
  </div>
</template>
