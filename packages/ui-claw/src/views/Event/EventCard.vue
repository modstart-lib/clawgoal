<script setup lang="ts">
import type { ProjectEvent } from '@/claw/api/project'
import { copyText } from '@/utils/utils'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Trash2 from '~icons/lucide/trash-2'
import Share2 from '~icons/lucide/share-2'
import Link2 from '~icons/lucide/link-2'
import ShareOff from '~icons/lucide/link-2-off'
import CalendarDays from '~icons/lucide/calendar-days'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  item: ProjectEvent
  canShare?: boolean
}>()

const emit = defineEmits<{
  view: [item: ProjectEvent]
  edit: [item: ProjectEvent]
  delete: [item: ProjectEvent]
  share: [item: ProjectEvent]
  unshare: [item: ProjectEvent]
  copyShareLink: [item: ProjectEvent]
}>()
</script>

<template>
  <div
    class="group flex flex-col bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl transition-all hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-600 cursor-pointer"
    @click="emit('view', item)"
  >
    <!-- 第一行：标题 + 类型标签（居右） -->
    <div class="flex items-center gap-2 px-4 pt-3 pb-1">
      <span
        class="text-sm font-medium flex-1 min-w-0 truncate text-gray-900 dark:text-gray-100"
        :title="item.title"
        >{{ item.title }}</span
      >
      <span
        v-if="item.type"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shrink-0"
        >{{ item.type }}</span
      >
    </div>

    <!-- 描述文字（灰色，超出截断） -->
    <div v-if="item.description" class="px-4 pb-1">
      <p class="text-xs text-gray-400 dark:text-gray-500 truncate">
        {{ item.description }}
      </p>
    </div>

    <!-- 最后一行：#ID + biz + 日期 | 更多操作 -->
    <div class="px-4 pb-3 flex items-center justify-between mt-auto">
      <!-- 左侧：ID + biz + 事件日期 -->
      <div class="flex items-center gap-2 overflow-hidden flex-1 mr-2">
        <span
          class="text-xs text-gray-400 dark:text-gray-500 font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          :title="t('claw.event.copyIdHint')"
          @click.stop="copyText(String(item.id))"
          >#{{ item.id }}</span
        >
        <span
          v-if="item.biz"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0"
          >{{ item.biz }}</span
        >
        <div
          v-if="item.day"
          class="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 shrink-0"
        >
          <CalendarDays class="w-3 h-3" aria-hidden="true" />
          <span>{{ item.day }}</span>
        </div>
      </div>

      <!-- 右侧：更多操作下拉 -->
      <div class="flex items-center gap-1 shrink-0">
        <a-dropdown :trigger="['hover']" placement="bottomRight">
          <a-button
            type="text"
            class="inline-flex items-center px-2"
            @click.stop
          >
            <MoreHorizontal class="w-4 h-4 text-gray-500" aria-hidden="true" />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item @click.stop="emit('edit', item)">
                <div class="flex items-center gap-2">
                  <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ t('claw.event.edit') }}
                </div>
              </a-menu-item>
              <a-menu-item
                v-if="canShare && !item.shareHash"
                @click.stop="emit('share', item)"
              >
                <div class="flex items-center gap-2">
                  <Share2 class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ t('claw.event.share') }}
                </div>
              </a-menu-item>
              <template v-else-if="canShare && item.shareHash">
                <a-menu-item @click.stop="emit('copyShareLink', item)">
                  <div class="flex items-center gap-2">
                    <Link2 class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('claw.event.shareLink') }}
                  </div>
                </a-menu-item>
                <a-menu-item @click.stop="emit('unshare', item)">
                  <div class="flex items-center gap-2">
                    <ShareOff class="w-3.5 h-3.5" aria-hidden="true" />
                    {{ t('claw.event.unshare') }}
                  </div>
                </a-menu-item>
              </template>
              <a-menu-item
                class="!text-red-500"
                @click.stop="emit('delete', item)"
              >
                <div class="flex items-center gap-2">
                  <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ t('claw.event.delete') }}
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>
  </div>
</template>
