import {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowNode,
  WorkflowSchedule,
} from '../../type.js'
import { resolveVariables } from '../../variable.js'
import { modelCall } from '../../../model/model/index.js'
import { getModelConfigList } from '../../../config/index.js'
import { wt, wtl } from '../../i18n.js'

interface SmartRouterBranch {
  id: string
  name: string
  description: string
}

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

    const data = param.node.properties.data || {}
    const branches: SmartRouterBranch[] = data.branches || []
    const nameRef: string = data.model || ''
    const resolvedRef =
      !nameRef || nameRef === 'default' || !nameRef.includes('|')
        ? 'default'
        : nameRef

    if (branches.length === 0) {
      result.statusMsg = wt(ctx, 'WfBranchNotConfigured')
      return result
    }

    const inputField = param.node.properties.inputFields?.find(
      (f: any) => f.name === 'Input'
    )
    const rawInput = inputField?.value || ''
    const input = resolveVariables(rawInput, param.variables, rawInput)

    if (!input) {
      result.statusMsg = wt(ctx, 'WfInputEmpty')
      return result
    }

    const branchLines = branches
      .map((b, i) => `${i + 1}. ${b.name}: ${b.description}`)
      .join('\n')

    const systemPrompt = `${wt(ctx, 'WfSmartRouterPrompt')}\n${branchLines}`

    const modelConfigList = await getModelConfigList(
      ctx.userId,
      ctx.tenantId,
      resolvedRef
    )
    if (!modelConfigList || modelConfigList.length === 0) {
      result.statusMsg = wt(ctx, 'WfSmartRouterModelNotConfigured')
      return result
    }

    try {
      const ret = await modelCall({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        biz: 'flow_smart_router',
        bizId: param.node.id,
        systemPrompt,
        userPrompt: String(input),
        modelConfigList,
      })

      if (!ret) {
        result.statusMsg = wt(ctx, 'WfSmartRouterCallFailed')
        return result
      }

      const content = ret.type === 'text' ? ret.content.trim() : ''
      const matched = branches.find(
        (b) => b.name === content || content.includes(b.name)
      )

      result.runData!['Next'] = matched ? matched.id : 'default'
      result.runOutputs['branch'] = matched ? matched.name : 'default'
      result.status = 'success'
      result.statusMsg = `${wt(ctx, 'WfSmartRouterRoutedTo')}: ${matched ? matched.name : wt(ctx, 'WfSmartRouterDefault')}`
    } catch (err) {
      result.statusMsg = wt(ctx, 'WfSmartRouterCallError') + ': ' + String(err)
    }

    return result
  },

  async check(node: WorkflowNode, lang?: 'zh-CN' | 'en-US') {
    const data = node.properties.data || {}
    if (!data.model) throw new Error(wtl(lang, 'WfModelNotConfiguredCheck'))
    if (!data.branches || data.branches.length === 0)
      throw new Error(wtl(lang, 'WfBranchNotConfiguredCheck'))
  },
} satisfies WorkflowSchedule
