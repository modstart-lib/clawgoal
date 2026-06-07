import type LogicFlow from '@logicflow/core'
import VueNodeView from './view'
import VueNodeModel from './model'

export interface VueNodeConfig {
  type: string
  component: any
}

export const vueNodesMap: Record<string, VueNodeConfig> = {}

export function register(config: VueNodeConfig, lf: LogicFlow) {
  vueNodesMap[config.type] = config
  lf.register({
    type: config.type,
    view: VueNodeView,
    model: VueNodeModel,
  })
}
