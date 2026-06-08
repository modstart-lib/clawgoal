<template>
  <div>
    <!-- 模板触发按钮 -->
    <a-button
      type="text"
      class="!px-0 !text-xs !text-blue-500 hover:!text-blue-600"
      @click="visible = true"
    >
      <div class="inline-flex items-center gap-1">
        <LayoutTemplate class="w-3.5 h-3.5" aria-hidden="true" />
        {{ t('claw.compTextTemplateSelector.selectTemplate') }}
      </div>
    </a-button>

    <!-- 模板选择弹窗 -->
    <a-modal
      v-model:open="visible"
      :keyboard="false"
      :mask-closable="false"
      :title="t('claw.compTextTemplateSelector.selectTemplate')"
      :footer="null"
      width="min(600px, 90vw)"
    >
      <div class="py-2 space-y-2">
        <div
          v-for="tpl in templates"
          :key="tpl.label"
          class="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all"
          @click="apply(tpl.text)"
        >
          <div
            class="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1"
          >
            {{ tpl.label }}
          </div>
          <div
            class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3"
          >
            {{ tpl.text }}
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import LayoutTemplate from '~icons/lucide/layout-template'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

export interface TextTemplate {
  label: string
  text: string
}

defineProps<{
  modelValue: string
  templates: TextTemplate[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const visible = ref(false)

const apply = (text: string) => {
  emit('update:modelValue', text)
  visible.value = false
}
</script>
