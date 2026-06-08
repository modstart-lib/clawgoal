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
    const { regex } = param.node.properties.data || {}
    if (!regex) {
      result.statusMsg = wt(ctx, 'WfRegexNotConfigured')
      return result
    }
    const inputText = param.runInputs['Value']
    if (!inputText) {
      result.statusMsg = wt(ctx, 'WfInputTextEmpty')
      return result
    }
    try {
      const reg = new RegExp(regex)
      const matches = String(inputText).match(reg)
      result.runOutputs['Value'] = matches ? matches[1] || '' : ''
      result.statusMsg = wt(ctx, 'WfExtractSuccess')
      result.status = 'success'
    } catch (e) {
      result.statusMsg = wt(ctx, 'WfRegexError') + ': ' + (e as Error).message
    }
    return result
  },
  async check(node: WorkflowNode, lang?: 'zh-CN' | 'en-US') {
    const { regex } = node.properties.data || {}
    if (!regex) throw new Error(wtl(lang, 'WfRegexNotConfiguredCheck'))
    try {
      new RegExp(regex)
    } catch (e) {
      throw new Error(wtl(lang, 'WfRegexInvalidDetail', (e as Error).message))
    }
  },
} satisfies WorkflowSchedule
