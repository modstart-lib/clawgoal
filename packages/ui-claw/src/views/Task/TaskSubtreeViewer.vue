<script setup lang="ts">
import type { Task } from '@/claw/api/task'
import { getTaskDescendants } from '@/claw/api/task'
import TaskDetailModal from '@/claw/views/Task/TaskDetailModal.vue'
import TaskSubtreeNode from '@/claw/views/Task/TaskSubtreeNode.vue'
import type { TreeNode } from '@/claw/views/Task/TaskSubtreeNode.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const props = defineProps<{
  taskId: number
  rootId?: number
  /** 外部传入的后代数据（若提供，则跳过接口请求） */
  preloadedDescendants?: Task[]
}>()
const emit = defineEmits<{ refresh: []; hasChildren: [value: boolean] }>()

const descendants = ref<Task[]>([])
const initialized = ref(false)
const detailOpen = ref(false)
const currentTaskId = ref<number | null>(null)

const hasDirectChildren = () =>
  descendants.value.some((d) => d.parentId === props.taskId)

const load = async () => {
  if (props.preloadedDescendants !== undefined) {
    descendants.value = props.preloadedDescendants
    initialized.value = true
    emit('hasChildren', hasDirectChildren())
    return
  }
  const fetchId = props.rootId || props.taskId
  try {
    descendants.value = await getTaskDescendants(fetchId)
  } finally {
    initialized.value = true
    emit('hasChildren', hasDirectChildren())
  }
}

onMounted(() => {
  load()
  testActionSet('subtree.refresh', () => load())
})
onUnmounted(() => {
  testActionUnset('subtree.refresh')
})
watch(
  () => props.taskId,
  () => load()
)
watch(
  () => props.preloadedDescendants,
  () => {
    if (props.preloadedDescendants !== undefined) {
      descendants.value = props.preloadedDescendants
      emit('hasChildren', hasDirectChildren())
    }
  },
  { deep: true }
)

// 从扁平列表构建树：只有 parentId === taskId 的节点才作为根节点（直接子任务）
const tree = computed<TreeNode[]>(() => {
  const nodeMap = new Map<number, TreeNode>()
  for (const task of descendants.value) {
    nodeMap.set(task.id, { ...task, children: [] })
  }
  const roots: TreeNode[] = []
  for (const task of descendants.value) {
    const node = nodeMap.get(task.id)!
    if (task.parentId === props.taskId) {
      roots.push(node)
    } else {
      const parent = nodeMap.get(task.parentId)
      if (parent) parent.children.push(node)
      // parentId 不在 map 里且不是直接子任务（兄弟/自身）→ 忽略
    }
  }
  console.log(
    '[SubtreeViewer] tree roots:',
    roots.length,
    'taskId:',
    props.taskId
  )
  return roots
})

const handleViewDetail = async (id: number) => {
  currentTaskId.value = id
  await nextTick()
  detailOpen.value = true
}

const forceLoad = async () => {
  const fetchId = props.rootId || props.taskId
  try {
    descendants.value = await getTaskDescendants(fetchId)
  } finally {
    emit('hasChildren', hasDirectChildren())
  }
}

const handleDetailRefresh = () => {
  forceLoad()
  emit('refresh')
}

defineExpose({ forceLoad })
</script>

<template>
  <div>
    <div v-if="!initialized" class="text-xs text-gray-400 py-1">
      {{ $t('claw.task.loading') }}
    </div>
    <template v-else>
      <div v-if="tree.length > 0">
        <TaskSubtreeNode
          v-for="node in tree"
          :key="node.id"
          :node="node"
          :depth="0"
          @view-detail="handleViewDetail"
          @refresh="forceLoad"
        />
      </div>
    </template>

    <TaskDetailModal
      v-model:open="detailOpen"
      :task-id="currentTaskId"
      @refresh="handleDetailRefresh"
    />
  </div>
</template>
