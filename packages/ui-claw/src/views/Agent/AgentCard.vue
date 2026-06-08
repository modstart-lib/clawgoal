<script setup lang="ts">
import type { Agent } from '@/types'
import { copyText } from '@/utils/utils'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  agent: Agent
}>()

const emit = defineEmits<{
  click: [id: string]
}>()

const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none'%3E%3Crect width='64' height='64' fill='%23e5e7eb'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%239ca3af'/%3E%3Cellipse cx='32' cy='52' rx='18' ry='12' fill='%239ca3af'/%3E%3C/svg%3E`
</script>

<template>
  <div
    class="group bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 cursor-pointer flex items-start gap-4"
    @click="emit('click', agent.id)"
  >
    <!-- 头像 -->
    <div
      class="w-14 h-14 rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-gray-700 shadow-sm shrink-0 bg-gray-50 dark:bg-gray-700 transition-transform duration-200 group-hover:scale-105"
    >
      <img
        :src="agent.avatar || DEFAULT_AVATAR"
        alt="Avatar"
        class="w-full h-full object-cover"
      />
    </div>

    <!-- 内容 -->
    <div class="flex-1 min-w-0">
      <!-- 名称 + 状态 -->
      <div class="flex items-center justify-between gap-2 mb-1">
        <div
          class="font-bold text-gray-900 dark:text-gray-100 truncate text-base leading-tight"
        >
          {{ agent.title }}
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <div class="relative flex h-2 w-2">
            <div
              v-if="agent.workStatus === 'working'"
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"
            ></div>
            <div
              class="relative inline-flex rounded-full h-2 w-2"
              :class="
                agent.workStatus === 'working'
                  ? 'bg-primary-500'
                  : 'bg-gray-400'
              "
            ></div>
          </div>
          <span
            class="text-xs"
            :class="
              agent.workStatus === 'working'
                ? 'text-primary-600'
                : 'text-gray-400'
            "
          >
            {{
              agent.workStatus === 'working'
                ? $t('claw.agent.working')
                : $t('claw.agent.idle')
            }}
          </span>
        </div>
      </div>

      <!-- 角色 + 职责 -->
      <div class="flex items-center gap-1.5 mb-1.5">
        <span
          v-if="agent.roleName"
          class="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded px-1.5 py-0.5 font-medium shrink-0"
          >{{ agent.roleName }}</span
        >
        <span class="text-xs text-gray-500 dark:text-gray-400 truncate">{{
          agent.config.title
        }}</span>
      </div>

      <!-- 介绍 -->
      <p
        class="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 leading-relaxed mb-2"
      >
        {{ agent.description || $t('claw.agent.noDescription') }}
      </p>

      <!-- ID -->
      <span
        class="text-xs text-gray-400 dark:text-gray-500 font-mono cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
        :title="t('common.copyId')"
        @click.stop="copyText(String(agent.id))"
        >#{{ agent.id }}</span
      >
    </div>
  </div>
</template>
