export type NodeFieldType =
  | 'text'
  | 'textarea'
  | 'file'
  | 'files'
  | 'select'
  | 'json'

export interface NodeField {
  type: NodeFieldType
  name: string
  defaultValue?: string | string[] | object
  placeholder?: string
  value?: string | string[] | object
  fileExtensions?: string[]
  selectOptions?: string[]
}

export interface NodeSelectorItem {
  type: string
  title: string
  description: string
}

export interface WorkflowNodeDef {
  type: string
  title: string
  icon: string | any
  description: string
  component: any
  configComponent?: any
  inputFields: NodeField[]
  outputFields: NodeField[]
}

// 前端本地节点执行相关类型（供 FunctionCall 扩展节点使用）
export type NodeRunController = Record<string, any>
export type NodeRunParam = Record<string, any>
export type NodeRunResult = Record<string, any>
