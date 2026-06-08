<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AgentPipelineDefinition } from './AgentPipelineViewModal.vue'

const { t } = useI18n()

const props = defineProps<{ pipeline: AgentPipelineDefinition }>()

const NODE_W = 190
const NODE_H = 60
const COL_GAP = 90
const ROW_GAP = 40
const PAD_X = 80
const PAD_Y = 70
const BACK_EDGE_MARGIN = 55

const NODE_STYLE: Record<
  string,
  { bg: string; border: string; tagBg: string; tagColor: string }
> = {
  model: {
    bg: '#eff6ff',
    border: '#93c5fd',
    tagBg: '#dbeafe',
    tagColor: '#1d4ed8',
  },
  router: {
    bg: '#faf5ff',
    border: '#c4b5fd',
    tagBg: '#ede9fe',
    tagColor: '#6d28d9',
  },
  context_router: {
    bg: '#faf5ff',
    border: '#c4b5fd',
    tagBg: '#ede9fe',
    tagColor: '#6d28d9',
  },
  code: {
    bg: '#f0fdf4',
    border: '#86efac',
    tagBg: '#dcfce7',
    tagColor: '#15803d',
  },
  start: {
    bg: '#ecfdf5',
    border: '#4ade80',
    tagBg: '#d1fae5',
    tagColor: '#065f46',
  },
  end: {
    bg: '#fff1f2',
    border: '#fda4af',
    tagBg: '#fee2e2',
    tagColor: '#b91c1c',
  },
}

function getNodeTag(type: string): string {
  switch (type) {
    case 'model':
      return 'LLM'
    case 'router':
    case 'context_router':
      return t('claw.agent.pipelineNodeRouter')
    case 'code':
      return t('claw.agent.pipelineNodeCode')
    case 'start':
      return t('claw.agent.pipelineNodeStart')
    case 'end':
      return t('claw.agent.pipelineNodeEnd')
    default:
      return type
  }
}

interface LayoutNode {
  id: string
  type: string
  modelSlot?: string
  x: number
  y: number
}

interface LayoutEdge {
  id: string
  from: string
  to: string
  label?: string
  isBack: boolean
  d: string
  lx: number
  ly: number
}

const layout = computed(() => {
  const { nodes, edges, entryPoint } = props.pipeline.graph

  // Forward adjacency (for BFS depth assignment)
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

  // BFS to assign column depth
  const colDepth = new Map<string, number>()
  colDepth.set(entryPoint, 0)
  const queue = [entryPoint]
  while (queue.length) {
    const cur = queue.shift()!
    for (const nxt of fwdAdj.get(cur) ?? []) {
      if (!colDepth.has(nxt)) {
        colDepth.set(nxt, colDepth.get(cur)! + 1)
        queue.push(nxt)
      }
    }
  }
  nodes.forEach((n) => {
    if (!colDepth.has(n.name))
      colDepth.set(n.name, Math.max(...colDepth.values(), 0) + 1)
  })
  const maxDepth = Math.max(...colDepth.values(), 0)

  const isBackEdge = (from: string, to: string) =>
    to !== '__end__' && (colDepth.get(to) ?? 0) <= (colDepth.get(from) ?? 0)

  // Nodes with no forward outgoing edges → connect to __end__
  const terminalNodes = nodes.filter((n) => {
    const outs: string[] = []
    edges.forEach((e) => {
      if (e.from !== n.name) return
      if (e.to) outs.push(e.to)
      e.branches?.forEach((b) => outs.push(b.next))
    })
    return outs.length === 0 || outs.every((t) => t === '__end__')
  })

  // Column getter: __start__=0, originals=depth+1, __end__=maxDepth+2
  const getCol = (name: string) => {
    if (name === '__start__') return 0
    if (name === '__end__') return maxDepth + 2
    return (colDepth.get(name) ?? 0) + 1
  }

  // Group by column
  const colGroups = new Map<number, string[]>()
  const allNames = ['__start__', ...nodes.map((n) => n.name), '__end__']
  allNames.forEach((name) => {
    const c = getCol(name)
    if (!colGroups.has(c)) colGroups.set(c, [])
    colGroups.get(c)!.push(name)
  })

  // Assign positions
  const pos = new Map<string, { x: number; y: number }>()
  colGroups.forEach((ids, c) => {
    ids.forEach((id, row) => {
      pos.set(id, {
        x: PAD_X + c * (NODE_W + COL_GAP),
        y: PAD_Y + row * (NODE_H + ROW_GAP),
      })
    })
  })

  // Build display nodes
  const nodeMap = new Map(nodes.map((n) => [n.name, n]))
  const displayNodes: LayoutNode[] = allNames.map((name) => {
    const n = nodeMap.get(name)
    const p = pos.get(name)!
    return {
      id: name,
      type: n?.type ?? (name === '__start__' ? 'start' : 'end'),
      modelSlot: n?.modelSlot,
      x: p.x,
      y: p.y,
    }
  })

  // Edge path builder
  function buildPath(
    from: string,
    to: string,
    isBack: boolean
  ): { d: string; lx: number; ly: number } {
    const sp = pos.get(from)
    const tp = pos.get(to)
    if (!sp || !tp) return { d: '', lx: 0, ly: 0 }

    const sx = sp.x + NODE_W
    const sy = sp.y + NODE_H / 2
    const tx = tp.x
    const ty = tp.y + NODE_H / 2

    if (!isBack) {
      const dx = tx - sx
      const bend = Math.max(dx * 0.45, 50)
      const d = `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`
      return { d, lx: (sx + tx) / 2, ly: (sy + ty) / 2 - 10 }
    } else {
      // Smooth arc below: exit right from source, arc below, enter left at target
      const belowY = Math.max(sp.y, tp.y) + NODE_H + BACK_EDGE_MARGIN
      const midX = (sx + tx) / 2
      // Two cubic beziers with smooth join at (midX, belowY):
      //   Seg1: M sx sy → C (sx+30) sy, (sx+30) belowY, midX belowY
      //   Seg2: (reflection of seg1 last cp) = (tx-30, belowY) → C (tx-30) belowY, (tx-30) ty, tx ty
      const d = `M ${sx} ${sy} C ${sx + 30} ${sy}, ${sx + 30} ${belowY}, ${midX} ${belowY} C ${tx - 30} ${belowY}, ${tx - 30} ${ty}, ${tx} ${ty}`
      return { d, lx: midX, ly: belowY + 14 }
    }
  }

  // Build display edges
  const displayEdges: LayoutEdge[] = []
  let idx = 0

  displayEdges.push({
    id: 'e_start',
    from: '__start__',
    to: entryPoint,
    isBack: false,
    ...buildPath('__start__', entryPoint, false),
    label: undefined,
  })

  terminalNodes.forEach((n) => {
    displayEdges.push({
      id: `e_end_${n.name}`,
      from: n.name,
      to: '__end__',
      isBack: false,
      ...buildPath(n.name, '__end__', false),
      label: undefined,
    })
  })

  edges.forEach((e) => {
    if (e.to) {
      const to = e.to === '__end__' ? '__end__' : e.to
      const back = isBackEdge(e.from, e.to)
      displayEdges.push({
        id: `e_${idx++}`,
        from: e.from,
        to,
        isBack: back,
        ...buildPath(e.from, to, back),
        label: undefined,
      })
    }
    e.branches?.forEach((b) => {
      const to = b.next === '__end__' ? '__end__' : b.next
      const back = isBackEdge(e.from, b.next)
      displayEdges.push({
        id: `e_${idx++}`,
        from: e.from,
        to,
        label: b.equals,
        isBack: back,
        ...buildPath(e.from, to, back),
      })
    })
  })

  // SVG dimensions
  let maxX = 0,
    maxY = 0
  pos.forEach((p) => {
    maxX = Math.max(maxX, p.x + NODE_W)
    maxY = Math.max(maxY, p.y + NODE_H)
  })
  const svgH = maxY + BACK_EDGE_MARGIN * 2 + 60

  return { displayNodes, displayEdges, svgW: maxX + PAD_X, svgH }
})

function getTypeInfo(type: string) {
  return (
    NODE_STYLE[type] ?? {
      bg: '#f9fafb',
      border: '#d1d5db',
      tagBg: '#f3f4f6',
      tagColor: '#374151',
    }
  )
}

function getNodeLabel(id: string) {
  if (id === '__start__') return t('claw.agent.pipelineNodeStart')
  if (id === '__end__') return t('claw.agent.pipelineNodeEnd')
  return id
}

function getModelLabel(type: string, modelSlot?: string): string | null {
  if (type !== 'model' && type !== 'router' && type !== 'context_router')
    return null
  return modelSlot ?? t('claw.agent.pipelineNodeDefaultModel')
}
</script>

<template>
  <div class="overflow-auto w-full h-full bg-gray-50/60">
    <div
      class="relative"
      :style="{ width: layout.svgW + 'px', height: layout.svgH + 'px' }"
    >
      <!-- SVG layer: edges + arrowheads -->
      <svg
        class="absolute inset-0 pointer-events-none"
        :width="layout.svgW"
        :height="layout.svgH"
        :viewBox="`0 0 ${layout.svgW} ${layout.svgH}`"
      >
        <defs>
          <marker
            id="arr-fwd"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#b0b7c3" />
          </marker>
          <marker
            id="arr-back"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#c0c8d8" />
          </marker>
        </defs>

        <!-- Forward edges -->
        <g
          v-for="e in layout.displayEdges.filter((x) => !x.isBack)"
          :key="e.id"
        >
          <path
            :d="e.d"
            fill="none"
            stroke="#c4c9d4"
            stroke-width="1.5"
            marker-end="url(#arr-fwd)"
          />
          <text
            v-if="e.label"
            :x="e.lx"
            :y="e.ly"
            font-size="11"
            fill="#6b7280"
            text-anchor="middle"
            font-family="system-ui, sans-serif"
          >
            {{ e.label }}
          </text>
        </g>

        <!-- Back edges (dashed, below main flow) -->
        <g v-for="e in layout.displayEdges.filter((x) => x.isBack)" :key="e.id">
          <path
            :d="e.d"
            fill="none"
            stroke="#c4c9d4"
            stroke-width="1.5"
            stroke-dasharray="6 3"
            marker-end="url(#arr-back)"
          />
        </g>
      </svg>

      <!-- Node divs -->
      <div
        v-for="node in layout.displayNodes"
        :key="node.id"
        class="absolute rounded-xl border select-none"
        :style="{
          left: node.x + 'px',
          top: node.y + 'px',
          width: NODE_W + 'px',
          minHeight: NODE_H + 'px',
          background: getTypeInfo(node.type).bg,
          borderColor: getTypeInfo(node.type).border,
        }"
      >
        <div class="flex items-center gap-2 px-3 py-2">
          <span
            class="shrink-0 text-xs px-1.5 py-0.5 rounded font-medium"
            :style="{
              background: getTypeInfo(node.type).tagBg,
              color: getTypeInfo(node.type).tagColor,
            }"
            >{{ getNodeTag(node.type) }}</span
          >
          <span
            class="text-sm font-semibold text-gray-700 truncate leading-tight"
          >
            {{ getNodeLabel(node.id) }}
          </span>
        </div>
        <div
          v-if="getModelLabel(node.type, node.modelSlot)"
          class="px-3 pb-2 -mt-1 text-xs text-gray-400"
        >
          {{ getModelLabel(node.type, node.modelSlot) }}
        </div>
      </div>
    </div>
  </div>
</template>
