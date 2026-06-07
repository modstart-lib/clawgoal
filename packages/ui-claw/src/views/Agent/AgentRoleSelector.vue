<script setup lang="ts">
import { getRoles } from '@/claw/api/agent'
import { message } from 'ant-design-vue'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  value?: string
  placeholder?: string
  disabled?: boolean
  /** Automatically select the first role after loading */
  autoSelectFirst?: boolean
}>()

const emit = defineEmits<{
  change: [value: string]
  'update:value': [value: string]
}>()

const roles = ref<{ name: string; title: string; avatar: string | null }[]>([])
const loading = ref(false)

// Deterministic color palette based on role name
const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#14b8a6',
]

function roleColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

function roleInitials(title: string): string {
  const words = title.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return title.slice(0, 2).toUpperCase()
}

onMounted(async () => {
  loading.value = true
  try {
    roles.value = await getRoles()
    if (props.autoSelectFirst && !props.value && roles.value.length > 0) {
      handleChange(roles.value[0].name)
    }
  } catch {
    message.error(t('claw.agent.loadRoleFailed'))
  } finally {
    loading.value = false
  }
})

const handleChange = (val: string) => {
  emit('update:value', val)
  emit('change', val)
}
</script>

<template>
  <a-select
    :value="value"
    :placeholder="placeholder || $t('claw.agent.roleTemplatePlaceholder')"
    :loading="loading"
    :disabled="disabled"
    class="w-full"
    @change="handleChange"
  >
    <template #optionLabel="opt">
      <div v-if="opt" class="flex items-center gap-2">
        <div
          class="w-4 h-4 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-white text-[8px] font-bold"
          :style="
            opt.avatar ? {} : { backgroundColor: roleColor(opt.value || '') }
          "
        >
          <img
            v-if="opt.avatar"
            :src="opt.avatar"
            class="w-full h-full object-cover"
            alt=""
          />
          <template v-else>{{ roleInitials(opt.label || '') }}</template>
        </div>
        <span>{{ opt.label || opt.value }}</span>
      </div>
    </template>
    <a-select-option
      v-for="role in roles"
      :key="role.name"
      :value="role.name"
      :label="role.title"
    >
      <div class="flex items-center gap-2 py-0.5">
        <!-- Avatar -->
        <div
          class="w-7 h-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-white text-xs font-bold"
          :style="role.avatar ? {} : { backgroundColor: roleColor(role.name) }"
        >
          <img
            v-if="role.avatar"
            :src="role.avatar"
            class="w-full h-full object-cover"
            alt=""
          />
          <template v-else>{{ roleInitials(role.title) }}</template>
        </div>
        <!-- Info -->
        <div class="flex flex-col min-w-0">
          <span
            class="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight"
            >{{ role.title }}</span
          >
          <span
            class="text-xs text-gray-400 dark:text-gray-500 leading-tight"
            >{{ role.name }}</span
          >
        </div>
      </div>
    </a-select-option>
  </a-select>
</template>
