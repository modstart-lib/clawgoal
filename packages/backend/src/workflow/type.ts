export type NodeFieldType =
  | 'text'
  | 'textarea'
  | 'file'
  | 'files'
  | 'select'
  | 'json'

export interface NodeAnchor {
  id: string
  type: string
}

export interface NodeField {
  type: NodeFieldType
  name: string
  defaultValue?: string | string[] | object
  placeholder?: string
  value?: string | string[] | object
  fileExtensions?: string[]
  selectOptions?: string[]
}

export type NodeStatus =
  | 'idle'
  | 'running'
  | 'pause'
  | 'success'
  | 'error'
  | 'success_ignore'
export type WorkflowStatus = 'idle' | 'running' | 'pause' | 'success' | 'error'

export interface NodeProperties {
  width: number
  height: number
  title: string
  icon: string
  status: NodeStatus
  statusMsg?: string
  inputs?: NodeAnchor[]
  outputs?: NodeAnchor[]
  inputFields?: NodeField[]
  outputFields?: NodeField[]
  runInputs?: Record<string, any>
  runOutputs?: Record<string, any>
  runData?: Record<string, any>
  runRuntime?: { variables: Record<string, any> }
  data?: { [key: string]: any }
  functionCallName?: string
}

export interface WorkflowNode {
  id: string
  type: string
  x: number
  y: number
  properties: NodeProperties
}

export interface WorkflowEdge {
  id: string
  type: string
  sourceNodeId?: string
  targetNodeId?: string
  sourceAnchorId?: string
  targetAnchorId?: string
  /** When true, this edge represents a back-edge (loop). The engine will reset the loop body and re-execute. */
  loopEdge?: boolean
}

export interface WorkflowData {
  status: WorkflowStatus
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewPositionX: number
  viewPositionY: number
  viewScale: number
  /** Maximum number of times any single loop back-edge may fire. Defaults to 16. */
  maxLoops?: number
}

export interface NodeRunParam {
  node: WorkflowNode
  variables: Record<string, any>
  runInputs: Record<string, any>
  runData: Record<string, any>
  /** Shared mutable context passed by reference across all nodes in a workflow execution. Mutations are immediately visible to subsequent nodes. */
  sharedContext: Record<string, any>
}

export interface NodeRunController {
  updateNodeData(
    nodeId: string,
    properties: Partial<{
      runInputs: NodeProperties['runInputs']
      runOutputs: NodeProperties['runOutputs']
      runData: NodeProperties['runData']
      data: NodeProperties['data']
    }>,
    merge: boolean
  ): void
  updateNodeRunData(nodeId: string, runData: NodeProperties['runData']): void
}

export type NodeRunResultStatus =
  | 'success'
  | 'pause'
  | 'error'
  | 'success_ignore'

export interface NodeRunResult {
  status: NodeRunResultStatus
  statusMsg: string
  runOutputs: Record<string, any>
  runData?: Record<string, any>
  pauseByType?: '' | 'task'
  pauseById?: string
}

export interface WorkflowSchedule {
  run(
    controller: NodeRunController,
    param: NodeRunParam,
    execContext: WorkflowExecuteContext
  ): Promise<NodeRunResult>
  check?(node: WorkflowNode, lang?: 'zh-CN' | 'en-US'): Promise<void>
}

export interface WorkflowExecuteContext {
  tenantId: number
  userId: number
  /** Language preference for node status messages. Defaults to 'zh-CN'. */
  lang?: 'zh-CN' | 'en-US'
  /** Optional shared mutable context passed to every node. Initialized once, mutated by nodes. */
  sharedContext?: Record<string, any>
}
