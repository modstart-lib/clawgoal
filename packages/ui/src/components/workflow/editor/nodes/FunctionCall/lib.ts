import type {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
} from '../../core/type'

export interface FunctionCallNodeDef {
  name: string
  title: string
  description?: string
  icon?: string | any
  inputFields?: any[]
  outputFields?: any[]
  /** 画布节点视图的 Vue 组件（透传显示，外观与普通节点一致） */
  viewComp?: any
  /** 配置/视图的 Vue 组件 */
  comp?: any
  /** 后端执行函数（前端注册，供本地执行用） */
  run?: (
    controller: NodeRunController,
    param: NodeRunParam
  ) => Promise<NodeRunResult>
}

const _nodes: FunctionCallNodeDef[] = []

/** 注册一个自定义函数节点 */
export function registerFunctionCallNode(def: FunctionCallNodeDef) {
  const idx = _nodes.findIndex((n) => n.name === def.name)
  if (idx >= 0) _nodes[idx] = def
  else _nodes.push(def)
}

/** 获取所有已注册的函数节点 */
export function getFunctionCallNodes(): FunctionCallNodeDef[] {
  return _nodes
}
