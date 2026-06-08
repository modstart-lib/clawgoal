import type {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowSchedule,
} from '../../type.js'

export default {
  async run(
    _controller: NodeRunController,
    param: NodeRunParam
  ): Promise<NodeRunResult> {
    const ms = Number(param.node.properties.data?.ms ?? 1000)
    await new Promise<void>((resolve) => setTimeout(resolve, ms))
    return { status: 'success', runOutputs: {}, runData: { waited: ms } }
  },
} satisfies WorkflowSchedule
