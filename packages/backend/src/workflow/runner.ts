import EventEmitter from 'events'
import { WorkflowData, WorkflowExecuteContext } from './type.js'
import { workflowExecute } from './engine.js'

interface RunEntry {
  cancel: () => void
  emitter: EventEmitter
}

const runMap = new Map<number, RunEntry>()

export type FlowEventType =
  | 'nodeStatusChange'
  | 'nodeDataChange'
  | 'nodeStart'
  | 'nodeFinish'
  | 'workflowStatusChange'
  | 'workflowFinish'
  | 'workflowLog'

export interface FlowEvent {
  type: FlowEventType
  logId: number
  [key: string]: any
}

export interface StartExecutionOptions {
  isContinue?: boolean
  stopNodeId?: string
}

export function startExecution(
  logId: number,
  data: WorkflowData,
  execContext: WorkflowExecuteContext,
  onEvent: (event: FlowEvent) => void,
  options: StartExecutionOptions = {}
): void {
  const emitter = new EventEmitter()
  emitter.on('event', onEvent)

  const emit = (type: FlowEventType, payload: Record<string, any>) => {
    emitter.emit('event', { type, logId, ...payload })
  }

  const { cancel, result } = workflowExecute(data, {
    execContext,
    isContinue: options.isContinue,
    stopNodeId: options.stopNodeId,
    onNodeStatusChange(d, nodeId, status, statusMsg) {
      emit('nodeStatusChange', {
        nodeId,
        status,
        statusMsg,
        nodeData: getNodeSnapshot(d, nodeId),
      })
    },
    onNodeDataChange(d, nodeId, properties) {
      emit('nodeDataChange', { nodeId, properties })
    },
    onNodeStart(d, nodeId, param) {
      emit('nodeStart', { nodeId, runInputs: param.runInputs })
    },
    onNodeFinish(d, nodeId, result) {
      emit('nodeFinish', { nodeId, result })
    },
    onStatusChange(d, status, statusMsg) {
      emit('workflowStatusChange', { status, statusMsg })
    },
    onFinish(d, success, errors, results) {
      const resultsObj: Record<string, any> = {}
      results.forEach((v, k) => {
        resultsObj[k] = v
      })
      emit('workflowFinish', { success, errors, results: resultsObj })
      runMap.delete(logId)
    },
    onLog(d, level, message) {
      emit('workflowLog', { level, message })
    },
  })

  runMap.set(logId, { cancel, emitter })

  // kick off async execution after current call stack unwinds,
  // so the HTTP response is sent first and the client can subscribe via WS before events fire
  setImmediate(() => {
    result().catch((err) => {
      emit('workflowLog', { level: 'error', message: String(err) })
      emit('workflowFinish', {
        success: false,
        errors: [String(err)],
        results: {},
      })
      runMap.delete(logId)
    })
  })
}

export function cancelExecution(logId: number): boolean {
  const entry = runMap.get(logId)
  if (!entry) return false
  entry.cancel()
  runMap.delete(logId)
  return true
}

export function isRunning(logId: number): boolean {
  return runMap.has(logId)
}

function getNodeSnapshot(data: WorkflowData, nodeId: string) {
  const node = data.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  return {
    type: node.type,
    status: node.properties.status,
    statusMsg: node.properties.statusMsg,
    runInputs: node.properties.runInputs,
    runOutputs: node.properties.runOutputs,
    runData: node.properties.runData,
  }
}
