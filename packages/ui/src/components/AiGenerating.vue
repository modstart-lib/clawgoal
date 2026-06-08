<template>
  <div class="flex flex-col items-center justify-center py-6 select-none">
    <div class="relative w-10 h-10 mb-3">
      <div class="absolute inset-0 rounded-full ai-ring" />
      <div
        class="absolute inset-1.5 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center"
      >
        <Sparkles class="w-4 h-4 text-primary" aria-hidden="true" />
      </div>
    </div>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      {{ displayLabel() }}
    </p>
    <div class="flex items-center gap-1 mt-2">
      <span class="w-1.5 h-1.5 rounded-full bg-primary-400 ai-dot-1" />
      <span class="w-1.5 h-1.5 rounded-full bg-primary ai-dot-2" />
      <span class="w-1.5 h-1.5 rounded-full bg-primary-700 ai-dot-3" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Sparkles from '~icons/lucide/sparkles'

const { t } = useI18n()

const props = defineProps({
  label: { type: String, default: '' },
})

const displayLabel = () => props.label || t('aiGenerating.defaultLabel')
</script>

<style scoped>
.ai-ring {
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    var(--color-primary) 40%,
    transparent 70%
  );
  animation: ai-spin 1.4s linear infinite;
  border-radius: 9999px;
}

@keyframes ai-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.ai-dot-1 {
  animation: ai-bounce 1.2s ease-in-out infinite;
}
.ai-dot-2 {
  animation: ai-bounce 1.2s ease-in-out infinite 0.2s;
}
.ai-dot-3 {
  animation: ai-bounce 1.2s ease-in-out infinite 0.4s;
}

@keyframes ai-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1.2);
    opacity: 1;
  }
}
</style>
