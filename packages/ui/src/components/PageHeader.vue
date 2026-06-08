<template>
  <div
    class="flex flex-wrap justify-between items-center gap-4 mb-4 relative py-1"
  >
    <div class="flex items-center gap-3 relative z-10">
      <div
        class="w-1.5 h-7 bg-gradient-to-b from-primary to-primary-hover rounded-full shadow-primary/30"
      ></div>
      <div
        class="text-2xl md:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-hover dark:from-primary-400 dark:to-primary-hover drop-shadow-sm"
      >
        {{ title }}
      </div>
    </div>
    <div v-if="$slots.action" class="flex gap-3 items-center relative z-10">
      <slot name="action"></slot>
      <slot name="extra"></slot>
    </div>
  </div>
</template>

<script setup>
/**
 * PageHeader generic page header component
 *
 * @prop {string} title - Page title
 * @slot action - Action buttons slot (right side)
 */
defineProps({
  title: {
    type: String,
    required: true,
  },
})
</script>
