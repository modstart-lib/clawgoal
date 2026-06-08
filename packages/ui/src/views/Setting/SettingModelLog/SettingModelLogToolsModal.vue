<script setup lang="ts">
import { ChevronDown, ChevronRight, Wrench } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  tools: Array<{
    name: string
    description?: string
    parameters?: any
  }>
}>()

const visible = defineModel<boolean>('visible', { required: true })

// 展开的参数面板
const expandedTools = ref<Set<string>>(new Set())

function toggleParam(name: string) {
  if (expandedTools.value.has(name)) {
    expandedTools.value.delete(name)
  } else {
    expandedTools.value.add(name)
  }
}

function getParamList(parameters: any): Array<{
  name: string
  type: string
  description: string
  required: boolean
}> {
  if (!parameters || !parameters.properties) return []
  const required: string[] = parameters.required || []
  return Object.entries(parameters.properties).map(
    ([key, val]: [string, any]) => ({
      name: key,
      type: val.type || '-',
      description: val.description || '',
      required: required.includes(key),
    })
  )
}
</script>

<template>
  <a-modal
    v-model:open="visible"
    :title="t('settingModelLog.toolsModalTitle')"
    :footer="null"
    width="95vw"
  >
    <div class="py-2">
      <div class="text-xs text-gray-400 mb-4">
        {{ t('settingModelLog.toolsCount', { count: props.tools.length }) }}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <div
          v-for="tool in props.tools"
          :key="tool.name"
          class="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden"
        >
          <!-- 工具名称 + 描述 -->
          <div class="p-3">
            <div class="flex items-center gap-1.5 mb-1">
              <Wrench
                class="w-3.5 h-3.5 text-indigo-500 shrink-0"
                aria-hidden="true"
              />
              <span class="font-mono text-sm font-semibold text-gray-800">{{
                tool.name
              }}</span>
            </div>
            <p
              v-if="tool.description"
              class="text-xs text-gray-500 leading-relaxed"
            >
              {{ tool.description }}
            </p>
          </div>

          <!-- 参数 -->
          <div
            v-if="getParamList(tool.parameters).length > 0"
            class="border-t border-gray-200"
          >
            <div
              class="flex items-center gap-1 px-3 py-1.5 text-[11px] text-gray-400 cursor-pointer hover:bg-gray-100 transition select-none"
              @click="toggleParam(tool.name)"
            >
              <ChevronDown
                v-if="expandedTools.has(tool.name)"
                class="w-3.5 h-3.5"
                aria-hidden="true"
              />
              <ChevronRight v-else class="w-3.5 h-3.5" aria-hidden="true" />
              {{
                t('settingModelLog.toolsParams', {
                  count: getParamList(tool.parameters).length,
                })
              }}
            </div>
            <div v-if="expandedTools.has(tool.name)" class="px-3 pb-3">
              <div
                v-for="param in getParamList(tool.parameters)"
                :key="param.name"
                class="flex items-start gap-2 py-1 border-b border-gray-100 last:border-0"
              >
                <div class="shrink-0 flex items-center gap-1 min-w-0">
                  <span class="font-mono text-xs text-indigo-600">{{
                    param.name
                  }}</span>
                  <span
                    v-if="param.required"
                    class="text-[10px] text-red-400 font-medium leading-none"
                    >*</span
                  >
                  <span
                    class="text-[10px] text-gray-400 bg-gray-100 px-1 rounded"
                    >{{ param.type }}</span
                  >
                </div>
                <span
                  v-if="param.description"
                  class="text-[11px] text-gray-500 flex-1"
                  >{{ param.description }}</span
                >
              </div>
            </div>
          </div>
          <div v-else class="px-3 pb-2 text-[11px] text-gray-400 italic">
            {{ t('settingModelLog.toolsNoParams') }}
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>
