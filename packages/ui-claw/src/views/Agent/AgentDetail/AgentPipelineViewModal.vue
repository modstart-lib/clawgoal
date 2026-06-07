<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkflowEditor from '@/components/workflow/editor/WorkflowEditor.vue'

const { t } = useI18n()

export interface AgentGraphNode {
  name: string
  type:
    | 'model'
    | 'tool'
    | 'router'
    | 'context_router'
    | 'parallel'
    | 'subgraph'
    | 'code'
  modelSlot?: string
  useTools?: boolean
  allowTools?: string[]
  toolName?: string
  codeWorkflow?: string
  subgraphRole?: string
  contextKey?: string
}

export interface AgentGraphEdge {
  from: string
  to?: string
  condition?: string
  branches?: { equals?: string; next: string }[]
}

export interface AgentPipelineDefinition {
  description?: string
  models?: Record<string, any>
  graph: {
    entryPoint: string
    nodes: AgentGraphNode[]
    edges: AgentGraphEdge[]
  }
}

const props = defineProps<{
  open: boolean
  agentName?: string
  pipelineName: string
  pipeline: AgentPipelineDefinition | null
}>()
const emit = defineEmits<{ 'update:open': [val: boolean] }>()

const editorRef = ref<InstanceType<typeof WorkflowEditor> | null>(null)

const TYPE_MAP: Record<string, string> = {
  model: 'LLM',
  router: 'SmartRouter',
  context_router: 'SmartRouter',
  tool: 'FunctionCall',
  parallel: 'Variable',
  subgraph: 'FunctionCall',
  code: 'FunctionCall',
}

function pipelineToLogicFlowData(
  pipeline: AgentPipelineDefinition,
  t: (key: string, args?: Record<string, any>) => string
) {
  const { nodes, edges, entryPoint } = pipeline.graph
  const models: Record<string, any> = pipeline.models ?? {}

  // Helper: build nodeInfo from models config + node definition
  function buildNodeInfo(modelSlot: string, node?: AgentGraphNode) {
    const m = models[modelSlot]
    if (!m) return undefined
    const parts: string[] = []
    if (m.name && m.name !== 'default') parts.push(m.name)
    if (m.temperature !== undefined) parts.push(`temp=${m.temperature}`)
    if (m.maxTokens !== undefined) parts.push(`max=${m.maxTokens}`)
    const summary = parts.length
      ? `${modelSlot} · ${parts.join(' ')}`
      : modelSlot

    const details: { label: string; value: string; mono?: boolean }[] = []
    if (m.name)
      details.push({ label: t('claw.agent.pipelineLabelModel'), value: m.name })
    if (m.temperature !== undefined)
      details.push({ label: 'temperature', value: String(m.temperature) })
    if (m.maxTokens !== undefined)
      details.push({ label: 'maxTokens', value: String(m.maxTokens) })
    if (node?.allowTools?.length)
      details.push({
        label: t('claw.agent.pipelineLabelAvailableTools'),
        value: node.allowTools.join(', '),
        mono: true,
      })
    if (m.systemPrompt)
      details.push({
        label: t('claw.agent.pipelineLabelSystemPrompt'),
        value: String(m.systemPrompt).trim(),
        mono: true,
      })
    return { summary, details }
  }
  const COL_W = 260
  const ROW_H = 100
  const COL_GAP = 80
  const ROW_GAP = 30
  const X0 = 150
  const Y0 = 100

  // Forward adjacency (only non-back edges) used for BFS depth assignment
  const fwdAdj = new Map<string, string[]>()
  nodes.forEach((n) => fwdAdj.set(n.name, []))
  edges.forEach((e) => {
    const nexts: string[] = []
    if (e.to && e.to !== '__end__') nexts.push(e.to)
    e.branches?.forEach((b) => {
      if (b.next !== '__end__') nexts.push(b.next)
    })
    nexts.forEach((t) => fwdAdj.get(e.from)?.push(t))
  })

  // BFS to assign column depth (skip already-visited to avoid cycles)
  const depth = new Map<string, number>()
  depth.set(entryPoint, 0)
  const queue = [entryPoint]
  while (queue.length) {
    const cur = queue.shift()!
    for (const nxt of fwdAdj.get(cur) ?? []) {
      if (!depth.has(nxt)) {
        depth.set(nxt, depth.get(cur)! + 1)
        queue.push(nxt)
      }
    }
  }
  const maxDepth = depth.size ? Math.max(...depth.values()) : 0
  nodes.forEach((n) => {
    if (!depth.has(n.name)) depth.set(n.name, maxDepth + 1)
  })

  const isBackEdge = (from: string, to: string) =>
    to !== '__end__' && (depth.get(to) ?? 0) <= (depth.get(from) ?? 0)

  // Terminal nodes: no outgoing edges, or all go to __end__ → connect to virtual __end__
  const terminalNames = new Set(
    nodes
      .filter((n) => {
        const outs: string[] = []
        edges.forEach((e) => {
          if (e.from !== n.name) return
          if (e.to) outs.push(e.to)
          e.branches?.forEach((b) => outs.push(b.next))
        })
        return outs.length === 0 || outs.every((t) => t === '__end__')
      })
      .map((n) => n.name)
  )

  // Column = depth + 1 (col 0 reserved for __start__)
  const cols = new Map<number, string[]>()
  nodes.forEach((n) => {
    const col = depth.get(n.name)! + 1
    if (!cols.has(col)) cols.set(col, [])
    cols.get(col)!.push(n.name)
  })

  // Assign positions
  const pos = new Map<string, { x: number; y: number }>()
  cols.forEach((ids, col) => {
    const x = X0 + col * (COL_W + COL_GAP)
    ids.forEach((id, row) => {
      pos.set(id, { x, y: Y0 + row * (ROW_H + ROW_GAP) })
    })
  })

  // __start__ at col 0
  pos.set('__start__', { x: X0, y: Y0 })

  // __end__ at col maxDepth+2, vertically centred on terminal nodes
  const endCol = maxDepth + 2
  const endX = X0 + endCol * (COL_W + COL_GAP)
  const terminalYs = [...terminalNames].map((n) => pos.get(n)?.y ?? Y0)
  const endY =
    terminalYs.length > 0
      ? Math.round(terminalYs.reduce((a, b) => a + b, 0) / terminalYs.length)
      : Y0
  pos.set('__end__', { x: endX, y: endY })

  // Build LogicFlow nodes
  // Pre-collect branch labels per router node from edges
  const nodeBranches = new Map<string, string[]>()
  edges.forEach((e) => {
    if (e.branches?.length) {
      nodeBranches.set(
        e.from,
        e.branches.map((b) => b.equals ?? '')
      )
    }
  })

  const lfNodes: any[] = [
    {
      id: '__start__',
      type: 'Start',
      x: X0,
      y: Y0,
      properties: { title: t('claw.agent.pipelineNodeStart') },
    },
    ...nodes.map((n) => {
      const p = pos.get(n.name)!
      const properties: any = { title: n.name }
      if (n.type === 'model' && n.modelSlot) {
        properties.modelSlot = n.modelSlot
        const info = buildNodeInfo(n.modelSlot, n)
        if (info) properties.nodeInfo = info
      } else if (
        (n.type === 'router' || n.type === 'context_router') &&
        n.modelSlot
      ) {
        const info = buildNodeInfo(n.modelSlot, n)
        if (info) properties.nodeInfo = info
        const branchLabels = nodeBranches.get(n.name)
        if (branchLabels?.length) {
          const branchDefs = branchLabels.map((label, i) => ({
            id: `b${i}`,
            name: label,
          }))
          properties.data = { branches: branchDefs }
          // outputs drives getDefaultAnchor to create per-branch right anchors
          // include 'default' to match the visual '默认' appended by SmartRouter/View.vue
          properties.outputs = [
            ...branchDefs.map((b) => ({ id: b.id })),
            { id: 'default' },
          ]
        }
      } else if (n.type === 'code') {
        const details: { label: string; value: string; mono?: boolean }[] = []
        if (n.codeWorkflow)
          details.push({
            label: t('claw.agent.pipelineLabelWorkflowFunction'),
            value: n.codeWorkflow,
            mono: true,
          })
        if (details.length)
          properties.nodeInfo = {
            summary: n.codeWorkflow ?? t('claw.agent.pipelineLabelCodeNode'),
            details,
          }
      } else if (n.type === 'tool') {
        const details: { label: string; value: string; mono?: boolean }[] = []
        if (n.toolName)
          details.push({
            label: t('claw.agent.pipelineLabelToolName'),
            value: n.toolName,
            mono: true,
          })
        if (details.length)
          properties.nodeInfo = {
            summary: n.toolName ?? t('claw.agent.pipelineLabelToolCall'),
            details,
          }
      } else if (n.type === 'subgraph' && n.subgraphRole) {
        properties.nodeInfo = {
          summary: n.subgraphRole,
          details: [
            {
              label: t('claw.agent.pipelineLabelSubgraphRole'),
              value: n.subgraphRole,
            },
          ],
        }
      } else if (n.type === 'context_router' && n.contextKey) {
        properties.nodeInfo = {
          summary: n.contextKey,
          details: [
            {
              label: t('claw.agent.pipelineLabelContextKey'),
              value: n.contextKey,
              mono: true,
            },
          ],
        }
      }
      return {
        id: n.name,
        type: TYPE_MAP[n.type] ?? 'FunctionCall',
        x: p.x,
        y: p.y,
        properties,
      }
    }),
    {
      id: '__end__',
      type: 'End',
      x: endX,
      y: endY,
      properties: { title: t('claw.agent.pipelineNodeEnd') },
    },
  ]

  // Build LogicFlow edges
  const lfEdges: any[] = []
  let idx = 0

  // __start__ → entryPoint
  lfEdges.push({
    id: 'e_start',
    type: 'default-edge',
    sourceNodeId: '__start__',
    targetNodeId: entryPoint,
    sourceAnchorId: 'out',
    targetAnchorId: 'in',
  })

  // terminal nodes → __end__
  terminalNames.forEach((name) => {
    lfEdges.push({
      id: `e_end_${name}`,
      type: 'default-edge',
      sourceNodeId: name,
      targetNodeId: '__end__',
      sourceAnchorId: 'out',
      targetAnchorId: 'in',
    })
  })

  // actual workflow edges
  edges.forEach((e) => {
    if (e.to) {
      const to = e.to === '__end__' ? '__end__' : e.to
      const back = to !== '__end__' && isBackEdge(e.from, to)
      const fromNode = nodes.find((n) => n.name === e.from)
      const isRouter =
        fromNode?.type === 'router' || fromNode?.type === 'context_router'
      lfEdges.push({
        id: `e_${idx++}`,
        type: back ? 'loop-edge' : 'default-edge',
        sourceNodeId: e.from,
        targetNodeId: to,
        sourceAnchorId: isRouter ? 'default' : 'out',
        targetAnchorId: 'in',
      })
    }
    e.branches?.forEach((b, branchIdx) => {
      const to = b.next === '__end__' ? '__end__' : b.next
      const back = to !== '__end__' && isBackEdge(e.from, b.next)
      // Use branch-specific anchor if this is a router node
      const fromNode = nodes.find((n) => n.name === e.from)
      const isRouter =
        fromNode?.type === 'router' || fromNode?.type === 'context_router'
      const srcAnchor = isRouter ? `b${branchIdx}` : 'out'
      lfEdges.push({
        id: `e_${idx++}`,
        type: back ? 'loop-edge' : 'default-edge',
        sourceNodeId: e.from,
        targetNodeId: to,
        sourceAnchorId: srcAnchor,
        targetAnchorId: 'in',
        properties: { label: b.equals ?? '' },
      })
    })
  })

  return { nodes: lfNodes, edges: lfEdges }
}

function onAfterOpenChange(open: boolean) {
  if (open && props.pipeline) {
    nextTick(() => {
      const data = pipelineToLogicFlowData(props.pipeline!, t)
      editorRef.value?.setData(data)
    })
  }
}

// 保留 watch 作为兼容兜底：若弹窗已经打开时 pipeline 才到位，则补充一次 setData
watch(
  () => props.pipeline,
  (val) => {
    if (props.open && val) {
      nextTick(() => {
        editorRef.value?.setData(pipelineToLogicFlowData(val, t))
      })
    }
  }
)
</script>

<template>
  <a-modal
    :open="open"
    :title="null"
    :footer="null"
    width="95vw"
    :styles="{ body: { padding: 0 } }"
    @cancel="emit('update:open', false)"
    @after-open-change="onAfterOpenChange"
  >
    <div class="flex flex-col" style="height: 80vh">
      <!-- Header -->
      <div
        class="flex items-center justify-between px-4 py-3 border-b border-gray-100"
      >
        <div>
          <div
            class="font-semibold text-gray-800 text-sm flex items-center gap-1.5"
          >
            <span v-if="agentName" class="text-gray-400 font-normal">{{
              agentName
            }}</span>
            <span v-if="agentName" class="text-gray-300">/</span>
            <span>{{ pipelineName }}</span>
          </div>
          <div
            v-if="pipeline?.description"
            class="text-xs text-gray-400 mt-0.5"
          >
            {{ pipeline.description }}
          </div>
        </div>
      </div>

      <!-- Graph area -->
      <div class="flex-1 relative overflow-hidden">
        <WorkflowEditor ref="editorRef" view-only />
      </div>
    </div>
  </a-modal>
</template>
