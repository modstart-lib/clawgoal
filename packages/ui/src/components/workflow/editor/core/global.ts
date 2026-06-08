import type LogicFlow from '@logicflow/core'

let _editor: LogicFlow | null = null

export const setEditor = (lf: LogicFlow) => {
  _editor = lf
}
export const getEditor = (): LogicFlow => _editor as LogicFlow
export const getGraphModel = () => getEditor().graphModel

export const setNodePropertiesById = (
  nodeId: string,
  properties: Record<string, any>
) => {
  const node = getEditor().getNodeModelById(nodeId)
  if (node) {
    node.setProperties({ ...node.getProperties(), ...properties })
  }
}

export const getNodePropertiesById = (nodeId: string): any => {
  const node = getEditor().getNodeModelById(nodeId)
  return node ? node.getProperties() : null
}

export const getNodeNewTitle = (title: string): string => {
  const nodesMap: Record<string, string> = {}
  getGraphModel().nodes.forEach((node) => {
    const t = (node.getProperties() as any).title
    if (t) nodesMap[t] = node.id
  })
  if (!nodesMap[title]) return title
  let index = 1
  let newTitle = `${title}(${index})`
  while (nodesMap[newTitle]) {
    index++
    newTitle = `${title}(${index})`
  }
  return newTitle
}

export const isNodeTitleValid = (nodeId: string, title: string): boolean => {
  const nodesMap: Record<string, string> = {}
  getGraphModel().nodes.forEach((node) => {
    const t = (node.getProperties() as any).title
    if (t) nodesMap[t] = node.id
  })
  if (!nodesMap[title]) return true
  return nodesMap[title] === nodeId
}

export const setNodeTitle = (nodeId: string, title: string): boolean => {
  const node = getEditor().getNodeModelById(nodeId)
  if (!node) return false
  if (!isNodeTitleValid(nodeId, title)) return false
  setNodePropertiesById(nodeId, { title })
  return true
}

export const getGraphData = () => getEditor().getGraphData()
