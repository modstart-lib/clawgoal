import type {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowSchedule,
} from '../../type.js'
import { wt } from '../../i18n.js'

export default {
  async run(
    _controller: NodeRunController,
    param: NodeRunParam,
    ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    const options: Array<{ id: string; label: string }> =
      param.node.properties.data?.options || []
    const selected: string | undefined =
      param.node.properties.data?.selectedChoice

    if (selected) {
      const opt = options.find((o) => o.id === selected)
      return {
        status: 'success',
        statusMsg: `${wt(ctx, 'WfAsksSelected')}: ${opt?.label ?? selected}`,
        runOutputs: { choice: opt?.label ?? selected },
        runData: { selectedChoice: selected, options },
      }
    }

    return {
      status: 'pause',
      statusMsg: wt(ctx, 'WfAsksWaiting'),
      runOutputs: {},
      runData: { options },
    }
  },
} satisfies WorkflowSchedule
