import type {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowNode,
  WorkflowSchedule,
} from '../../type.js'
import { wt, wtl } from '../../i18n.js'

export default {
  async check(node: WorkflowNode, lang?: 'zh-CN' | 'en-US'): Promise<void> {
    if (!node.properties.data?.url) {
      throw new Error(wtl(lang, 'WfUrlRequired'))
    }
  },

  async run(
    _controller: NodeRunController,
    param: NodeRunParam,
    ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    const {
      url,
      method = 'GET',
      headers,
      body,
    } = param.node.properties.data || {}
    if (!url) {
      return {
        status: 'error',
        statusMsg: wt(ctx, 'WfUrlRequired'),
        runOutputs: {},
      }
    }

    let parsedHeaders: Record<string, string> = {}
    if (headers) {
      try {
        parsedHeaders = JSON.parse(headers)
      } catch {
        return {
          status: 'error',
          statusMsg: wt(ctx, 'WfHeadersInvalidJson'),
          runOutputs: {},
        }
      }
    }

    let parsedBody: any
    if (body && method !== 'GET') {
      try {
        parsedBody = JSON.parse(body)
        parsedHeaders['Content-Type'] =
          parsedHeaders['Content-Type'] || 'application/json'
      } catch {
        parsedBody = body
      }
    }

    const resp = await fetch(url, {
      method,
      headers: parsedHeaders,
      body: parsedBody !== undefined ? JSON.stringify(parsedBody) : undefined,
    })

    let responseData: any
    const contentType = resp.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      responseData = await resp.json()
    } else {
      responseData = await resp.text()
    }

    const statusCode = resp.status
    if (!resp.ok) {
      return {
        status: 'error',
        statusMsg: `HTTP ${statusCode}`,
        runOutputs: { response: responseData, statusCode },
      }
    }

    return {
      status: 'success',
      runOutputs: { response: responseData, statusCode },
      runData: { statusCode },
    }
  },
} satisfies WorkflowSchedule
