<template>
  <div
    class="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-2">
        <div
          :class="typeIconClass"
          class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        >
          <component :is="typeIcon" class="w-5 h-5" />
        </div>
        <div>
          <h3
            class="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight"
          >
            {{ mcp.title }}
          </h3>
          <span class="text-[10px] text-gray-400 font-mono">{{
            mcp.name
          }}</span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1">
        <span
          :class="typeTagClass"
          class="text-[10px] px-1.5 py-0.5 rounded font-medium"
          >{{ mcp.type }}</span
        >
        <span
          :class="statusDotClass"
          class="w-2 h-2 rounded-full inline-block mt-0.5"
        ></span>
      </div>
    </div>

    <a-tooltip :title="connectionInfo" placement="topLeft">
      <p
        class="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate mb-3 min-h-[18px]"
      >
        {{ connectionInfo }}
      </p>
    </a-tooltip>

    <a-tooltip
      v-if="mcp.description"
      :title="mcp.description"
      placement="topLeft"
    >
      <div class="text-xs text-gray-400 dark:text-gray-500 mb-3 truncate">
        {{ mcp.description }}
      </div>
    </a-tooltip>
    <div v-else class="mb-3 min-h-[20px]"></div>

    <!-- 工具标签区域：始终占位保持卡片高度一致 -->
    <div class="mb-3 min-h-[22px]">
      <div v-if="toolNames.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="tool in displayTools"
          :key="tool"
          class="text-[10px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-mono"
          >{{ tool }}</span
        >
        <span
          v-if="toolNames.length > maxDisplayTools"
          class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
          @click.stop="toolsModalOpen = true"
          >+{{ toolNames.length - maxDisplayTools }}</span
        >
      </div>
    </div>

    <div
      class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700"
    >
      <div class="flex items-center gap-2">
        <a-switch
          :checked="mcp.enable === 1"
          :loading="loading"
          @change="(v: boolean) => emit('toggle', v)"
        />
        <span
          class="text-[10px] text-gray-400 dark:text-gray-500 font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
          :title="t('claw.common.copyIdTooltip')"
          @click.stop="copyText(String(mcp.id))"
          >#{{ mcp.id }}</span
        >
      </div>
      <div class="flex items-center gap-1 ml-auto">
        <!-- 查看工具按钮：有工具数据时显示 -->
        <a-button
          v-if="toolNames.length > 0"
          type="text"
          class="flex items-center"
          :title="t('claw.resource.viewTools', { count: toolNames.length })"
          @click.stop="toolsModalOpen = true"
        >
          <Wrench class="w-4 h-4 text-green-500" aria-hidden="true" />
        </a-button>
        <a-dropdown :trigger="['hover']" placement="bottomRight">
          <a-button
            type="text"
            class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop
          >
            <MoreHorizontal class="w-4 h-4 text-gray-500" aria-hidden="true" />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item @click="emit('edit')">
                <div class="flex items-center gap-2">
                  <Pencil class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ $t('claw.resource.editBtn') }}
                </div>
              </a-menu-item>
              <a-menu-item @click="emit('copy')">
                <div class="flex items-center gap-2">
                  <Copy class="w-3.5 h-3.5" aria-hidden="true" />
                  {{ $t('claw.resource.copyMcp') }}
                </div>
              </a-menu-item>
              <a-menu-item class="!text-red-500" @click="emit('delete')">
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
  <!-- 查看工具弹窗 -->
  <ResourceMcpToolsModal
    v-if="toolsModalOpen"
    v-model:open="toolsModalOpen"
    :mcp="mcp"
  />
</template>

<script setup lang="ts">
import type { McpRow } from '@/claw/api/mcp'
import { copyText } from '@/utils/utils'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Copy from '~icons/lucide/copy'
import Globe from '~icons/lucide/globe'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Pencil from '~icons/lucide/pencil'
import Terminal from '~icons/lucide/terminal'
import Trash2 from '~icons/lucide/trash-2'
import Wrench from '~icons/lucide/wrench'
import Zap from '~icons/lucide/zap'
import ResourceMcpToolsModal from './ResourceMcpToolsModal.vue'

const { t } = useI18n()

const props = defineProps<{
  mcp: McpRow
  loading?: boolean
}>()
const emit = defineEmits<{
  (e: 'toggle', enable: boolean): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'copy'): void
}>()

const toolsModalOpen = ref(false)
const maxDisplayTools = 2

const toolNames = computed<string[]>(() => {
  if (!props.mcp.tools) return []
  return props.mcp.tools.map((t) => t.name)
})

const displayTools = computed(() => toolNames.value.slice(0, maxDisplayTools))

const typeIcon = computed(() => {
  if (props.mcp.type === 'stdio') return Terminal
  if (props.mcp.type === 'sse') return Zap
  return Globe
})

const typeIconClass = computed(() => {
  if (props.mcp.type === 'stdio')
    return 'bg-violet-50 dark:bg-violet-900/30 text-violet-500'
  if (props.mcp.type === 'sse')
    return 'bg-amber-50 dark:bg-amber-900/30 text-amber-500'
  return 'bg-primary-50 dark:bg-primary-900/30 text-primary-500'
})

const typeTagClass = computed(() => {
  if (props.mcp.type === 'stdio')
    return 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
  if (props.mcp.type === 'sse')
    return 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
  return 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
})

const statusDotClass = computed(() => {
  if (props.mcp.status === 'connected') return 'bg-green-400'
  if (props.mcp.status === 'error') return 'bg-red-400'
  return 'bg-gray-300 dark:bg-gray-600'
})

const connectionInfo = computed(() => {
  if (!props.mcp.config) return t('claw.resource.notConfigured')
  const cfg = props.mcp.config as any
  if (props.mcp.type === 'stdio') {
    const args = cfg.args?.length ? ' ' + cfg.args.join(' ') : ''
    return `${cfg.command}${args}`
  }
  return cfg.url ?? t('claw.resource.notConfigured')
})
</script>
