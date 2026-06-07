import {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowNode,
  WorkflowSchedule,
} from '../../type.js'
import { modelCall } from '../../../model/model/index.js'
import { getModelConfigList } from '../../../config/index.js'
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
    const prompt = param.runInputs['Prompt'] || ''
    if (!prompt) {
      result.statusMsg = wt(ctx, 'WfPromptRequired')
      return result
    }
    const nameRef: string = param.node.properties.data?.model || ''
    const resolvedRef =
      !nameRef || nameRef === 'default' || !nameRef.includes('|')
        ? 'default'
        : nameRef
    const modelConfigList = await getModelConfigList(
      ctx.userId,
      ctx.tenantId,
      resolvedRef
    )
    if (!modelConfigList || modelConfigList.length === 0) {
      result.statusMsg = wt(ctx, 'WfModelNotConfigured')
      return result
    }
    const format: string = param.node.properties.data?.format || 'text'
    try {
      const ret = await modelCall({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        biz: 'flow_llm',
        bizId: param.node.id,
        userPrompt: prompt,
        modelConfigList,
      })
      if (!ret) {
        result.statusMsg = wt(ctx, 'WfModelCallFailed')
        return result
      }
      let content = ''
      if (ret.type === 'text') {
        content = ret.content
      } else if (ret.type === 'json') {
        content = JSON.stringify(ret.data)
      }
      result.runOutputs['Text'] = content
      result.runOutputs['Json'] = {}
      if (format === 'json' && content) {
        let c = content.trim()
        if (/^```json/.test(c))
          c = c
            .replace(/^```json/, '')
            .replace(/```$/, '')
            .trim()
        else if (/^```/.test(c))
          c = c.replace(/^```/, '').replace(/```$/, '').trim()
        try {
          result.runOutputs['Json'] = JSON.parse(c)
        } catch {
          result.statusMsg = wt(ctx, 'WfParseResponseFailed') + ': ' + c
          return result
        }
      }
      result.status = 'success'
      result.statusMsg = wt(ctx, 'WfExecuteSuccess')
    } catch (err) {
      result.statusMsg = wt(ctx, 'WfModelCallError') + ': ' + String(err)
    }
    return result
  },
  async check(node: WorkflowNode, lang?: 'zh-CN' | 'en-US') {
    if (!node.properties.data?.model)
      throw new Error(wtl(lang, 'WfModelNotConfiguredCheck'))
  },
} satisfies WorkflowSchedule
