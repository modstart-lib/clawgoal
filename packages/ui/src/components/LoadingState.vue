<template>
  <template v-if="loading && !initialized">
    <div class="relative px-2">
      <a-skeleton active :paragraph="{ rows }" />
      <div
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 dark:bg-gray-900/70 backdrop-blur-[2px]"
      >
        <div
          class="flex items-center justify-center p-3.5 rounded-full bg-primary-50 dark:bg-primary-900/30"
        >
          <Loader2
            class="w-6 h-6 animate-spin text-primary-500"
            aria-hidden="true"
          />
        </div>
        <span
          class="font-medium tracking-widest uppercase text-gray-400 dark:text-gray-500"
          >{{ t('common.loading') }}</span
        >
      </div>
    </div>
  </template>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Loader2 from '~icons/lucide/loader-2'

const { t } = useI18n()

const props = withDefaults(defineProps<{ loading: boolean; rows?: number }>(), {
  rows: 6,
})

const initialized = ref(false)
watch(
  () => props.loading,
  (val) => {
    if (!val) initialized.value = true
  }
)
</script>
