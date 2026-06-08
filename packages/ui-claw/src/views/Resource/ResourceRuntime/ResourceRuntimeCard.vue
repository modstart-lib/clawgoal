<template>
  <div
    class="group flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 relative"
  >
    <!-- 顶部：图标 + 标题 + 状态 -->
    <div
      class="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 gap-3"
    >
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div
          class="w-10 h-10 shrink-0 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center"
        >
          <Server class="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div class="min-w-0 flex-1 flex items-center gap-2">
          <div
            class="text-base font-bold text-gray-900 dark:text-gray-100 truncate"
          >
            {{ connector.title }}
          </div>
          <a-tag v-if="isLocal" color="processing" class="!mr-0 shrink-0">{{
            t('claw.resource.localLabel')
          }}</a-tag>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="
            connector.status === 'online'
              ? 'bg-green-500'
              : 'bg-gray-300 dark:bg-gray-600'
          "
        ></span>
        <span
          class="text-xs"
          :class="
            connector.status === 'online'
              ? 'text-green-600 dark:text-green-400'
              : 'text-gray-500 dark:text-gray-400'
          "
        >
          {{
            connector.status === 'online'
              ? $t('claw.resource.online')
              : $t('claw.resource.offline')
          }}
        </span>
        <span
          v-if="connector.active_at"
          class="text-[10px] text-gray-400 dark:text-gray-500"
        >
          · <DatetimeViewer :value="connector.active_at" format="short" />
        </span>
      </div>
    </div>
    <!-- 中间：运行器 -->
    <div class="flex-1 px-4 pb-2 overflow-hidden">
      <!-- Runners list -->
      <div
        v-if="connector.runners && connector.runners.length > 0"
        class="mb-1"
      >
        <p class="text-[10px] text-gray-400 dark:text-gray-500 mb-1">
          {{ $t('claw.resource.runners') }}
        </p>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="runner in connector.runners"
            :key="runner.name"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border cursor-pointer transition-colors"
            :class="
              runner.enable !== false
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-gray-200 dark:border-gray-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600'
            "
            @click.stop="emit('open-runners', connector.id)"
          >
            <IDEIcon :name="runner.name" :size="10" class="shrink-0" />
            {{ runner.title }}
          </span>
        </div>
      </div>
      <div v-else-if="connector.status === 'online'">
        <p class="text-[10px] text-gray-400 dark:text-gray-500 italic">
          {{ $t('claw.resource.noRunners') }}
        </p>
      </div>
    </div>
    <!-- 底部：操作按钮 -->
    <div class="px-4 pb-3 flex items-center justify-between shrink-0 text-xs">
      <div class="flex items-center gap-2 overflow-hidden flex-1 mr-2">
        <a-tooltip :title="t('claw.common.copyIdTooltip')">
          <span
            class="text-gray-400 dark:text-gray-500 font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 shrink-0 bg-gray-50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 transition-colors"
            @click.stop="copyId"
            >#{{ connector.id }}</span
          >
        </a-tooltip>
        <span class="text-gray-400 dark:text-gray-500 font-mono truncate">
          {{ connector.name }}
        </span>
      </div>

      <div class="flex items-center justify-end shrink-0 gap-1.5">
        <a-button
          type="text"
          size="small"
          class="px-2"
          @click.stop="emit('open-runners', connector.id)"
        >
          <div
            class="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300"
          >
            <Settings class="w-3.5 h-3.5" aria-hidden="true" />
            {{ $t('claw.resource.toolsMenu') }}
          </div>
        </a-button>
        <a-button
          v-if="!isLocal"
          type="text"
          size="small"
          class="px-2"
          @click.stop="emit('copy-url', connector.token)"
        >
          <div
            class="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300"
          >
            <Copy class="w-3.5 h-3.5" aria-hidden="true" />
            {{ $t('claw.resource.copyUrl') }}
          </div>
        </a-button>
        <!-- 更多操作（本机运行环境不显示编辑/删除） -->
        <a-dropdown
          v-if="!isLocal"
          :trigger="['hover']"
          placement="bottomRight"
        >
          <a-button type="text" size="small" class="px-2" @click.stop>
            <MoreHorizontal class="w-4 h-4 text-gray-500" aria-hidden="true" />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item @click="emit('edit', connector.id)">
                <div class="flex items-center gap-2">
                  <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ $t('claw.resource.editBtn') }}
                </div>
              </a-menu-item>
              <a-menu-item
                class="!text-red-500"
                @click="emit('delete', connector.id)"
              >
                <div class="flex items-center gap-2">
                  <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ $t('claw.resource.deleteBtn') }}
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RuntimeRow } from '@/claw/api/runtime'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import IDEIcon from '@/components/IDEIcon.vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { copyText } from '@/utils/utils'
import Copy from '~icons/lucide/copy'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Server from '~icons/lucide/server'
import Settings from '~icons/lucide/settings'
import Trash2 from '~icons/lucide/trash-2'

const { t } = useI18n()
const props = defineProps<{ connector: RuntimeRow }>()

const isLocal = computed(() => props.connector.id === 0)

function copyId() {
  copyText(String(props.connector.id), t('claw.resource.idCopied'))
}

const emit = defineEmits<{
  (e: 'copy-url', token: string): void
  (e: 'edit', id: number): void
  (e: 'delete', id: number): void
  (e: 'open-runners', id: number): void
}>()
</script>
