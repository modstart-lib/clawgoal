import {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowNode,
  WorkflowSchedule,
} from '../../type.js'
import { wt, wtl } from '../../i18n.js'

export default {
  async run(
    _controller: NodeRunController,
    param: NodeRunParam,
    ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    const result: NodeRunResult = {
      status: 'error',
      statusMsg: wt(ctx, 'WfUnknownError'),
      runOutputs: {},
    }
    const { values } = param.node.properties.data || {}
    if (!values || !Array.isArray(values) || values.length === 0) {
      result.statusMsg = wt(ctx, 'WfRandomListNotConfigured')
      return result
    }
    const idx = Math.floor(Math.random() * values.length)
    result.runOutputs['Value'] = values[idx]
    result.statusMsg = wt(ctx, 'WfRandomSelectSuccess')
    result.status = 'success'
    return result
  },
  async check(node: WorkflowNode, lang?: 'zh-CN' | 'en-US') {
    const { values } = node.properties.data || {}
    if (!values || !Array.isArray(values) || values.length === 0)
      throw new Error(wtl(lang, 'WfRandomListNotConfiguredCheck'))
  },
} satisfies WorkflowSchedule
