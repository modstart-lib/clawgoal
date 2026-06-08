<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import LogicFlow from '@logicflow/core'
import '@logicflow/core/dist/index.css'
import {
  setEditor,
  getNodeNewTitle,
  setNodePropertiesById,
} from './core/global'
import { initEditor, builtinNodes, userNodes } from './base'
import FloatingToolbar from './components/FloatingToolbar.vue'
import NodeConfigPanel from './components/NodeConfigPanel.vue'
import NodeSelector from './components/NodeSelector.vue'
import NodeContextMenu from './components/NodeContextMenu.vue'

const props = defineProps<{ viewOnly?: boolean; runMode?: boolean }>()

const containerRef = ref<HTMLElement | null>(null)
const zoomLevel = ref(1)
const selectedNodeId = ref<string | null>(null)
const selectedNodeProperties = ref<any>(null)
const nodeSelectorRef = ref<InstanceType<typeof NodeSelector> | null>(null)
const contextMenuRef = ref<InstanceType<typeof NodeContextMenu> | null>(null)
let lf: LogicFlow | null = null
let ignoreHistoryChange = false

const emit = defineEmits<{ change: [data: any]; runToNode: [nodeId: string] }>()

onMounted(() => {
  if (!containerRef.value) return
  lf = new LogicFlow({
    container: containerRef.value,
    grid: {
      size: 10,
      visible: true,
      type: 'dot',
      config: { color: '#e5e7eb', thickness: 1 },
    },
    keyboard: { enabled: true },
    animation: true,
    adjustEdge: false,
    allowResize: false,
    stopMoveGraph: false,
    nodeTextEdit: false,
    edgeTextEdit: false,
  })
  setEditor(lf)
  initEditor(lf)
  lf.render({})

  if (props.viewOnly) {
    lf.updateEditConfig({
      stopMoveGraph: false,
      adjustNodePosition: true,
      adjustEdge: false,
      hideAnchors: false,
      nodeTextEdit: false,
      edgeTextEdit: false,
    })
  } else if (props.runMode) {
    lf.updateEditConfig({
      adjustNodePosition: true,
      hideAnchors: true,
      nodeTextEdit: false,
      edgeTextEdit: false,
    })
  }

  watch(
    () => props.runMode,
    (val) => {
      if (!lf) return
      if (val) {
        lf.updateEditConfig({
          adjustNodePosition: true,
          hideAnchors: true,
          nodeTextEdit: false,
          edgeTextEdit: false,
        })
      } else {
        lf.updateEditConfig({
          adjustNodePosition: true,
          hideAnchors: false,
        })
      }
    }
  )

  lf.on('node:click', ({ data }: any) => {
    selectedNodeId.value = data.id
    selectedNodeProperties.value = { ...data.properties, type: data.type }
  })
  lf.on('blank:click', () => {
    selectedNodeId.value = null
    selectedNodeProperties.value = null
  })
  lf.on('node:contextmenu', ({ data, e }: any) => {
    if (props.viewOnly) return
    e.preventDefault()
    contextMenuRef.value?.show(data.id, data.type, e.clientX, e.clientY)
  })
  lf.on('node:properties-change', ({ id }: any) => {
    if (selectedNodeId.value === id) {
      const node = lf!.getNodeModelById(id)
      if (node)
        selectedNodeProperties.value = {
          ...node.getProperties(),
          type: node.type,
        }
    }
    emit('change', lf!.getGraphData())
  })
  lf.on('graph:transform', ({ transform }: any) => {
    zoomLevel.value = transform?.SCALE_X ?? 1
  })
  lf.on('history:change', () => {
    if (!ignoreHistoryChange) emit('change', lf!.getGraphData())
  })
})

onBeforeUnmount(() => {
  lf?.destroy?.()
  lf = null
})

function getData() {
  const data = lf?.getGraphData() as any
  if (data) {
    // 保存时过滤 width/height，避免固定尺寸干扰布局
    ;(data.nodes as any[]).forEach((node: any) => {
      if (node.properties) {
        delete node.properties.width
        delete node.properties.height
      }
    })
    // 保存视口信息
    if (lf) {
      const tm = lf.graphModel.transformModel
      data.viewPositionX = tm.TRANSLATE_X
      data.viewPositionY = tm.TRANSLATE_Y
      data.viewScale = tm.SCALE_X
    }
  }
  return data
}
function computeAutoLayout(data: any): any {
  const nodes: any[] = data?.nodes || []
  const edges: any[] = data?.edges || []
  if (!nodes.length) return data

  // 如果所有节点都已有位置信息，跳过
  if (nodes.every((n) => n.x != null && n.y != null)) return data

  // 构建邻接表
  const children = new Map<string, string[]>()
  const parents = new Map<string, string[]>()
  nodes.forEach((n) => {
    children.set(n.id, [])
    parents.set(n.id, [])
  })
  edges.forEach((e) => {
    children.get(e.sourceNodeId)?.push(e.targetNodeId)
    parents.get(e.targetNodeId)?.push(e.sourceNodeId)
  })

  // BFS 分配深度（拓扑排序层级）
  const depth = new Map<string, number>()
  const queue: string[] = []
  nodes.forEach((n) => {
    if ((parents.get(n.id) ?? []).length === 0) {
      depth.set(n.id, 0)
      queue.push(n.id)
    }
  })
  while (queue.length > 0) {
    const id = queue.shift()!
    const d = depth.get(id) ?? 0
    for (const childId of children.get(id) ?? []) {
      if ((depth.get(childId) ?? -1) < d + 1) {
        depth.set(childId, d + 1)
        queue.push(childId)
      }
    }
  }

  // 按深度分组
  const levelNodes = new Map<number, string[]>()
  nodes.forEach((n) => {
    const d = depth.get(n.id) ?? 0
    if (!levelNodes.has(d)) levelNodes.set(d, [])
    levelNodes.get(d)!.push(n.id)
  })

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // 估算节点高度（顶部 header+边距 + 每个输入字段高度）
  function estimateHeight(node: any): number {
    const fields: any[] = node.properties?.inputFields ?? []
    const base = 88
    if (!fields.length) return base
    return (
      base +
      fields.reduce(
        (sum: number, f: any) => sum + (f.type === 'textarea' ? 64 : 24),
        0
      )
    )
  }

  const MAX_COLS_PER_ROW = 5
  const COL_X_START = 150
  const COL_WIDTH = 280
  const ROW_Y_START = 100
  const ROW_GAP = 50
  const GRID_ROW_GAP = 200

  // 计算每个网格行的最大高度（用于确定下一行的Y起始位置）
  const gridRowMaxHeights = new Map<number, number>()
  levelNodes.forEach((nodeIds, col) => {
    const gridRow = Math.floor(col / MAX_COLS_PER_ROW)
    const totalH = nodeIds.reduce((sum, id) => {
      const node = nodeMap.get(id)!
      return sum + estimateHeight(node) + ROW_GAP
    }, 0)
    gridRowMaxHeights.set(
      gridRow,
      Math.max(gridRowMaxHeights.get(gridRow) ?? 0, totalH)
    )
  })

  // 计算每个网格行的Y起始位置
  const gridRowYStart = new Map<number, number>()
  let baseY = ROW_Y_START
  const maxGridRow =
    gridRowMaxHeights.size > 0
      ? Math.max(...Array.from(gridRowMaxHeights.keys()))
      : 0
  for (let r = 0; r <= maxGridRow; r++) {
    gridRowYStart.set(r, baseY)
    baseY += (gridRowMaxHeights.get(r) ?? 0) + GRID_ROW_GAP
  }

  const positions = new Map<string, { x: number; y: number }>()
  levelNodes.forEach((nodeIds, col) => {
    const gridRow = Math.floor(col / MAX_COLS_PER_ROW)
    const colInRow = col % MAX_COLS_PER_ROW
    let topY = gridRowYStart.get(gridRow) ?? ROW_Y_START
    for (const id of nodeIds) {
      const node = nodeMap.get(id)!
      const h = estimateHeight(node)
      positions.set(id, {
        x: COL_X_START + colInRow * COL_WIDTH,
        y: topY + h / 2,
      })
      topY += h + ROW_GAP
    }
  })

  return {
    ...data,
    nodes: nodes.map((n) => ({
      ...n,
      x: positions.get(n.id)?.x ?? COL_X_START,
      y: positions.get(n.id)?.y ?? ROW_Y_START,
    })),
  }
}

function setData(data: any) {
  if (data && lf) {
    ignoreHistoryChange = true
    const layoutedData = computeAutoLayout(data)
    if (containerRef.value) containerRef.value.style.opacity = '0'
    lf.render(layoutedData)
    const hasViewport =
      data.viewPositionX !== undefined &&
      data.viewPositionY !== undefined &&
      data.viewScale !== undefined
    // 延迟 500ms，让 HTML 节点有足够时间通过 ResizeObserver 更新尺寸，再执行 fitView
    const fitDelay = props.viewOnly ? 500 : 300
    setTimeout(() => {
      if (!lf) return
      if (hasViewport) {
        const tm = lf.graphModel.transformModel as any
        tm.TRANSLATE_X = data.viewPositionX
        tm.TRANSLATE_Y = data.viewPositionY
        tm.SCALE_X = data.viewScale
        tm.SCALE_Y = data.viewScale
        zoomLevel.value = data.viewScale
        // 触发画布重绘
        lf.graphModel.transformModel.translate(0, 0)
      } else {
        // 同步容器尺寸后再 fitView
        if (containerRef.value) {
          const { offsetWidth, offsetHeight } = containerRef.value
          if (offsetWidth > 0 && offsetHeight > 0) {
            ;(lf.graphModel as any).width = offsetWidth
            ;(lf.graphModel as any).height = offsetHeight
          }
        }
        lf.fitView()
      }
      if (containerRef.value) containerRef.value.style.opacity = '1'
      ignoreHistoryChange = false
    }, fitDelay)
  }
}
function clearRunData() {
  if (!lf) return
  lf.graphModel.nodes.forEach((node: any) => {
    node.setProperties({
      ...node.getProperties(),
      status: 'idle',
      statusMsg: '',
      runInputs: {},
      runOutputs: {},
    })
  })
}
function enterRunMode() {
  if (!lf) return
  lf.graphModel.edges.forEach((edge: any) => {
    edge.setProperties({ ...edge.getProperties(), status: 'running-mode' })
  })
}
function exitRunMode() {
  if (!lf) return
  lf.graphModel.edges.forEach((edge: any) => {
    const p = edge.getProperties()
    if (p?.status) edge.setProperties({ ...p, status: undefined })
  })
  lf.graphModel.nodes.forEach((node: any) => {
    const p = node.getProperties()
    if (p?.status && p.status !== 'idle') {
      node.setProperties({ ...p, status: 'idle', statusMsg: '' })
    }
  })
}
function setNodeStatus(
  nodeId: string,
  status: string,
  statusMsg?: string,
  nodeData?: any
) {
  const updates: Record<string, any> = { status, statusMsg: statusMsg || '' }
  if (nodeData?.runInputs !== undefined) updates.runInputs = nodeData.runInputs
  if (nodeData?.runOutputs !== undefined)
    updates.runOutputs = nodeData.runOutputs
  if (nodeData?.runData !== undefined) updates.runData = nodeData.runData
  setNodePropertiesById(nodeId, updates)
  if (!lf) return
  // 从目标节点视角着色入边：
  // - 节点实际执行（running/success）→ 入边绿色（路径已走）
  // - 节点被跳过（success_ignore）  → 入边灰色停止动画
  // - 节点失败（error）              → 入边红色
  let incomingEdgeStatus: string | null = null
  if (status === 'running' || status === 'success') {
    incomingEdgeStatus = 'success'
  } else if (status === 'error') {
    incomingEdgeStatus = 'error'
  } else if (status === 'success_ignore') {
    incomingEdgeStatus = 'stopped'
  }
  if (incomingEdgeStatus) {
    const graphData = lf.getGraphData() as any
    ;(graphData.edges as any[]).forEach((edge: any) => {
      if (edge.targetNodeId === nodeId) {
        const edgeModel = lf!.getEdgeModelById(edge.id)
        if (edgeModel)
          edgeModel.setProperties({
            ...edgeModel.getProperties(),
            status: incomingEdgeStatus,
          })
      }
    })
  }
}

function onZoomIn() {
  lf?.zoom(true)
}
function onZoomOut() {
  lf?.zoom(false)
}
function onResetZoom() {
  lf?.resetZoom()
  zoomLevel.value = 1
}
function onFitView() {
  if (!lf || !containerRef.value) return
  // 同步容器当前实际尺寸到 graphModel，避免 Modal 场景下初始化时尺寸为 0 导致 fitView 计算错误
  const { offsetWidth, offsetHeight } = containerRef.value
  if (offsetWidth > 0 && offsetHeight > 0) {
    ;(lf.graphModel as any).width = offsetWidth
    ;(lf.graphModel as any).height = offsetHeight
  }
  lf.fitView()
}
function onAddNode() {
  nodeSelectorRef.value?.show()
}

function onSelectNodeType(type: string) {
  if (!lf) return
  // Build title map from all node defs
  const allNodes = [...builtinNodes, ...userNodes]
  const nodeDef = allNodes.find((n) => n.type === type)
  const title = getNodeNewTitle(nodeDef?.title || type)
  const inputFields = (nodeDef?.inputFields || []).map((f) => ({ ...f }))
  const outputFields = (nodeDef?.outputFields || []).map((f) => ({ ...f }))
  const outputs =
    outputFields.length > 0
      ? outputFields.map((f) => ({ id: f.name }))
      : [{ id: 'out' }]
  const { graphModel } = lf
  const x =
    graphModel.width / 2 -
    graphModel.transformModel.TRANSLATE_X / graphModel.transformModel.SCALE_X
  const y =
    graphModel.height / 2 -
    graphModel.transformModel.TRANSLATE_Y / graphModel.transformModel.SCALE_X
  // userNodes 使用 FunctionCall 类型，data.functionCallName 标识具体子类型
  const isUserNode = userNodes.some((n) => n.type === type)
  lf.addNode({
    type: isUserNode ? 'FunctionCall' : type,
    x,
    y,
    properties: {
      title,
      status: 'idle',
      inputFields,
      outputFields,
      outputs,
      data: isUserNode ? { functionCallName: type } : {},
    },
  })
}

function closePanel() {
  selectedNodeId.value = null
  selectedNodeProperties.value = null
}

function stopRunModeEdges() {
  if (!lf) return
  lf.graphModel.edges.forEach((edge: any) => {
    const p = edge.getProperties()
    if (p?.status === 'running-mode') {
      edge.setProperties({ ...p, status: 'stopped' })
    }
  })
}

defineExpose({
  getData,
  setData,
  clearRunData,
  enterRunMode,
  exitRunMode,
  setNodeStatus,
  stopRunModeEdges,
  fitView: onFitView,
})
</script>

<template>
  <div class="relative w-full h-full">
    <div
      ref="containerRef"
      :class="[
        'w-full h-full transition-opacity duration-200',
        props.viewOnly ? 'lf-view-only-container' : '',
      ]"
    />
    <FloatingToolbar
      :zoom-level="zoomLevel"
      :view-only="props.viewOnly"
      @zoom-in="onZoomIn"
      @zoom-out="onZoomOut"
      @reset-zoom="onResetZoom"
      @fit-view="onFitView"
      @add-node="onAddNode"
    />
    <NodeConfigPanel
      :open="!!(selectedNodeId && selectedNodeProperties)"
      :selected-node-id="selectedNodeId"
      :selected-node-properties="selectedNodeProperties"
      :readonly="viewOnly || runMode"
      @close="closePanel"
    />
    <NodeSelector
      v-if="!viewOnly && !runMode"
      ref="nodeSelectorRef"
      @select="onSelectNodeType"
    />
    <NodeContextMenu
      ref="contextMenuRef"
      @run-to-node="(id) => emit('runToNode', id)"
    />
  </div>
</template>

<style>
/* 修复 Node 节点右侧被裁剪（状态图标被隐藏） */
.lf-html-node {
  overflow: visible !important;
}
.lf-html-node foreignObject {
  overflow: visible !important;
}
/* 隐藏贝塞尔曲线的控制点 */
.lf-bezier-adjust-point {
  display: none !important;
}
.lf-bezier-adjust-line {
  display: none !important;
}
/* 运行中节点高亮 */
[data-node-status='running'] > * {
  outline: 2px solid #3b82f6;
  border-color: #3b82f6 !important;
  border-radius: 0.5rem;
}
@keyframes node-running-glow {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.08);
  }
}
[data-node-status='running'] > * {
  animation: node-running-glow 1.2s ease-in-out infinite;
}
/* 运行中虚线边流动动画（仅 running-mode 状态） */
.lf-graph .edge-running-mode path {
  animation: edge-flow 0.8s linear infinite;
}
@keyframes edge-flow {
  from {
    stroke-dashoffset: 18;
  }
  to {
    stroke-dashoffset: 0;
  }
}
/* 预览模式：锚点圆圈始终可见（不需要 hover 才显示） */
.lf-view-only-container .lf-node-anchor-hover {
  visibility: visible !important;
  pointer-events: none;
}
</style>
