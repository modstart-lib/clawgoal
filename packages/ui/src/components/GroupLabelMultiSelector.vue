<template>
  <div
    class="rounded-xl border border-gray-100/80 dark:border-gray-700/50 backdrop-blur-md overflow-hidden divide-y divide-gray-100/50 dark:divide-gray-700/50 bg-white/40 dark:bg-gray-900/40"
  >
    <div v-for="(group, index) in groups" :key="group.label">
      <!-- 组头 -->
      <div
        class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none transition-all duration-300"
        :class="
          expandedGroups.has(index)
            ? 'bg-gray-50/80 dark:bg-gray-800/60'
            : 'hover:bg-gray-50/90 dark:hover:bg-gray-800/80'
        "
        @click.stop="toggleExpand(index)"
      >
        <a-checkbox
          :checked="isGroupAllChecked(group)"
          :indeterminate="isGroupIndeterminate(group)"
          @change="onGroupAllChange(group, $event)"
          @click.stop
        />
        <span
          class="flex-1 text-sm font-semibold tracking-wide text-gray-800 dark:text-gray-200"
          >{{ group.label }}</span
        >
        <span
          v-if="groupSelectedCount(group) > 0"
          class="text-xs text-primary-500 dark:text-primary-400 font-medium mr-1"
          >{{ groupSelectedCount(group) }}/{{ group.options.length }}</span
        >
        <ChevronDown
          class="w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0"
          :class="expandedGroups.has(index) ? 'rotate-180' : ''"
          aria-hidden="true"
        />
      </div>

      <!-- 展开内容 -->
      <div
        v-if="expandedGroups.has(index)"
        class="px-4 py-3 bg-white/40 dark:bg-gray-900/30"
      >
        <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <a-checkbox
            v-for="opt in group.options"
            :key="opt.value"
            :checked="modelValue.includes(opt.value)"
            class="text-sm! text-gray-700! dark:text-gray-300!"
            @change="onOptionChange(opt.value, $event)"
          >
            {{ opt.label }}
          </a-checkbox>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChevronDown from '~icons/lucide/chevron-down'

export interface GroupOption {
  label: string
  value: string
}

export interface OptionGroup {
  label: string
  options: GroupOption[]
}

const props = defineProps<{
  modelValue: string[]
  groups: OptionGroup[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

// 默认全部展开
const expandedGroups = ref<Set<number>>(new Set(props.groups.map((_, i) => i)))

function toggleExpand(index: number) {
  const next = new Set(expandedGroups.value)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  expandedGroups.value = next
}

function groupSelectedCount(group: OptionGroup) {
  return group.options.filter((o) => props.modelValue.includes(o.value)).length
}

function isGroupAllChecked(group: OptionGroup) {
  return (
    group.options.length > 0 &&
    group.options.every((o) => props.modelValue.includes(o.value))
  )
}

function isGroupIndeterminate(group: OptionGroup) {
  const count = groupSelectedCount(group)
  return count > 0 && count < group.options.length
}

function onGroupAllChange(group: OptionGroup, e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  const vals = group.options.map((o) => o.value)
  if (checked) {
    emit('update:modelValue', [...new Set([...props.modelValue, ...vals])])
  } else {
    emit(
      'update:modelValue',
      props.modelValue.filter((v) => !vals.includes(v))
    )
  }
}

function onOptionChange(value: string, e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) {
    if (!props.modelValue.includes(value)) {
      emit('update:modelValue', [...props.modelValue, value])
    }
  } else {
    emit(
      'update:modelValue',
      props.modelValue.filter((v) => v !== value)
    )
  }
}
</script>
