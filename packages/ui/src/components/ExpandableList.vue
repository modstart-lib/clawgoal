<script setup lang="ts" generic="T">
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    items: T[]
    maxRows?: number
  }>(),
  {
    maxRows: 3,
  }
)

const { t } = useI18n()
const expanded = ref(false)
const hasMore = computed(() => props.items.length > props.maxRows)
const visibleItems = computed(() =>
  expanded.value ? props.items : props.items.slice(0, props.maxRows)
)
</script>

<template>
  <div class="flex flex-col w-full">
    <div class="flex flex-col relative w-full">
      <div v-for="(item, index) in visibleItems" :key="index" class="w-full">
        <slot :item="item" :index="index" />
      </div>
    </div>
    <div v-if="hasMore" class="flex justify-center relative z-10">
      <div
        class="group inline-flex items-center justify-center gap-2 px-4 py-1 rounded-full bg-gray-50/60 dark:bg-gray-800/60 backdrop-blur-xl hover:bg-white/90 dark:hover:bg-gray-700/80 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-md select-none"
        @click.stop="expanded = !expanded"
      >
        <template v-if="expanded">
          <ChevronUp
            class="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
          <span>{{ t('expandableList.collapse') }}</span>
        </template>
        <template v-else>
          <ChevronDown
            class="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-y-0.5"
            aria-hidden="true"
          />
          <span
            >{{ t('expandableList.expandAll') }} {{ items.length }}
            {{ t('expandableList.stepsUnit') }}</span
          >
        </template>
      </div>
    </div>
  </div>
</template>
