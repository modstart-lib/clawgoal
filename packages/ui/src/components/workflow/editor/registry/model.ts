import { HtmlNodeModel, IHtmlNodeProperties } from '@logicflow/core'
import { i18n } from '@/locale'

export interface VueCustomProperties extends IHtmlNodeProperties {
  width?: number
  height?: number
  title?: string
  icon?: string
  status?: string
  statusMsg?: string
  inputs?: any[]
  outputs?: any[]
  inputFields?: any[]
  outputFields?: any[]
  runInputs?: Record<string, any>
  runOutputs?: Record<string, any>
  runData?: Record<string, any>
  data?: Record<string, any>
}

/** 画布节点固定初始宽度，不从 properties 读取 */
const NODE_DEFAULT_WIDTH = 220

export class VueNodeModel extends HtmlNodeModel<VueCustomProperties> {
  setAttributes() {
    super.setAttributes()
    // 始终使用固定宽度，高度由 ResizeObserver 动态更新
    this.width = NODE_DEFAULT_WIDTH
  }

  getAnchorStyle() {
    return {
      r: 5,
      stroke: '#6366f1',
      strokeWidth: 1.5,
      fill: '#fff',
      hover: { r: 6, fill: '#6366f1' },
    }
  }

  getDefaultAnchor() {
    const { x, y, width, height } = this
    const { outputs } = this.properties
    const anchors: Array<{ x: number; y: number; id: string; type: string }> =
      []

    // 锚点圆心推出节点边缘 6px，使视觉上一半在节点内一半在外
    const ANCHOR_OFFSET = 6

    // 左侧输入锚点
    anchors.push({
      x: x - width / 2 - ANCHOR_OFFSET,
      y,
      id: 'in',
      type: 'left',
    })

    // 右侧输出锚点，ID 来自 outputs 定义
    if (outputs && outputs.length > 0) {
      if (outputs.length === 1) {
        anchors.push({
          x: x + width / 2 + ANCHOR_OFFSET,
          y,
          id: outputs[0].id,
          type: 'right',
        })
      } else {
        const step = height / (outputs.length + 1)
        outputs.forEach((output: { id: string }, i: number) => {
          anchors.push({
            x: x + width / 2 + ANCHOR_OFFSET,
            y: y - height / 2 + step * (i + 1),
            id: output.id,
            type: 'right',
          })
        })
      }
    } else {
      // 无 outputs 定义时退回默认右侧锚点
      anchors.push({
        x: x + width / 2 + ANCHOR_OFFSET,
        y,
        id: 'out',
        type: 'right',
      })
    }

    return anchors
  }

  setHovered(flag: boolean) {
    super.setHovered(flag)
  }

  getConnectedSourceRules() {
    const rules = super.getConnectedSourceRules()
    rules.push({
      message: i18n.global.t('workflowEditor.cantConnectFromInput'),
      validate(
        _sourceNode: any,
        _targetNode: any,
        sourceAnchor: any,
        _targetAnchor: any
      ) {
        return sourceAnchor.id !== 'in'
      },
    })
    return rules
  }

  getConnectedTargetRules() {
    const rules = super.getConnectedTargetRules()
    rules.push({
      message: i18n.global.t('workflowEditor.cantConnectToOutput'),
      validate(
        _sourceNode: any,
        _targetNode: any,
        _sourceAnchor: any,
        targetAnchor: any
      ) {
        return targetAnchor.id === 'in'
      },
    })
    return rules
  }

  setSelected(flag: boolean) {
    super.setSelected(flag)
  }
}

export default VueNodeModel
