import { promises as fs } from 'fs'
import path from 'path'
import {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowNode,
  WorkflowSchedule,
} from '../../type.js'
import { wt, wtl } from '../../i18n.js'

function detectImageType(base64: string): string {
  const buf = Buffer.from(base64.slice(0, 8), 'base64')
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png'
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg'
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'gif'
  return 'jpg'
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
    }
    const { serverUrl, selectedTool } = param.node.properties.data || {}
    if (!serverUrl || !selectedTool) {
      result.statusMsg = wt(ctx, 'WfMcpNotConfigured')
      return result
    }
    const args: Record<string, any> = {}
    for (const field of param.node.properties.inputFields || []) {
      args[field.name] = param.runInputs[field.name] ?? {}
    }
    try {
      const resp = await fetch(String(serverUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: selectedTool, arguments: args },
        }),
      })
      const json: any = await resp.json()
      const content: any[] = json?.result?.content || []
      let textOutput = ''
      let imageOutput = ''
      for (const item of content) {
        if (item.type === 'text') {
          textOutput += item.text
        } else if (item.type === 'image' && item.data) {
          const ext = detectImageType(item.data)
          const tmpPath = path.join(
            process.cwd(),
            'data',
            'uploads',
            `mcp_${Date.now()}.${ext}`
          )
          await fs.mkdir(path.dirname(tmpPath), { recursive: true })
          await fs.writeFile(tmpPath, Buffer.from(item.data, 'base64'))
          imageOutput = tmpPath
        }
      }
      result.runOutputs['Text'] = textOutput
      result.runOutputs['Image'] = imageOutput
      result.statusMsg = wt(ctx, 'WfExecuteSuccess')
      result.status = 'success'
    } catch (e) {
      result.statusMsg = wt(ctx, 'WfMcpError') + ': ' + String(e)
    }
    return result
  },
  async check(node: WorkflowNode, lang?: 'zh-CN' | 'en-US') {
    const { serverUrl, selectedTool } = node.properties.data || {}
    if (!serverUrl || !selectedTool)
      throw new Error(wtl(lang, 'WfMcpNotConfiguredCheck'))
  },
} satisfies WorkflowSchedule
