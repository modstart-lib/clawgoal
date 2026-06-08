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
      runData: {},
    }
    const { code } = param.node.properties.data || {}
    if (!code) {
      result.statusMsg = wt(ctx, 'WfCodeNotConfigured')
      return result
    }
    const inputData = param.runInputs['Value']
    if (inputData === undefined) {
      result.statusMsg = wt(ctx, 'WfInputDataEmpty')
      return result
    }
    try {
      const trimmed = code.trim()
      let output: any
      if (
        trimmed.startsWith('function') ||
        trimmed.startsWith('async function')
      ) {
        const fn = new Function('input', `return (${trimmed})(input);`)
        output = fn(inputData)
      } else {
        const fn = new Function('input', code)
        output = fn(inputData)
      }
      const finalOutput = output instanceof Promise ? await output : output
      result.runOutputs['Value'] = finalOutput
      result.statusMsg = wt(ctx, 'WfExecuteSuccess')
      result.status = 'success'
    } catch (e) {
      result.statusMsg = wt(ctx, 'WfExecuteError') + ': ' + (e as Error).message
    }
    return result
  },
  async check(node: WorkflowNode, lang?: 'zh-CN' | 'en-US') {
    const { code } = node.properties.data || {}
    if (!code) throw new Error(wtl(lang, 'WfCodeNotConfiguredCheck'))
  },
} satisfies WorkflowSchedule
