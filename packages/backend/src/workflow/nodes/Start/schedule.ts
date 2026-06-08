import {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowSchedule,
} from '../../type.js'

export default {
  async run(
    _controller: NodeRunController,
    param: NodeRunParam,
    _ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    return {
      status: 'success',
      statusMsg: '',
      runOutputs: JSON.parse(JSON.stringify(param.runInputs)),
    }
  },
  async check() {},
} satisfies WorkflowSchedule
