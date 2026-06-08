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
    const folder = param.runInputs['Dir']
    if (!folder) {
      result.statusMsg = wt(ctx, 'WfFolderPathNotConfigured')
      return result
    }
    try {
      const entries = await fs.readdir(String(folder), { withFileTypes: true })
      const EXCLUDES = ['.DS_Store', 'Thumbs.db']
      const ext = param.node.properties.data?.ext || ''
      const filePaths = entries
        .filter((e) => {
          if (!e.isFile() || EXCLUDES.includes(e.name)) return false
          if (ext) return e.name.endsWith(ext)
          return true
        })
        .map((e) => path.join(String(folder), e.name))
      result.runOutputs['Files'] = filePaths
      result.statusMsg = wt(ctx, 'WfFilesFound', filePaths.length)
      result.status = 'success'
    } catch (e) {
      result.statusMsg = wt(ctx, 'WfFileListError') + ': ' + String(e)
    }
    return result
  },
  async check() {},
} satisfies WorkflowSchedule
