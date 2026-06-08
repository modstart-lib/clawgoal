<script setup lang="ts">
import { useAgentStore } from '@/claw/stores/agent'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Bot from '~icons/lucide/bot'
import User from '~icons/lucide/user'

const { t } = useI18n()

const { agents } = useAgentStore()

const props = withDefaults(
  defineProps<{
    value?: string
    placeholder?: string
    allowClear?: boolean
    disabled?: boolean
    /**
     * 空选项的显示标签，传入后会在列表顶部增加一个空值选项
     * 例如：emptyLabel="人工任务" 时，选择此项等于不选智能体
     */
    emptyLabel?: string
    /** 按所属项目过滤，仅显示属于该项目的智能体 */
    projectId?: number
  }>(),
  {
    placeholder: () => '',
    allowClear: true,
    disabled: false,
    value: undefined,
    emptyLabel: undefined,
    projectId: undefined,
  }
)

const emit = defineEmits<{
  'update:value': [val: string | undefined]
  change: [val: string | undefined]
}>()

const options = computed(() => {
  const filtered =
    props.projectId != null
      ? agents.value.filter((w) => w.projectId === props.projectId)
      : agents.value
  return filtered.map((w) => ({
    value: String(w.id),
    label: w.title,
    avatar: w.avatar,
    roleName: w.roleName,
    isEmpty: false,
  }))
})

const handleChange = (val: string | undefined) => {
  emit('update:value', val)
  emit('change', val)
}
</script>

<template>
  <a-select
    :value="value"
    :placeholder="placeholder || t('agentSelector.placeholder')"
    :allow-clear="allowClear"
    :disabled="disabled"
    class="w-full"
    @change="handleChange"
  >
    <!-- 空值选项（人工任务等） -->
    <a-select-option v-if="emptyLabel" :value="'0'">
      <div class="flex items-center gap-2">
        <User class="w-4 h-4 text-gray-400 shrink-0" />
        <span>{{ emptyLabel }}</span>
      </div>
    </a-select-option>
    <a-select-option v-for="opt in options" :key="opt.value" :value="opt.value">
      <div class="flex items-center gap-2 w-full">
        <template v-if="opt.avatar">
          <img
            :src="opt.avatar"
            class="w-4 h-4 rounded-md shrink-0 object-cover"
            alt=""
          />
        </template>
        <template v-else>
          <Bot class="w-4 h-4 text-gray-400 shrink-0" />
        </template>
        <span>{{ opt.label }}</span>
        <span
          v-if="opt.roleName"
          class="ml-auto text-xs text-gray-400 shrink-0"
          >{{ opt.roleName }}</span
        >
      </div>
    </a-select-option>
  </a-select>
</template>
