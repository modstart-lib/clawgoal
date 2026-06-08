<script setup lang="ts">
import type { Task } from '@/claw/api/task'
import AgentViewer from '@/claw/views/Agent/AgentViewer.vue'
import TaskAddModal from '@/claw/views/Task/TaskAddModal.vue'
import { TASK_STATUS_OPTIONS } from '@/claw/views/Task/constant'
import LabelViewer from '@/components/LabelViewer.vue'
import { ref, computed } from 'vue'
import ChevronRight from '~icons/lucide/chevron-right'
import MoreHorizontal from '~icons/lucide/more-horizontal'
import Plus from '~icons/lucide/plus'

defineOptions({ name: 'TaskSubtreeNode' })

export interface TreeNode extends Task {
  children: TreeNode[]
}

const props = defineProps<{ node: TreeNode; depth?: number }>()
const emit = defineEmits<{ 'view-detail': [id: number]; refresh: [] }>()

const expanded = ref(true)
const hasChildren = computed(() => props.node.children.length > 0)
const addSubtaskVisible = ref(false)
</script>

<template>
  <div
    :class="
      (depth ?? 0) > 0
        ? 'ml-4 border-l border-gray-100 dark:border-gray-800 pl-2'
        : ''
    "
  >
    <div
      class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group"
      @click="emit('view-detail', node.id)"
    >
      <!-- 展开/折叠 -->
      <span
        v-if="hasChildren"
        class="shrink-0 text-gray-400"
        @click.stop="expanded = !expanded"
      >
        <ChevronRight
          class="w-3 h-3 transition-transform"
          :class="expanded ? 'rotate-90' : ''"
        />
      </span>
      <span v-else class="w-3 h-3 shrink-0" />

      <!-- Agent -->
      <AgentViewer
        v-if="node.agentTitle"
        class="w-24 shrink-0 min-w-0"
        :agent-id="node.agentId"
        :agent-title="node.agentTitle"
        :agent-avatar="node.agentAvatar"
      />
      <span v-else class="w-24 shrink-0 text-xs text-gray-400">{{
        $t('claw.task.noExecutor')
      }}</span>

      <!-- 标题 -->
      <span
        class="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-300 truncate"
        :title="node.title"
        >{{ node.title || '-' }}</span
      >

      <!-- 状态 -->
      <LabelViewer
        class="shrink-0"
        :value="node.status"
        :options="TASK_STATUS_OPTIONS"
        size="small"
      />

      <!-- 更多下拉 -->
      <a-dropdown :trigger="['hover']" placement="bottomRight">
        <span
          class="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity"
          @click.stop
        >
          <MoreHorizontal class="w-3.5 h-3.5 text-gray-500" />
        </span>
        <template #overlay>
          <a-menu>
            <a-menu-item @click.stop="addSubtaskVisible = true">
              <div class="flex items-center gap-2">
                <Plus class="w-3.5 h-3.5" aria-hidden="true" />
                {{ $t('claw.task.addSubtask') }}
              </div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <!-- 子节点递归 -->
    <template v-if="expanded && hasChildren">
      <TaskSubtreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="(depth ?? 0) + 1"
        @view-detail="emit('view-detail', $event)"
        @refresh="emit('refresh')"
      />
    </template>

    <!-- 添加子任务弹窗 -->
    <TaskAddModal
      v-model:open="addSubtaskVisible"
      :parent-id="node.id"
      :parent-title="node.title"
      @created="emit('refresh')"
    />
  </div>
</template>
