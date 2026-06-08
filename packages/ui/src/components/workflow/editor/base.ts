import type LogicFlow from '@logicflow/core'
import type { WorkflowNodeDef } from './core/type'
import { register } from './registry/index'
import DefaultEdge from './core/DefaultEdge'
import LoopEdge from './core/LoopEdge'
import { registerFunctionCallNode } from './nodes/FunctionCall/lib'

import StartNode from './nodes/Start/index'
import EndNode from './nodes/End/index'
import LLMNode from './nodes/LLM/index'
import IfElseNode from './nodes/IfElse/index'
import JsRunnerNode from './nodes/JsRunner/index'
import VariableNode from './nodes/Variable/index'
import RandomValueNode from './nodes/RandomValue/index'
import RegexExtractNode from './nodes/RegexExtract/index'
import FileCopyNode from './nodes/FileCopy/index'
import FileMoveNode from './nodes/FileMove/index'
import FileListNode from './nodes/FileList/index'
import McpToolsCallNode from './nodes/McpToolsCall/index'
import FunctionCallNode from './nodes/FunctionCall/index'
import AsksNode from './nodes/Asks/index'
import SmartRouterNode from './nodes/SmartRouter/index'
import DelayNode from './nodes/Delay/index'
import HttpRequestNode from './nodes/HttpRequest/index'

// 可由宿主包（如 ui-flow）注入的扩展节点，通过 setUserNodes 设置
let _userNodes: WorkflowNodeDef[] = []

/** 注册扩展节点（由 ui-flow 等宿主包在初始化时调用） */
export function setUserNodes(nodes: WorkflowNodeDef[]) {
  _userNodes = nodes
}

export const userNodes: WorkflowNodeDef[] = new Proxy([] as WorkflowNodeDef[], {
  get(_, prop) {
    if (prop === 'length') return _userNodes.length
    if (typeof prop === 'string' && !isNaN(Number(prop)))
      return _userNodes[Number(prop)]
    return (_userNodes as any)[prop]
  },
})

/** 在节点选择器中展示的内置节点列表 */
export const builtinNodes = [
  StartNode,
  LLMNode,
  IfElseNode,
  JsRunnerNode,
  VariableNode,
  RandomValueNode,
  RegexExtractNode,
  FileCopyNode,
  FileMoveNode,
  FileListNode,
  McpToolsCallNode,
  AsksNode,
  SmartRouterNode,
  DelayNode,
  HttpRequestNode,
]

export const initEditor = (lf: LogicFlow) => {
  // 将 userNodes 自动注册为 FunctionCall 子类型（画布上以 FunctionCall 实例化）
  userNodes.forEach((node) => {
    registerFunctionCallNode({
      name: node.type,
      title: node.title,
      description: node.description,
      viewComp: node.component,
      inputFields: node.inputFields,
      outputFields: node.outputFields,
    })
  })

  // 注册全部节点（含扩展 + 旧 FunctionCall 兼容）
  const allNodes = [...builtinNodes, ...userNodes, FunctionCallNode, EndNode]
  for (const node of allNodes) {
    register({ type: node.type, component: node.component }, lf)
  }
  lf.register(DefaultEdge)
  lf.register(LoopEdge)
  // 'flow' 是 seed/历史数据中使用的边类型名，注册为别名以兼容旧数据
  lf.register({ ...DefaultEdge, type: 'flow' })
  lf.setDefaultEdgeType(DefaultEdge.type)
  lf.setTheme({
    bezier: { stroke: '#afafaf', strokeWidth: 1 },
  })
}

export {
  StartNode,
  LLMNode,
  IfElseNode,
  JsRunnerNode,
  VariableNode,
  RandomValueNode,
  RegexExtractNode,
  FileCopyNode,
  FileMoveNode,
  FileListNode,
  McpToolsCallNode,
  FunctionCallNode,
  EndNode,
  DelayNode,
  HttpRequestNode,
}
