<template>
  <div class="flex items-center gap-2 mb-6 w-max">
    <div
      v-if="showBack"
      class="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
      @click="handleBack"
    >
      <ArrowLeft class="w-5 h-5" />
    </div>
    <div
      class="flex items-center gap-2.5 text-sm bg-primary-50/40 dark:bg-primary-900/20 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 backdrop-blur-md"
    >
      <template v-for="(item, index) in items" :key="index">
        <ChevronRight
          v-if="index > 0"
          class="w-3.5 h-3.5 text-primary-400 dark:text-primary-500 shrink-0"
        />
        <span
          v-if="item.path"
          class="cursor-pointer font-medium text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
          @click="router.push(item.path)"
          >{{ item.label }}</span
        >
        <span
          v-else
          class="font-extrabold tracking-wide text-primary-800 dark:text-primary-100"
          >{{ item.label }}</span
        >
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import ArrowLeft from '~icons/lucide/arrow-left'
import ChevronRight from '~icons/lucide/chevron-right'

interface BreadcrumbItem {
  label: string
  path?: string
}

const props = defineProps<{
  items: BreadcrumbItem[]
  showBack?: boolean
  backPath?: string
}>()

const router = useRouter()

function handleBack() {
  if (props.backPath) {
    router.push(props.backPath)
  } else {
    router.back()
  }
}
</script>
