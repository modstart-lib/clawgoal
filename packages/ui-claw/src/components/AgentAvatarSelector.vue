<script setup lang="ts">
import type { CharacterConfig } from 'cube-character'
import { ref } from 'vue'
import IconPencil from '~icons/lucide/pencil'
import IconPlus from '~icons/lucide/plus'
import CubeCharacterSelector from '../views/Office/components/CubeCharacterSelector.vue'

defineProps<{
  modelValue?: string | null
  avatarConfig?: CharacterConfig | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'update:avatarConfig': [value: CharacterConfig | null]
}>()

const selectorOpen = ref(false)

function handleSave(payload: { config: CharacterConfig; image: string }) {
  emit('update:modelValue', payload.image)
  emit('update:avatarConfig', payload.config)
  selectorOpen.value = false
}
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- 头像预览 -->
    <div
      class="group w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 relative flex-shrink-0 transition-all"
      :class="
        modelValue
          ? 'border-primary'
          : 'border-dashed border-gray-300 dark:border-gray-600'
      "
      @click="selectorOpen = true"
    >
      <img
        v-if="modelValue"
        :src="modelValue"
        class="w-full h-full object-cover"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center bg-gray-50/50 dark:bg-gray-800/40"
      >
        <IconPlus class="w-6 h-6 text-gray-400" />
      </div>
      <!-- hover 遮罩 -->
      <div
        class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <IconPencil class="w-5 h-5 text-white" />
      </div>
    </div>

    <!-- 右侧 slot -->
    <div v-if="$slots.aside" class="flex-1">
      <slot name="aside" />
    </div>

    <!-- 3D 角色选择器弹窗 -->
    <CubeCharacterSelector
      v-model:open="selectorOpen"
      :initial-config="avatarConfig ?? null"
      @save="handleSave"
    />
  </div>
</template>
