/**
 * agentGraphBuilder — converts a declarative AgentGraphDefinition (from YAML)
 * into a WorkflowData object that can be executed by workflowExecute().
 *
 * YAML node type → WorkflowData node type mapping:
 *   model    → AgentModel
 *   router   → Router
 *   tool     → AgentTool
 *   subgraph → AgentSubgraph
 *
 * YAML edge → WorkflowEdge mapping:
 *   Simple edge  { from, to }           → single WorkflowEdge
 *   Conditional  { from, branches: [...] }:
 *     Each branch → a WorkflowEdge with sourceAnchorId = branch.equals ?? 'default'
 *     Branch with loop: true → WorkflowEdge with loopEdge: true
 *   Target '__end__' is omitted (engine naturally stops when no outgoing edge exists)
 */

import type {
  WorkflowData,
  WorkflowEdge,
  WorkflowNode,
} from '../../../backend/src/workflow/type.js'
import type { AgentGraphDefinition, AgentGraphNode } from '../types/index.js'

function nodeTypeMap(yamlType: AgentGraphNode['type']): string {
  switch (yamlType) {
    case 'model':
      return 'AgentModel'
    case 'router':
      return 'Router'
    case 'context_router':
      return 'ContextRouter'
    case 'tool':
      return 'AgentTool'
    case 'subgraph':
      return 'AgentSubgraph'
    case 'code':
      return 'AgentCode'
    default:
      return 'AgentModel'
  }
}

/**
 * Build the output anchor list for a node.
 * Router nodes and Code nodes get one anchor per branch; all other nodes get a single 'output' anchor.
 */
function buildOutputAnchors(
  yamlNode: AgentGraphNode,
  graph: AgentGraphDefinition
): string[] {
  if (
    yamlNode.type !== 'router' &&
    yamlNode.type !== 'context_router' &&
    yamlNode.type !== 'code'
  )
    return ['output']
  const outgoingEdge = graph.edges.find(
    (e) => e.from === yamlNode.name && e.condition !== undefined
  )
  if (!outgoingEdge?.branches) return ['output']
  return outgoingEdge.branches.map((b) => b.equals ?? 'default')
}

/** Convert YAML AgentGraphDefinition to WorkflowData */
export function buildWorkflowData(graph: AgentGraphDefinition): WorkflowData {
  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []
  let edgeSeq = 0

  const nextEdgeId = () => `e${++edgeSeq}`

  // Virtual Start node
  const startNodeId = '__start__'
  nodes.push({
    id: startNodeId,
    type: 'Start',
    x: 0,
    y: 0,
    properties: {
      width: 0,
      height: 0,
      title: 'Start',
      icon: '',
      status: 'idle',
      outputs: [{ id: 'output', type: 'default' }],
    },
  })

  // Edge from Start to entryPoint
  edges.push({
    id: nextEdgeId(),
    type: 'default',
    sourceNodeId: startNodeId,
    targetNodeId: graph.entryPoint,
    sourceAnchorId: 'output',
  })

  // Convert YAML nodes
  for (const yamlNode of graph.nodes) {
    const outputAnchorIds = buildOutputAnchors(yamlNode, graph)
    const wNode: WorkflowNode = {
      id: yamlNode.name,
      type: nodeTypeMap(yamlNode.type),
      x: 0,
      y: 0,
      properties: {
        width: 0,
        height: 0,
        title: yamlNode.name,
        icon: '',
        status: 'idle',
        inputs: [{ id: 'input', type: 'default' }],
        outputs: outputAnchorIds.map((id) => ({ id, type: 'default' })),
        data: {
          modelSlot: yamlNode.modelSlot,
          useTools: yamlNode.useTools,
          systemPromptExtra: yamlNode.systemPromptExtra,
          toolName: yamlNode.toolName,
          input: yamlNode.input,
          subgraphRole: yamlNode.subgraphRole,
          contextKey: yamlNode.contextKey,
          whenSet: yamlNode.whenSet,
          whenNotSet: yamlNode.whenNotSet,
          outputPattern: yamlNode.outputPattern,
          outputContextValue: yamlNode.outputContextValue,
          allowTools: yamlNode.allowTools,
          codeWorkflow: yamlNode.codeWorkflow,
          codeFn: yamlNode.codeFn,
          code: yamlNode.code,
          codeFile: yamlNode.codeFile,
        },
      },
    }
    nodes.push(wNode)
  }

  // Convert YAML edges
  for (const yamlEdge of graph.edges) {
    if (yamlEdge.to) {
      // Simple edge
      if (yamlEdge.to === '__end__') continue
      const simpleEdge: WorkflowEdge = {
        id: nextEdgeId(),
        type: 'default',
        sourceNodeId: yamlEdge.from,
        targetNodeId: yamlEdge.to,
        sourceAnchorId: 'output',
      }
      if (yamlEdge.loop) simpleEdge.loopEdge = true
      edges.push(simpleEdge)
    } else if (yamlEdge.branches) {
      // Conditional edge — one WorkflowEdge per branch
      for (const branch of yamlEdge.branches) {
        if (branch.next === '__end__') continue
        const anchorId = branch.equals ?? 'default'
        const wEdge: WorkflowEdge = {
          id: nextEdgeId(),
          type: 'default',
          sourceNodeId: yamlEdge.from,
          targetNodeId: branch.next,
          sourceAnchorId: anchorId,
        }
        if ((branch as any).loop) {
          wEdge.loopEdge = true
        }
        edges.push(wEdge)
      }
    }
  }

  return {
    status: 'idle',
    nodes,
    edges,
    viewPositionX: 0,
    viewPositionY: 0,
    viewScale: 1,
  }
}
