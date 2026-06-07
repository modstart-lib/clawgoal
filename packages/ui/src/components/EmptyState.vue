<template>
  <div
    class="flex flex-col items-center justify-center py-20 bg-primary-50/30 dark:bg-primary-900/10 rounded-3xl border border-gray-200 dark:border-gray-700 backdrop-blur-sm transition-all hover:bg-primary-50/60 dark:hover:bg-primary-900/30"
  >
    <template v-if="loading">
      <div class="flex flex-col items-center gap-3">
        <div
          class="flex items-center justify-center p-3.5 rounded-full bg-primary-50 dark:bg-primary-900/30"
        >
          <Loader2
            class="w-6 h-6 animate-spin text-primary-500"
            aria-hidden="true"
          />
        </div>
        <span
          class="text-sm text-gray-400 dark:text-gray-500 tracking-widest"
          >{{ t('common.loading') }}</span
        >
      </div>
    </template>
    <template v-else>
      <a-empty
        :description="effectiveDescription"
        class="opacity-80 drop-shadow-sm"
      >
        <slot></slot>
      </a-empty>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Loader2 from '~icons/lucide/loader-2'

const { t } = useI18n()

const props = defineProps({
  description: {
    type: String,
    default: undefined,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const effectiveDescription = computed(
  () => props.description ?? t('common.noData')
)
</script>
