<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getFunctionCallNodes } from './lib'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const functionCallName = ref<string>('')

watch(
  () => props.properties?.data?.functionCallName,
  (v) => {
    functionCallName.value = v || ''
  },
  { immediate: true }
)

const availableNodes = computed(() =>
  getFunctionCallNodes().map((n) => ({
    value: n.name,
    label: n.title || n.name,
  }))
)

const selectedNodeDef = computed(
  () =>
    getFunctionCallNodes().find((n) => n.name === functionCallName.value) ||
    null
)

// 若当前 functionCallName 对应的是自动注册的 userNode（有 viewComp），则锁定不允许更改函数
const isLocked = computed(() => !!selectedNodeDef.value?.viewComp)

function onSelect(val: string) {
  functionCallName.value = val
  emit('update:properties', { data: { functionCallName: val } })
}
</script>

<template>
  <div class="p-3 space-y-3">
    <div v-if="!isLocked">
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.funcCallSelect') }}
      </div>
      <a-select
        v-model:value="functionCallName"
        :options="availableNodes"
        style="width: 100%"
        :placeholder="t('workflowEditor.funcCallPlaceholder')"
        allow-clear
        @change="onSelect"
      />
      <div
        v-if="availableNodes.length === 0"
        class="text-xs text-gray-400 mt-1"
      >
        {{ t('workflowEditor.funcCallNoFuncs') }}
      </div>
    </div>
    <div v-if="selectedNodeDef?.comp">
      <component
        :is="selectedNodeDef.comp"
        source="config"
        :node="node"
        :properties="properties"
        @change="(p: any) => emit('update:properties', p)"
      />
    </div>
  </div>
</template>
