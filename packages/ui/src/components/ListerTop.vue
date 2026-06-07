<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import { useI18n } from 'vue-i18n'
import Filter from '~icons/lucide/filter'
import RefreshCw from '~icons/lucide/refresh-cw'

defineProps<{
  loading?: boolean
  total?: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()
const filterExpanded = ref(false)
const slots = useSlots()
const hasFilters = computed(() => !!slots.default)
</script>

<template>
  <div class="mb-4">
    <!-- 大屏幕（md+）：次要操作区（筛选项）横向自动换行，主要操作区固定右上角 -->
    <div
      class="hidden md:grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2"
    >
      <div class="flex flex-wrap items-center gap-2">
        <div
          v-if="!hasFilters && total !== undefined"
          class="inline-flex items-center gap-1.5 text-gray-500 text-sm"
        >
          <span class="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          {{ t('listerTop.total', { n: total }) }}
        </div>
        <slot />
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <a-button :loading="loading" @click="emit('refresh')">
          <div class="inline-flex items-center justify-center gap-1">
            <RefreshCw v-if="!loading" class="w-4 h-4" />
            {{ t('listerTop.refresh') }}
          </div>
        </a-button>
        <slot name="actions" />
      </div>
    </div>

    <!-- 小屏幕：左筛选 + 中刷新 + 右主要操作区 -->
    <div class="flex gap-2 md:hidden">
      <div
        v-if="!hasFilters && total !== undefined"
        class="flex-1 inline-flex items-center gap-1.5 text-gray-500 text-sm"
      >
        <span class="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
        {{ t('listerTop.total', { n: total }) }}
      </div>
      <a-button
        v-if="hasFilters"
        class="flex-1"
        @click="filterExpanded = !filterExpanded"
      >
        <div class="inline-flex items-center justify-center gap-1">
          <Filter class="w-4 h-4" />
          {{ t('listerTop.filter') }}
        </div>
      </a-button>
      <a-button class="flex-1" :loading="loading" @click="emit('refresh')">
        <div class="inline-flex items-center justify-center gap-1">
          <RefreshCw v-if="!loading" class="w-4 h-4" />
          {{ t('listerTop.refresh') }}
        </div>
      </a-button>
      <div class="flex flex-1 gap-2 [&>*]:flex-1">
        <slot name="actions" />
      </div>
    </div>

    <!-- 小屏幕展开：次要操作区全部内容宽度撑满 -->
    <div v-if="filterExpanded" class="flex flex-col gap-2 mt-2 md:hidden">
      <slot />
    </div>
  </div>
</template>
