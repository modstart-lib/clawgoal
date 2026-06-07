import { BezierEdge, BezierEdgeModel } from '@logicflow/core'

/**
 * LoopEdge — a back-edge (cycle) rendered as a bezier curve routed below
 * the main horizontal flow to avoid overlapping with forward edges.
 */
class LoopEdgeModel extends BezierEdgeModel {
  initPoints() {
    super.initPoints()
    const { startPoint: sp, endPoint: ep } = this
    if (!sp || !ep) return
    const offset: number = (this.properties as any).loopOffset ?? 80
    const belowY = Math.max(sp.y, ep.y) + offset
    const midX = (sp.x + ep.x) / 2
    ;(this as any).path =
      `M ${sp.x} ${sp.y} ` +
      `C ${sp.x + 40} ${sp.y},${sp.x + 40} ${belowY},${midX} ${belowY} ` +
      `C ${ep.x - 40} ${belowY},${ep.x - 40} ${ep.y},${ep.x} ${ep.y}`
  }

  getEdgeStyle() {
    const style = super.getEdgeStyle()
    return { ...style, stroke: '#afafaf', strokeWidth: 1 }
  }

  getAdjustPointStyle() {
    return { r: 0, opacity: 0, fill: 'transparent', stroke: 'transparent' }
  }

  getAdjustLineStyle() {
    return { stroke: 'transparent', strokeWidth: 0 }
  }
}

class LoopEdgeView extends BezierEdge {}

const LoopEdge = {
  type: 'loop-edge',
  view: LoopEdgeView,
  model: LoopEdgeModel,
}

export default LoopEdge
