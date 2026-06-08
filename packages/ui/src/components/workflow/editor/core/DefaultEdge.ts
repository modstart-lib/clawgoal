import { BezierEdge, BezierEdgeModel } from '@logicflow/core'

class DefaultEdgeModel extends BezierEdgeModel {
  // 限制连线方向：只允许从 output 端（right类型）连到 input 端（left类型）
  isAllowConnectAsSource({ data }: any) {
    return data.type !== 'left'
  }

  isAllowConnectAsTarget({ data }: any) {
    return data.type !== 'right'
  }
  getEdgeStyle() {
    const style = super.getEdgeStyle()
    const status = (this.properties as any)?.status
    if (status === 'running-mode') {
      return {
        ...style,
        stroke: '#d1d5db',
        strokeDasharray: '6 3',
        strokeWidth: 1.5,
      }
    }
    if (status === 'stopped') {
      return { ...style, stroke: '#d1d5db', strokeWidth: 1.5 }
    }
    if (status === 'success') {
      return { ...style, stroke: '#86efac', strokeWidth: 2 }
    }
    if (status === 'error') {
      return { ...style, stroke: '#fca5a5', strokeWidth: 2 }
    }
    return { ...style, stroke: '#afafaf', strokeWidth: 1 }
  }

  getEdgeClass() {
    const status = (this.properties as any)?.status
    if (status === 'running-mode') return 'edge-running-mode'
    return ''
  }

  getAdjustPointStyle() {
    return { r: 0, opacity: 0, fill: 'transparent', stroke: 'transparent' }
  }

  getAdjustLineStyle() {
    return { stroke: 'transparent', strokeWidth: 0 }
  }
}

class DefaultEdgeView extends BezierEdge {}

const DefaultEdge = {
  type: 'default-edge',
  view: DefaultEdgeView,
  model: DefaultEdgeModel,
}

export default DefaultEdge
