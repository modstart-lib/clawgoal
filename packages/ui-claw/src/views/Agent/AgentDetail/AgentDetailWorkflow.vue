<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Agent } from '@/types'
import { getRoleDetail } from '@/claw/api/agent'
import { useI18n } from 'vue-i18n'
import { Share2 } from 'lucide-vue-next'
import AgentPipelineViewModal from './AgentPipelineViewModal.vue'
import type { AgentPipelineDefinition } from './AgentPipelineViewModal.vue'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{ agent: Agent }>()

const loading = ref(false)
const pipelines = ref<{ name: string; def: AgentPipelineDefinition }[]>([])
const viewOpen = ref(false)
const activePipeline = ref<{
  name: string
  def: AgentPipelineDefinition
} | null>(null)

async function load() {
  loading.value = true
  try {
    const role = (await getRoleDetail(props.agent.roleName)) as any
    const agents: Record<string, any> = role.agents ?? {}
    const models: Record<string, any> = role.models ?? {}
    pipelines.value = Object.entries(agents).map(([name, def]) => ({
      name,
      def: { ...def, models } as AgentPipelineDefinition,
    }))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  testActionSet('workflow.refresh', () => load())
  testActionSet('workflow.viewPipeline', (name: string) => {
    const item =
      pipelines.value.find((p) => p.name === name) ?? pipelines.value[0]
    if (item) onView(item)
  })
})
onUnmounted(() => {
  testActionUnset('workflow.refresh')
  testActionUnset('workflow.viewPipeline')
})

function onView(item: { name: string; def: AgentPipelineDefinition }) {
  activePipeline.value = item
  viewOpen.value = true
}
</script>

<template>
  <div class="p-4">
    <a-spin :spinning="loading">
      <div
        v-if="!loading && pipelines.length === 0"
        class="py-12 text-center text-gray-400 text-sm"
      >
        {{ t('claw.agent.workflowEmpty') }}
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <div
          v-for="item in pipelines"
          :key="item.name"
          class="flex flex-col gap-2 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer"
          @click="onView(item)"
        >
          <!-- 第一行：图标 + 名称 + 节点数 -->
          <div class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"
            >
              <Share2 class="w-4 h-4 text-blue-500" aria-hidden="true" />
            </div>
            <div class="font-semibold text-gray-800 text-sm truncate flex-1">
              {{ item.name }}
            </div>
            <span class="text-xs text-gray-400 shrink-0">{{
              t('claw.agent.workflowNodes', {
                count: item.def.graph.nodes.length,
              })
            }}</span>
          </div>
          <!-- 中间：描述 -->
          <div
            v-if="item.def.description"
            class="text-xs text-gray-500 line-clamp-2"
          >
            {{ item.def.description }}
          </div>
          <!-- 底部：节点类型标签 -->
          <div class="flex flex-wrap gap-1 mt-auto">
            <span
              v-for="(count, type) in (() => {
                const m: Record<string, number> = {}
                item.def.graph.nodes.forEach((n) => {
                  m[n.type] = (m[n.type] ?? 0) + 1
                })
                return m
              })()"
              :key="type"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
              >{{ type }}×{{ count }}</span
            >
          </div>
        </div>
      </div>
    </a-spin>

    <AgentPipelineViewModal
      v-model:open="viewOpen"
      :agent-name="agent.title"
      :pipeline-name="activePipeline?.name ?? ''"
      :pipeline="activePipeline?.def ?? null"
    />
  </div>
</template>
