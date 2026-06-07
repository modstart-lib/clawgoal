<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Trash2 } from 'lucide-vue-next'
import { message } from 'ant-design-vue'
import { getEditor } from '../core/global'

const emit = defineEmits<{
  runToNode: [nodeId: string]
}>()

const { t } = useI18n()
const visible = ref(false)
const x = ref(0)
const y = ref(0)
const currentNodeId = ref<string | null>(null)
const currentNodeType = ref<string | null>(null)

function show(
  nodeId: string,
  nodeType: string,
  clientX: number,
  clientY: number
) {
  currentNodeId.value = nodeId
  currentNodeType.value = nodeType
  x.value = clientX
  y.value = clientY
  visible.value = true
}

function hide() {
  visible.value = false
}

function onRunToNode() {
  if (currentNodeId.value) {
    emit('runToNode', currentNodeId.value)
  }
  hide()
}

function onDeleteNode() {
  if (!currentNodeId.value) return hide()
  if (currentNodeType.value === 'Start') {
    message.error(t('workflowEditor.cantDeleteStart'))
    return hide()
  }
  getEditor()?.deleteNode(currentNodeId.value)
  hide()
}

function onClickOutside() {
  hide()
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
  document.addEventListener('contextmenu', onClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside, true)
  document.removeEventListener('contextmenu', onClickOutside, true)
})

defineExpose({ show, hide })
</script>

<template>
  <div
    v-if="visible"
    class="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]"
    :style="{ left: x + 'px', top: y + 'px' }"
    @click.stop
    @contextmenu.prevent.stop
  >
    <button
      class="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      @click="onRunToNode"
    >
      <Play class="w-3.5 h-3.5 text-green-600" aria-hidden="true" />
      {{ t('workflowEditor.runToHere') }}
    </button>
    <div
      v-if="currentNodeType !== 'Start'"
      class="border-t border-gray-100 mt-1 pt-1"
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
        @click="onDeleteNode"
      >
        <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
        {{ t('workflowEditor.deleteNode') }}
      </button>
    </div>
  </div>
</template>
