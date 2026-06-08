<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { builtinNodes, userNodes } from '../base'
import { nodeIconMap, DefaultNodeIcon } from '../core/nodeIconMap'

const emit = defineEmits<{ select: [type: string] }>()
const { t } = useI18n()
const visible = ref(false)
const keyword = ref('')

const filteredBuiltinNodes = computed(() => {
  if (!keyword.value) return builtinNodes
  const kw = keyword.value.toLowerCase()
  return builtinNodes.filter(
    (n) =>
      n.title.toLowerCase().includes(kw) ||
      n.description.toLowerCase().includes(kw) ||
      n.type.toLowerCase().includes(kw)
  )
})

const filteredUserNodes = computed(() => {
  if (!keyword.value) return userNodes
  const kw = keyword.value.toLowerCase()
  return userNodes.filter(
    (n) =>
      n.title.toLowerCase().includes(kw) ||
      n.description.toLowerCase().includes(kw) ||
      n.type.toLowerCase().includes(kw)
  )
})

function show() {
  keyword.value = ''
  visible.value = true
}
function selectNode(type: string) {
  visible.value = false
  emit('select', type)
}

defineExpose({ show })
</script>

<template>
  <a-modal
    v-model:open="visible"
    :title="t('workflowEditor.addNode')"
    :footer="null"
    width="95vw"
  >
    <div class="py-2 space-y-4">
      <!-- 搜索框 -->
      <a-input-search
        v-model:value="keyword"
        :placeholder="t('workflowEditor.searchPlaceholder')"
        allow-clear
      />
      <!-- 内置节点 -->
      <div v-if="filteredBuiltinNodes.length > 0">
        <div
          class="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide"
        >
          {{ t('workflowEditor.builtinNodes') }}
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="node in filteredBuiltinNodes"
            :key="node.type"
            class="flex items-start gap-2 p-3 rounded-lg border border-gray-100 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors"
            @click="selectNode(node.type)"
          >
            <component
              :is="nodeIconMap[node.type] ?? DefaultNodeIcon"
              class="w-5 h-5 shrink-0 text-gray-500 mt-0.5"
              aria-hidden="true"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ node.title }}</div>
              <div class="text-xs text-gray-400 truncate">
                {{ node.description }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 扩展节点 -->
      <div v-if="filteredUserNodes.length > 0">
        <div
          class="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide"
        >
          {{ t('workflowEditor.extendNodes') }}
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="node in filteredUserNodes"
            :key="node.type"
            class="flex items-start gap-2 p-3 rounded-lg border border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-colors"
            @click="selectNode(node.type)"
          >
            <component
              :is="nodeIconMap[node.type] ?? DefaultNodeIcon"
              class="w-5 h-5 shrink-0 text-indigo-400 mt-0.5"
              aria-hidden="true"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ node.title }}</div>
              <div class="text-xs text-gray-400 truncate">
                {{ node.description }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 无搜索结果 -->
      <div
        v-if="
          filteredBuiltinNodes.length === 0 && filteredUserNodes.length === 0
        "
        class="text-center text-gray-400 text-sm py-8"
      >
        {{ t('workflowEditor.noMatch') }}
      </div>
    </div>
  </a-modal>
</template>
