<script setup lang="ts">
import { getActionTasks } from '@/claw/api/objective'
import TaskDetailModal from '@/claw/views/Task/TaskDetailModal.vue'
import TaskSubtreeNode from '@/claw/views/Task/TaskSubtreeNode.vue'
import type { TreeNode } from '@/claw/views/Task/TaskSubtreeNode.vue'
import type { Task } from '@/claw/api/task'
import { systemWs } from '@/utils/system'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const props = defineProps<{ keyResultId: number }>()
const emit = defineEmits<{ refresh: [] }>()

const tasks = ref<Task[]>([])
const initialized = ref(false)
const detailOpen = ref(false)
const currentTaskId = ref<number | null>(null)

const load = async () => {
  try {
    tasks.value = await getActionTasks(props.keyResultId)
  } finally {
    initialized.value = true
  }
}

const onTaskUpdated = (data: Record<string, unknown>) => {
  const taskId = data.taskId as number
  const isRelevant = tasks.value.some(
    (t) => t.id === taskId || t.descendants?.some((d) => d.id === taskId)
  )
  if (isRelevant) load()
}

onMounted(() => {
  load()
  systemWs.on('claw:task:updated', onTaskUpdated)
  testActionSet('list.refresh', () => load())
})
onUnmounted(() => {
  systemWs.off('claw:task:updated', onTaskUpdated)
  testActionUnset('list.refresh')
})
watch(
  () => props.keyResultId,
  () => load()
)

// 从 tasks（含 descendants）构建 TreeNode 树
const treeNodes = computed<TreeNode[]>(() => {
  const result: TreeNode[] = []
  for (const task of tasks.value) {
    if (task.parentId !== 0) continue // 只处理根任务
    const nodeMap = new Map<number, TreeNode>()
    const rootNode: TreeNode = { ...task, children: [] }
    nodeMap.set(task.id, rootNode)
    for (const d of task.descendants ?? []) {
      nodeMap.set(d.id, { ...d, children: [] })
    }
    for (const d of task.descendants ?? []) {
      const node = nodeMap.get(d.id)!
      const parent = nodeMap.get(d.parentId)
      if (parent) parent.children.push(node)
      else rootNode.children.push(node)
    }
    result.push(rootNode)
  }
  return result
})

const handleViewDetail = async (id: number) => {
  currentTaskId.value = id
  await nextTick()
  detailOpen.value = true
}

const handleTaskChanged = () => {
  load()
  emit('refresh')
}
</script>

<template>
  <div>
    <div v-if="!initialized" class="pb-2 text-xs text-gray-400">
      {{ $t('claw.task.loadingTasks') }}
    </div>
    <template v-else>
      <div v-if="treeNodes.length > 0">
        <div v-for="node in treeNodes" :key="node.id">
          <TaskSubtreeNode
            :node="node"
            :depth="0"
            @view-detail="handleViewDetail"
            @refresh="handleTaskChanged"
          />
        </div>
      </div>
      <div v-else class="text-xs text-gray-400 py-1">
        {{ $t('claw.task.noRelatedTasks') }}
      </div>
    </template>

    <TaskDetailModal
      v-if="currentTaskId"
      v-model:open="detailOpen"
      :task-id="currentTaskId"
      @refresh="handleTaskChanged"
    />
  </div>
</template>
