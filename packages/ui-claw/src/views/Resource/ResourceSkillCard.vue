<template>
  <div
    class="group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200"
  >
    <!-- 顶部：图标 + 版本 -->
    <div class="flex items-start justify-between px-4 pt-4 pb-2 shrink-0">
      <div
        class="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center"
      >
        <Cpu class="w-5 h-5 text-primary-500" />
      </div>
      <span
        class="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded"
      >
        v{{ skill.version }}
      </span>
    </div>
    <!-- 中间：名称 + 描述 -->
    <div class="flex-1 px-4 pb-2 overflow-hidden">
      <h3
        class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 line-clamp-1"
      >
        {{ skill.name }}
      </h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">
        {{ skill.description }}
      </p>
    </div>
    <!-- 底部：标签 + 下拉操作占位 -->
    <div
      class="flex flex-wrap gap-1 px-4 pb-3 pt-1.5 pr-10 min-h-9 items-end shrink-0"
    >
      <span
        v-for="tag in skill.tags"
        :key="tag"
        class="text-[10px] bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded"
        >{{ tag }}</span
      >
    </div>
    <!-- 更多操作 -->
    <a-dropdown :trigger="['hover']" placement="bottomRight">
      <a-button
        type="text"
        class="absolute! bottom-2! right-2! p-1! flex items-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        @click.stop
      >
        <MoreHorizontal class="w-4 h-4 text-gray-500" aria-hidden="true" />
      </a-button>
      <template #overlay>
        <a-menu>
          <a-menu-item @click="emit('view')">
            <div class="flex items-center gap-2">
              <Eye class="w-3.5 h-3.5" aria-hidden="true" />
              {{ $t('claw.resource.viewBtn') }}
            </div>
          </a-menu-item>
          <a-menu-item class="!text-red-500" @click="confirmDelete()">
            <div class="flex items-center gap-2">
              <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
              {{ $t('claw.resource.deleteBtn') }}
            </div>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts">
import type { Skill } from '@/claw/api/skill'
import { Modal } from 'ant-design-vue'
import Cpu from '~icons/lucide/cpu'
import Eye from '~icons/lucide/eye'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Trash2 from '~icons/lucide/trash-2'
import { useI18n } from 'vue-i18n'

defineProps<{ skill: Skill }>()

const emit = defineEmits<{
  (e: 'view'): void
  (e: 'delete'): void
}>()

const { t } = useI18n()

function confirmDelete() {
  Modal.confirm({
    title: t('claw.resource.deleteSkillConfirm'),
    okText: t('claw.resource.deleteBtn'),
    okType: 'danger',
    cancelText: t('claw.resource.cancelBtn'),
    onOk: () => emit('delete'),
  })
}
</script>
