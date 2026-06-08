<template>
  <div class="flex flex-col items-center justify-center py-8 px-4 text-center">
    <div
      class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3"
    >
      <component
        :is="icon ?? Inbox"
        class="w-5 h-5 text-gray-400 dark:text-gray-500"
        aria-hidden="true"
      />
    </div>
    <p class="text-sm text-gray-400 dark:text-gray-500 mb-2">
      {{ description ?? t('common.noData') }}
    </p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import Inbox from '~icons/lucide/inbox'

const { t } = useI18n()

defineProps<{
  description?: string
  icon?: Component
}>()
</script>
