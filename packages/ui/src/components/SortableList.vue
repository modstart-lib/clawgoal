<script
  setup
  lang="ts"
  generic="T extends { id: number | string; sortOrder?: number }"
>
/**
 * SortableList - 通用拖拽排序列表容器
 * 用法：包裹列表项，子项添加 draggable="true" 和 data-id 属性
 * 通过 @sort 事件返回 { fromId, toId } 用于更新排序
 */
import { ref } from 'vue'

defineProps<{ items: T[] }>()
const emit = defineEmits<{
  sort: [payload: { fromId: number | string; toId: number | string }]
}>()

const draggingId = ref<number | string | null>(null)
const overIds = ref<Set<number | string>>(new Set())

function getDragId(e: DragEvent): number | string | null {
  const el = (e.currentTarget as HTMLElement).closest(
    '[data-drag-id]'
  ) as HTMLElement | null
  return el?.dataset.dragId ?? null
}

function onDragStart(e: DragEvent, id: number | string) {
  draggingId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }
}

function onDragOver(e: DragEvent, id: number | string) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  if (id !== draggingId.value) overIds.value = new Set([id])
}

function onDragLeave(_e: DragEvent, id: number | string) {
  overIds.value.delete(id)
  overIds.value = new Set(overIds.value)
}

function onDrop(e: DragEvent, toId: number | string) {
  e.preventDefault()
  overIds.value = new Set()
  const fromId = draggingId.value
  draggingId.value = null
  if (fromId !== null && fromId !== toId) {
    emit('sort', { fromId, toId })
  }
}

function onDragEnd() {
  draggingId.value = null
  overIds.value = new Set()
}

defineExpose({
  getDragId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  draggingId,
  overIds,
})
</script>

<template>
  <div
    v-for="item in items"
    :key="item.id"
    :draggable="true"
    :data-drag-id="item.id"
    :class="[
      'transition-all duration-200 border-2 border-transparent relative',
      {
        'opacity-50 border-primary bg-primary/10 rounded-md':
          draggingId === item.id,
        'border-t-primary': overIds.has(item.id),
      },
    ]"
    @dragstart="(e: DragEvent) => onDragStart(e, item.id)"
    @dragover="(e: DragEvent) => onDragOver(e, item.id)"
    @dragleave="(e: DragEvent) => onDragLeave(e, item.id)"
    @drop="(e: DragEvent) => onDrop(e, item.id)"
    @dragend="onDragEnd"
  >
    <slot
      :item="item"
      :is-dragging="draggingId === item.id"
      :is-over="overIds.has(item.id)"
    />
  </div>
</template>
