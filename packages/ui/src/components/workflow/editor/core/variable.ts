import { getEditor } from './global'

export interface VariableItem {
  node: string
  name: string
}

/**
 * 根据 RAG（图的可达祖先）计算当前节点可用的所有变量。
 * 返回由近及远排序，Variable 节点的全局变量 node 为空字符串。
 */
export function listAllVariables(nodeId: string): VariableItem[] {
  const editor = getEditor()
  if (!editor) return []
  const nodes = editor.graphModel.nodes
  const edges = editor.graphModel.edges
  const variables: VariableItem[] = []

  if (!nodeId || nodeId === 'start') return variables

  const getAncestors = (id: string): string[] => {
    const visited = new Set<string>()
    const distance = new Map<string, number>()
    const queue = [id]
    distance.set(id, 0)
    visited.add(id)

    while (queue.length > 0) {
      const current = queue.shift()!
      edges.forEach((edge: any) => {
        if (edge.targetNodeId === current && !visited.has(edge.sourceNodeId)) {
          visited.add(edge.sourceNodeId)
          distance.set(edge.sourceNodeId, distance.get(current)! + 1)
          queue.push(edge.sourceNodeId)
        }
      })
    }

    visited.delete(id)
    return Array.from(visited).sort(
      (a, b) => distance.get(a)! - distance.get(b)!
    )
  }

  const ancestorIds = getAncestors(nodeId)
  ancestorIds.forEach((id) => {
    const node = nodes.find((n: any) => n.id === id)
    if (!node || !node.properties) return
    const props = node.properties as any
    if ((node.type as string) === 'Variable') {
      if (props.runData?.variables) {
        Object.keys(props.runData.variables).forEach((varName: string) => {
          variables.push({ node: '', name: varName })
        })
      }
    } else if (props.outputFields?.length) {
      props.outputFields.forEach((field: { name: string }) => {
        variables.push({ node: props.title || '', name: field.name })
      })
    }
  })

  return variables
}
