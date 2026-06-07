import {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowSchedule,
} from '../../type.js'
import { resolveVariables } from '../../variable.js'
import { wt } from '../../i18n.js'

export default {
  async run(
    _controller: NodeRunController,
    param: NodeRunParam,
    ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    const variables = param.node.properties.data?.variables
    if (!variables || variables.length === 0) {
      return {
        status: 'error',
        statusMsg: wt(ctx, 'WfVariableNotConfigured'),
        runOutputs: {},
      }
    }
    const resultVariables: Record<string, any> = {}
    for (const variable of variables) {
      resultVariables[variable.name] = resolveVariables(
        variable.value,
        param.variables,
        ''
      )
    }
    return {
      status: 'success',
      statusMsg: '',
      runOutputs: {},
      runData: { variables: resultVariables },
    }
  },
  async check() {},
} satisfies WorkflowSchedule
