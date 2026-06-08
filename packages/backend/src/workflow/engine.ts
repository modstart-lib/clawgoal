import {
  NodeProperties,
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  NodeStatus,
  WorkflowData,
  WorkflowExecuteContext,
  WorkflowNode,
  WorkflowSchedule,
  WorkflowStatus,
} from './type.js'
import { resolveVariables } from './variable.js'
import { wtl } from './i18n.js'
import type { LocaleKey } from '../locale/index.js'
import StartSchedule from './nodes/Start/schedule.js'
import LLMSchedule from './nodes/LLM/schedule.js'
import IfElseSchedule from './nodes/IfElse/schedule.js'
import JsRunnerSchedule from './nodes/JsRunner/schedule.js'
import VariableSchedule from './nodes/Variable/schedule.js'
import RandomValueSchedule from './nodes/RandomValue/schedule.js'
import RegexExtractSchedule from './nodes/RegexExtract/schedule.js'
import FileCopySchedule from './nodes/FileCopy/schedule.js'
import FileMoveSchedule from './nodes/FileMove/schedule.js'
import FileListSchedule from './nodes/FileList/schedule.js'
import McpToolsCallSchedule from './nodes/McpToolsCall/schedule.js'
import FunctionCallSchedule from './nodes/FunctionCall/schedule.js'
import HttpRequestSchedule from './nodes/HttpRequest/schedule.js'
import DelaySchedule from './nodes/Delay/schedule.js'
import AsksSchedule from './nodes/Asks/schedule.js'
import SmartRouterSchedule from './nodes/SmartRouter/schedule.js'

const scheduleMap = new Map<string, WorkflowSchedule>([
  ['Start', StartSchedule],
  ['LLM', LLMSchedule],
  ['IfElse', IfElseSchedule],
  ['JsRunner', JsRunnerSchedule],
  ['Variable', VariableSchedule],
  ['RandomValue', RandomValueSchedule],
  ['RegexExtract', RegexExtractSchedule],
  ['FileCopy', FileCopySchedule],
  ['FileMove', FileMoveSchedule],
  ['FileList', FileListSchedule],
  ['McpToolsCall', McpToolsCallSchedule],
  ['FunctionCall', FunctionCallSchedule],
  ['HttpRequest', HttpRequestSchedule],
  ['Delay', DelaySchedule],
  ['Asks', AsksSchedule],
  ['SmartRouter', SmartRouterSchedule],
])

export function extendScheduleMap(type: string, schedule: WorkflowSchedule) {
  scheduleMap.set(type, schedule)
}

const extraRouterTypes: string[] = []

/** Register additional node types that use runData.Next for routing (like Router/ContextRouter). */
export function extendRouterTypes(...types: string[]) {
  extraRouterTypes.push(...types)
}

function deepMergeVariables(
  target: Record<string, any>,
  source: Record<string, any>
) {
  for (const key in source) {
    const val = source[key]
    if (typeof val === 'object' && !Array.isArray(val) && val !== null) {
      if (!target[key]) target[key] = {}
      deepMergeVariables(target[key], val)
    } else {
      target[key] = val
    }
  }
}

function assignVariables(
  target: Record<string, any>,
  source: Record<string, any>
) {
  for (const key in source) {
    const pcs = key.split('.')
    if (pcs.length === 2) {
      if (!target[pcs[0]]) target[pcs[0]] = {}
      target[pcs[0]][pcs[1]] = source[key]
    } else {
      target[key] = source[key]
    }
  }
}

function buildGraph(data: WorkflowData): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  data.nodes.forEach((node) => graph.set(node.id, []))
  data.edges.forEach((edge) => {
    if (edge.sourceNodeId && edge.targetNodeId && !edge.loopEdge) {
      graph.get(edge.sourceNodeId)!.push(edge.targetNodeId)
    }
  })
  return graph
}

function buildReverseGraph(data: WorkflowData): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  data.nodes.forEach((node) => graph.set(node.id, []))
  data.edges.forEach((edge) => {
    if (edge.sourceNodeId && edge.targetNodeId) {
      graph.get(edge.targetNodeId)!.push(edge.sourceNodeId)
    }
  })
  return graph
}

function getParentNodes(data: WorkflowData, nodeId: string): string[] {
  return data.edges
    .filter(
      (edge) =>
        edge.targetNodeId === nodeId && edge.sourceNodeId && !edge.loopEdge
    )
    .map((edge) => edge.sourceNodeId!) as string[]
}

function getUpstreamNodes(
  data: WorkflowData,
  targetNodeId: string
): Set<string> {
  const upstream = new Set<string>()
  const reverseGraph = buildReverseGraph(data)
  const visited = new Set<string>()
  const queue = [targetNodeId]
  visited.add(targetNodeId)
  upstream.add(targetNodeId)
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    for (const pred of reverseGraph.get(nodeId) || []) {
      if (!visited.has(pred)) {
        visited.add(pred)
        queue.push(pred)
        upstream.add(pred)
      }
    }
  }
  return upstream
}

function hasCycle(graph: Map<string, string[]>): boolean {
  const visited = new Set<string>()
  const recStack = new Set<string>()
  function dfs(nodeId: string): boolean {
    if (recStack.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    recStack.add(nodeId)
    for (const neighbor of graph.get(nodeId) || []) {
      if (dfs(neighbor)) return true
    }
    recStack.delete(nodeId)
    return false
  }
  for (const nodeId of graph.keys()) {
    if (dfs(nodeId)) return true
  }
  return false
}

/**
 * Check if a node is "permanently skipped" — all its direct upstream nodes have
 * been executed (are in `executed`) but none of them activated an edge to this node.
 * This happens when a router node chose a different branch, leaving this node unreachable.
 */
function isNodePermanentlySkipped(
  data: WorkflowData,
  nodeId: string,
  executed: Set<string>
): boolean {
  const incomingEdges = data.edges.filter(
    (edge) => edge.targetNodeId === nodeId && !edge.loopEdge
  )
  if (incomingEdges.length === 0) return false
  // All upstream sources must be executed (not idle/unexecuted)
  for (const edge of incomingEdges) {
    if (!edge.sourceNodeId) continue
    if (!executed.has(edge.sourceNodeId)) return false
  }
  return true
}

function getNodeExecutionStatus(
  data: WorkflowData,
  nodeId: string,
  executed: Set<string>
): { canExecute: boolean; shouldIgnore: boolean } {
  // Only consider non-loop incoming edges: loop edges are backward edges and
  // must not block forward execution of the loop-target node.
  const incomingEdges = data.edges.filter(
    (edge) => edge.targetNodeId === nodeId && !edge.loopEdge
  )
  if (incomingEdges.length === 0)
    return { canExecute: true, shouldIgnore: false }

  let hasSuccess = false
  let allIgnore = true
  let hasIdle = false
  let hasUnExecuted = false

  for (const edge of incomingEdges) {
    if (edge.sourceNodeId) {
      const sourceNode = data.nodes.find((n) => n.id === edge.sourceNodeId)
      // Determine effective status before checking hasUnExecuted, so that
      // permanently-skipped nodes (router chose a different branch) are treated
      // as executed and do not block downstream nodes.
      let effectiveStatus: NodeStatus = 'idle'
      if (sourceNode) {
        if (
          sourceNode.type === 'IfElse' ||
          sourceNode.type === 'SmartRouter' ||
          sourceNode.type === 'ContextRouter'
        ) {
          effectiveStatus =
            sourceNode.properties.runData?.['Next'] === edge.sourceAnchorId
              ? 'success'
              : 'success_ignore'
        } else if (sourceNode.type === 'Asks') {
          effectiveStatus =
            sourceNode.properties.runData?.selectedChoice ===
            edge.sourceAnchorId
              ? 'success'
              : 'success_ignore'
        } else {
          effectiveStatus = sourceNode.properties.status
          // If the source node is idle but all its own upstream nodes have been
          // executed, it was permanently skipped (e.g. a router chose a different
          // branch). Treat it as success_ignore so downstream nodes are not blocked.
          if (
            effectiveStatus === 'idle' &&
            isNodePermanentlySkipped(data, sourceNode.id, executed)
          ) {
            effectiveStatus = 'success_ignore'
          }
        }
      }

      // A node counts as "unexecuted" only if it is genuinely pending (not skipped).
      const isEffectivelyExecuted =
        executed.has(edge.sourceNodeId) || effectiveStatus === 'success_ignore'
      if (!hasUnExecuted) {
        hasUnExecuted = !isEffectivelyExecuted
      }

      if (effectiveStatus === 'success') {
        hasSuccess = true
        allIgnore = false
      } else if (effectiveStatus === 'idle') {
        hasIdle = true
      } else if (effectiveStatus !== 'success_ignore') {
        allIgnore = false
      }
    }
  }

  if (!hasUnExecuted && allIgnore)
    return { canExecute: false, shouldIgnore: true }
  if (hasSuccess)
    return { canExecute: !hasIdle && !hasUnExecuted, shouldIgnore: false }
  return { canExecute: false, shouldIgnore: false }
}

export async function workflowCheck(
  data: WorkflowData,
  lang?: LocaleKey
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []
  const startNodes = data.nodes.filter((node) => node.type === 'Start')
  if (startNodes.length === 0) {
    errors.push(wtl(lang, 'WfStartNodeRequired'))
  } else if (startNodes.length > 1) {
    errors.push(wtl(lang, 'WfStartNodeMultiple'))
  }

  const reachableNodeIds = new Set<string>()
  if (startNodes.length === 1) {
    const startNodeId = startNodes[0].id
    reachableNodeIds.add(startNodeId)
    const graph = buildGraph(data)
    const visited = new Set<string>()
    const queue = [startNodeId]
    visited.add(startNodeId)
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      for (const neighbor of graph.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
          reachableNodeIds.add(neighbor)
        }
      }
    }
  }

  const graph = buildGraph(data)
  const reachableGraph = new Map<string, string[]>()
  reachableNodeIds.forEach((nodeId) => {
    reachableGraph.set(nodeId, graph.get(nodeId) || [])
  })
  if (hasCycle(reachableGraph)) {
    errors.push(wtl(lang, 'WfContainsCycle'))
  }

  for (const node of data.nodes) {
    if (reachableNodeIds.has(node.id)) {
      if (!scheduleMap.has(node.type)) {
        errors.push(wtl(lang, 'WfSchedulerNotFound', node.type))
      } else {
        const schedule = scheduleMap.get(node.type)
        if (schedule?.check) {
          try {
            await schedule.check(node, lang)
          } catch (error) {
            errors.push(
              wtl(
                lang,
                'WfNodeCheckFailed',
                node.properties.title,
                String(error)
              )
            )
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export interface WorkflowExecuteOptions {
  isContinue?: boolean
  stopNodeId?: string
  execContext: WorkflowExecuteContext
  onNodeStatusChange?: (
    data: WorkflowData,
    nodeId: string,
    status: NodeStatus,
    statusMsg?: string
  ) => void
  onNodeDataChange?: (
    data: WorkflowData,
    nodeId: string,
    properties: Partial<{
      runInputs: NodeProperties['runInputs']
      runOutputs: NodeProperties['runOutputs']
      runData: NodeProperties['runData']
      data: NodeProperties['data']
    }>
  ) => void
  onNodeStart?: (
    data: WorkflowData,
    nodeId: string,
    param: NodeRunParam
  ) => void
  onNodeFinish?: (
    data: WorkflowData,
    nodeId: string,
    result: NodeRunResult
  ) => void
  onStatusChange?: (
    data: WorkflowData,
    status: WorkflowStatus,
    statusMsg?: string
  ) => void
  onFinish?: (
    data: WorkflowData,
    success: boolean,
    errors: string[],
    results: Map<string, NodeRunResult>
  ) => void
  onLog?: (
    data: WorkflowData,
    level: 'info' | 'warn' | 'error',
    message: string
  ) => void
}

export function workflowExecute(
  data: WorkflowData,
  options: WorkflowExecuteOptions
): {
  cancel: () => void
  result: () => Promise<{
    success: boolean
    errors: string[]
    results: Map<string, NodeRunResult>
  }>
} {
  const controller = new AbortController()
  const signal = controller.signal

  const noop = () => {}
  const opts = {
    isContinue: false,
    onNodeStatusChange: noop,
    onNodeDataChange: noop,
    onNodeStart: noop,
    onNodeFinish: noop,
    onStatusChange: noop,
    onFinish: noop,
    onLog: noop,
    ...options,
  }

  const result = async (): Promise<{
    success: boolean
    errors: string[]
    results: Map<string, NodeRunResult>
  }> => {
    const errors: string[] = []
    const results = new Map<string, NodeRunResult>()

    data.status = 'running'
    opts.onLog!(
      data,
      'info',
      wtl(opts.execContext.lang, 'WfExecutionStarted') +
        (opts.isContinue
          ? ' ' + wtl(opts.execContext.lang, 'WfResumeMode')
          : '')
    )
    opts.onStatusChange!(data, 'running', '')

    const startNodes = data.nodes.filter((node) => node.type === 'Start')
    const reachableNodeIds = new Set<string>()
    if (startNodes.length === 1) {
      const startNodeId = startNodes[0].id
      reachableNodeIds.add(startNodeId)
      const graph = buildGraph(data)
      const visited = new Set<string>()
      const queue = [startNodeId]
      visited.add(startNodeId)
      while (queue.length > 0) {
        const nodeId = queue.shift()!
        for (const neighbor of graph.get(nodeId) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push(neighbor)
            reachableNodeIds.add(neighbor)
          }
        }
      }
    }

    let executableNodeIds = reachableNodeIds
    if (opts.stopNodeId) {
      const upstream = getUpstreamNodes(data, opts.stopNodeId)
      executableNodeIds = new Set(
        [...reachableNodeIds].filter((id) => upstream.has(id))
      )
    }

    // 重置非恢复模式的节点状态
    if (!opts.isContinue) {
      data.nodes.forEach((node) => {
        if (executableNodeIds.has(node.id)) {
          node.properties.status = 'idle'
          node.properties.statusMsg = ''
          node.properties.runInputs = {}
          node.properties.runOutputs = {}
          node.properties.runData = {}
          opts.onNodeStatusChange!(data, node.id, 'idle', '')
        }
      })
    }

    const queue: string[] = []
    const nodeTryRunTimes = new Map<string, number>()
    const processed = new Set<string>()
    const executed = new Set<string>()
    const nodeOutputs = new Map<string, Record<string, any>>()
    const variablesMap = new Map<string, Record<string, any>>()
    const loopCounts = new Map<string, number>()
    const sharedContext: Record<string, any> =
      opts.execContext.sharedContext ?? {}

    function getNodeVariables(nodeId: string): Record<string, any> {
      if (variablesMap.has(nodeId)) return variablesMap.get(nodeId)!
      const vars: Record<string, any> = {}
      const node = data.nodes.find((n) => n.id === nodeId)
      if (!node) return vars
      // Variable 节点：从 runData.variables 中取
      if (node.type === 'Variable' && node.properties.runData?.variables) {
        Object.assign(vars, node.properties.runData.variables)
        variablesMap.set(nodeId, vars)
        return vars
      }
      // 其他节点：从上游递归合并
      const upstreamNodes = getParentNodes(data, nodeId)
      for (const upNodeId of upstreamNodes) {
        const upVars = getNodeVariables(upNodeId)
        deepMergeVariables(vars, upVars)
      }
      variablesMap.set(nodeId, vars)
      return vars
    }

    // 恢复模式：恢复已成功节点的输出
    if (opts.isContinue) {
      data.nodes.forEach((node) => {
        if (
          (node.properties.status === 'success' ||
            node.properties.status === 'success_ignore') &&
          node.properties.runOutputs &&
          executableNodeIds.has(node.id)
        ) {
          nodeOutputs.set(node.id, node.properties.runOutputs)
        }
      })
    }

    // Start 节点入队
    if (startNodes.length === 1) {
      const startNodeId = startNodes[0].id
      if (executableNodeIds.has(startNodeId)) {
        queue.push(startNodeId)
        processed.add(startNodeId)
      }
    }

    // 重置 loopBody：找出从 loopTargetId 到 loopSourceId 的路径上的所有节点
    function resetLoopBody(loopTargetId: string, loopSourceId: string) {
      const loopBody = new Set<string>()
      const visited = new Set<string>()
      function dfs(nodeId: string, path: string[]): boolean {
        if (nodeId === loopSourceId) {
          path.forEach((n) => loopBody.add(n))
          loopBody.add(loopSourceId)
          return true
        }
        if (visited.has(nodeId)) return loopBody.has(nodeId)
        visited.add(nodeId)
        let found = false
        for (const edge of data.edges.filter(
          (e) => e.sourceNodeId === nodeId && !e.loopEdge
        )) {
          if (edge.targetNodeId && dfs(edge.targetNodeId, [...path, nodeId]))
            found = true
        }
        return found
      }
      dfs(loopTargetId, [])
      for (const nid of loopBody) {
        const n = data.nodes.find((x) => x.id === nid)
        if (n) {
          n.properties.status = 'idle'
          n.properties.statusMsg = ''
          n.properties.runInputs = {}
          n.properties.runOutputs = {}
          n.properties.runData = {}
          opts.onNodeStatusChange!(data, nid, 'idle', '')
        }
        executed.delete(nid)
        processed.delete(nid)
        nodeOutputs.delete(nid)
        variablesMap.delete(nid)
        nodeTryRunTimes.delete(nid)
      }

      // Also clear `processed` for all nodes reachable (forward) from loopTargetId
      // that were skipped (success_ignore) in the previous pass.
      // Without this, calcNextNode won't re-queue them after the loop changes routing.
      const reachable = new Set<string>()
      function collectReachable(nodeId: string) {
        if (reachable.has(nodeId)) return
        reachable.add(nodeId)
        for (const edge of data.edges.filter(
          (e) => e.sourceNodeId === nodeId && !e.loopEdge
        )) {
          if (edge.targetNodeId) collectReachable(edge.targetNodeId)
        }
      }
      collectReachable(loopTargetId)
      for (const nid of reachable) {
        const n = data.nodes.find((x) => x.id === nid)
        if (n && n.properties.status === 'success_ignore') {
          n.properties.status = 'idle'
          n.properties.statusMsg = ''
          n.properties.runData = {}
          opts.onNodeStatusChange!(data, nid, 'idle', '')
          executed.delete(nid)
          processed.delete(nid)
        }
      }
    }

    const ROUTER_TYPES = [
      'Router',
      'SmartRouter',
      'IfElse',
      'Asks',
      'ContextRouter',
      ...extraRouterTypes,
    ]

    const calcNextNode = (node: WorkflowNode, skipLoopEdges = false) => {
      const activatedHandles = node.properties.outputs?.map((o) => o.id) || []
      const isRouterNode = ROUTER_TYPES.includes(node.type)
      const winningHandle = isRouterNode
        ? (node.properties.runData?.['Next'] as string | undefined)
        : null

      // First pass: fire loop edges (winning anchor only for router nodes)
      // Skipped in resume (isContinue) mode to avoid resetting already-executed loop bodies.
      if (!skipLoopEdges)
        for (const handle of activatedHandles) {
          if (isRouterNode && handle !== winningHandle) continue
          const loopEdges = data.edges.filter(
            (e) =>
              e.sourceNodeId === node.id &&
              e.sourceAnchorId === handle &&
              e.loopEdge
          )
          for (const loopEdge of loopEdges) {
            if (
              !loopEdge.targetNodeId ||
              !executableNodeIds.has(loopEdge.targetNodeId)
            )
              continue
            const loops = loopCounts.get(loopEdge.targetNodeId) || 0
            const maxL = data.maxLoops ?? 16
            if (loops >= maxL) {
              opts.onLog!(
                data,
                'warn',
                wtl(
                  opts.execContext.lang,
                  'WfLoopLimitReached',
                  node.properties.title,
                  maxL
                )
              )
              continue
            }
            loopCounts.set(loopEdge.targetNodeId, loops + 1)
            resetLoopBody(loopEdge.targetNodeId, node.id)
            processed.add(loopEdge.targetNodeId)
            queue.push(loopEdge.targetNodeId)
            return // 有循环触发时不再入队普通下游节点
          }
        }

      // Second pass: normal (non-loop) edges
      // For router nodes, only fire the winning anchor — firing all anchors would
      // pre-process non-winning branches as success_ignore, permanently blocking
      // them from being re-queued after a loop resets the router node.
      // Exception: in isContinue/resume mode (skipLoopEdges=true) runData is not
      // restored, so winningHandle is always undefined; fire all handles instead.
      for (const handle of activatedHandles) {
        if (!skipLoopEdges && isRouterNode && handle !== winningHandle) continue
        const outgoingEdges = data.edges.filter(
          (edge) =>
            edge.sourceNodeId === node.id &&
            edge.sourceAnchorId === handle &&
            !edge.loopEdge
        )
        for (const edge of outgoingEdges) {
          const targetNodeId = edge.targetNodeId
          if (
            targetNodeId &&
            executableNodeIds.has(targetNodeId) &&
            !processed.has(targetNodeId)
          ) {
            queue.push(targetNodeId)
            processed.add(targetNodeId)
          }
        }
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      const node = data.nodes.find((n) => n.id === nodeId)
      if (!node) continue

      node.properties.runRuntime = { variables: {} }

      const execStatus = getNodeExecutionStatus(data, nodeId, executed)
      if (execStatus.shouldIgnore) {
        node.properties.status = 'success_ignore'
        executed.add(nodeId)
        opts.onNodeStatusChange!(data, nodeId, 'success_ignore', '')
        calcNextNode(node)
        continue
      }

      if (!execStatus.canExecute) {
        const tryTimes = nodeTryRunTimes.get(nodeId) || 0
        if (tryTimes < 10) {
          nodeTryRunTimes.set(nodeId, tryTimes + 1)
          queue.push(nodeId)
        } else {
          errors.push(
            wtl(
              opts.execContext.lang,
              'WfNodeCannotExecute',
              node.properties.title
            )
          )
        }
        continue
      }

      if (signal.aborted) {
        // Workflow was intentionally paused (e.g. ASKS/audit pause); remaining queue items are discarded.
        break
      }

      // 恢复模式：已成功节点跳过
      // Loop edges are skipped to prevent resetting and re-executing already-completed loop bodies.
      if (
        opts.isContinue &&
        (node.properties.status === 'success' ||
          node.properties.status === 'success_ignore')
      ) {
        executed.add(nodeId)
        calcNextNode(node, true)
        continue
      }

      // 收集上游变量
      const currentVariables: Record<string, any> = {}
      const upstreamNodes = getParentNodes(data, nodeId)
      for (const upNodeId of upstreamNodes) {
        const upVars = getNodeVariables(upNodeId)
        deepMergeVariables(currentVariables, upVars)
        // 将上游节点输出也放入变量（按节点标题）
        const upNode = data.nodes.find((n) => n.id === upNodeId)
        if (upNode && upNode.type !== 'Variable' && nodeOutputs.has(upNodeId)) {
          const title = upNode.properties.title
          if (!currentVariables[title]) currentVariables[title] = {}
          Object.assign(currentVariables[title], nodeOutputs.get(upNodeId))
        }
      }
      node.properties.runRuntime = { variables: currentVariables }

      // 收集 inputFields 的值（处理变量替换）
      const runInputs: Record<string, any> = {}
      for (const field of node.properties.inputFields || []) {
        if (field.value !== undefined) {
          runInputs[field.name] = resolveVariables(
            field.value as any,
            currentVariables,
            ''
          )
        }
      }
      // 来自上游边的输出也注入
      for (const edge of data.edges.filter((e) => e.targetNodeId === nodeId)) {
        if (edge.sourceNodeId && nodeOutputs.has(edge.sourceNodeId)) {
          const srcOutputs = nodeOutputs.get(edge.sourceNodeId)!
          Object.assign(runInputs, srcOutputs)
        }
      }

      node.properties.runInputs = runInputs
      node.properties.status = 'running'
      opts.onNodeStatusChange!(data, nodeId, 'running', '')

      const param: NodeRunParam = {
        node,
        variables: currentVariables,
        runInputs,
        runData: node.properties.runData || {},
        sharedContext,
      }
      opts.onNodeStart!(data, nodeId, param)

      const nodeController: NodeRunController = {
        updateNodeData(nid, properties, merge) {
          const n = data.nodes.find((x) => x.id === nid)
          if (!n) return
          for (const k of Object.keys(
            properties
          ) as (keyof typeof properties)[]) {
            if (
              merge &&
              n.properties[k] &&
              typeof n.properties[k] === 'object'
            ) {
              Object.assign(n.properties[k] as object, properties[k])
            } else {
              ;(n.properties as any)[k] = properties[k]
            }
          }
          opts.onNodeDataChange!(data, nid, properties)
        },
        updateNodeRunData(nid, runData) {
          const n = data.nodes.find((x) => x.id === nid)
          if (n) n.properties.runData = runData
          opts.onNodeDataChange!(data, nid, { runData })
        },
      }

      const schedule = scheduleMap.get(node.type)
      if (!schedule) {
        node.properties.status = 'error'
        node.properties.statusMsg = wtl(
          opts.execContext.lang,
          'WfSchedulerNotFound',
          node.type
        )
        executed.add(nodeId)
        opts.onNodeStatusChange!(
          data,
          nodeId,
          'error',
          node.properties.statusMsg
        )
        errors.push(node.properties.statusMsg)
        continue
      }

      let nodeResult: NodeRunResult
      try {
        nodeResult = await schedule.run(nodeController, param, opts.execContext)
      } catch (err) {
        nodeResult = {
          status: 'error',
          statusMsg: wtl(opts.execContext.lang, 'WfNodeException', String(err)),
          runOutputs: {},
        }
      }

      node.properties.status = nodeResult.status
      node.properties.statusMsg = nodeResult.statusMsg
      node.properties.runOutputs = nodeResult.runOutputs
      if (nodeResult.runData) {
        node.properties.runData = nodeResult.runData
      }

      opts.onNodeFinish!(data, nodeId, nodeResult)
      opts.onNodeStatusChange!(
        data,
        nodeId,
        nodeResult.status,
        nodeResult.statusMsg
      )

      if (
        nodeResult.status === 'success' ||
        nodeResult.status === 'success_ignore'
      ) {
        nodeOutputs.set(nodeId, nodeResult.runOutputs)
        // 更新变量快照
        if (node.type === 'Variable' && nodeResult.runData?.variables) {
          assignVariables(currentVariables, nodeResult.runData.variables)
        } else {
          const title = node.properties.title
          const vars: Record<string, any> = {}
          for (const k in nodeResult.runOutputs) {
            vars[`${title}.${k}`] = nodeResult.runOutputs[k]
          }
          assignVariables(currentVariables, vars)
        }
        variablesMap.set(nodeId, currentVariables)
        executed.add(nodeId)
        results.set(nodeId, nodeResult)
        calcNextNode(node)
      } else if (nodeResult.status === 'error') {
        executed.add(nodeId)
        errors.push(
          wtl(
            opts.execContext.lang,
            'WfNodeError',
            node.properties.title,
            nodeResult.statusMsg
          )
        )
        results.set(nodeId, nodeResult)
      } else if (nodeResult.status === 'pause') {
        executed.add(nodeId)
        results.set(nodeId, nodeResult)
        // pause 状态停止执行
        data.status = 'pause'
        opts.onStatusChange!(data, 'pause', nodeResult.statusMsg)
        opts.onFinish!(data, false, errors, results)
        return { success: false, errors, results }
      }
    }

    const hasErrors = errors.length > 0
    data.status = hasErrors ? 'error' : 'success'
    opts.onStatusChange!(data, data.status, '')
    opts.onFinish!(data, !hasErrors, errors, results)
    return { success: !hasErrors, errors, results }
  }

  return { cancel: () => controller.abort(), result }
}
