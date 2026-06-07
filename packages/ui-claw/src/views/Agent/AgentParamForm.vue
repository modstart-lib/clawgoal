<script setup lang="ts">
import type { RoleParamDef } from '@/types'

/**
 * 角色参数表单组件，在创建和设置两处复用。
 * - modelValue: 当前各字段的值 Record<string, string>
 * - defs: 来自角色配置的字段定义列表
 */
const props = defineProps<{
  modelValue: Record<string, string>
  defs: RoleParamDef[]
}>()

const emit = defineEmits<{
  'update:modelValue': [val: Record<string, string>]
}>()

function update(name: string, value: string) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
}

function getSelectOptions(
  def: RoleParamDef
): { label: string; value: string }[] {
  if (!def.option) return []
  return def.option
    .split(',')
    .map((v) => ({ label: v.trim(), value: v.trim() }))
}
</script>

<template>
  <div v-if="defs.length > 0" class="space-y-3">
    <div v-for="def in defs" :key="def.name">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {{ def.title }}
        <span v-if="def.required" class="text-red-500 ml-0.5">*</span>
      </p>
      <p
        v-if="def.description"
        class="text-xs text-gray-500 dark:text-gray-400 mb-1"
      >
        {{ def.description }}
      </p>
      <a-textarea
        v-if="def.type === 'textarea'"
        :value="modelValue[def.name] ?? ''"
        :placeholder="def.defaultValue ?? ''"
        :auto-size="{ minRows: 3, maxRows: 8 }"
        @update:value="update(def.name, $event)"
      />
      <a-select
        v-else-if="def.type === 'select'"
        :value="modelValue[def.name] ?? ''"
        :options="getSelectOptions(def)"
        class="w-full"
        :placeholder="def.defaultValue ?? ''"
        @update:value="update(def.name, String($event))"
      />
      <a-input
        v-else
        :value="modelValue[def.name] ?? ''"
        :placeholder="def.defaultValue ?? ''"
        @update:value="update(def.name, $event)"
      />
    </div>
  </div>
</template>
