import { promises as fs } from 'fs'
import path from 'path'
import {
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
    const result: NodeRunResult = {
      status: 'error',
      statusMsg: wt(ctx, 'WfUnknownError'),
      runOutputs: {},
    }
    const from_ = param.runInputs['Src']
    const to_ = param.runInputs['Dest']
    if (!from_) {
      result.statusMsg = wt(ctx, 'WfSrcFileNotConfigured')
      return result
    }
    if (!to_) {
      result.statusMsg = wt(ctx, 'WfDstPathNotConfigured')
      return result
    }
    try {
      const overwrite: boolean = param.node.properties.data?.overwrite ?? false
      let targetPath = String(to_)
      if (!overwrite) {
        let exists = await fs
          .access(targetPath)
          .then(() => true)
          .catch(() => false)
        let counter = 1
        while (exists) {
          const ext = path.extname(targetPath)
          const base = targetPath.slice(0, targetPath.length - ext.length)
          targetPath = `${base}_${counter}${ext}`
          exists = await fs
            .access(targetPath)
            .then(() => true)
            .catch(() => false)
          counter++
        }
      }
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.rename(String(from_), targetPath)
      result.runOutputs['File'] = targetPath
      result.statusMsg = wt(ctx, 'WfFileMoveSuccess')
      result.status = 'success'
    } catch (e) {
      result.statusMsg = wt(ctx, 'WfFileMoveError') + ': ' + String(e)
    }
    return result
  },
  async check() {},
} satisfies WorkflowSchedule
