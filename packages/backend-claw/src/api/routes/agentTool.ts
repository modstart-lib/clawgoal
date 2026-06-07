/**
 * AgentTool API routes
 *
 * Routes:
 *   POST /claw/agentTool/getLogs — 通过 toolCallId 获取工具调用日志（结构化）
 */
import { Router, type IRouter } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants.js'
import { apiHandler } from '../../../../backend/src/utils/api.js'
import { error, success } from '../../../../backend/src/utils/response.js'
import { useI18n } from '../../locale/index.js'
import { clawDb } from '../../storage/store/index.js'

const router: IRouter = Router()

export interface ToolLogItem {
  type: 'text' | 'action'
  /** 动作标题（type=action 时有值，如"读取文件"、"写入文件"） */
  title?: string
  /** 内容文本 */
  content: string
  /** 动作状态（type=action 时有值） */
  status?: 'running' | 'success' | 'error'
}

/**
 * 将原始 logs 文本解析为结构化日志条目数组。
 *
 * 原始格式每行：`[status] title: content` 或 `[status] title`
 * - status 为 running/success/error 时 → type=action
 * - 其他内容 → type=text，相邻 text 行自动合并
 *
 * 当工具整体已完成（toolStatus=success/error）时，残留的 running 条目
 * 自动升级为 success，避免显示 loading 图标。
 */
function parseToolLogs(raw: string, toolStatus: string): ToolLogItem[] {
  if (!raw.trim()) return []

  const lines = raw.split('\n')
  const items: ToolLogItem[] = []

  const ACTION_RE = /^\[(running|success|error)\] (.+?)(?:: (.*))?$/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const m = trimmed.match(ACTION_RE)
    if (m) {
      items.push({
        type: 'action',
        status: m[1] as 'running' | 'success' | 'error',
        title: m[2]!.trim(),
        content: (m[3] ?? '').trim(),
      })
    } else {
      // 纯文本行：与上一条 text 合并
      const last = items[items.length - 1]
      if (last && last.type === 'text') {
        last.content = last.content ? last.content + '\n' + trimmed : trimmed
      } else {
        items.push({ type: 'text', content: trimmed })
      }
    }
  }

  // 工具已完成时，把所有残留 running 升级为 success
  if (toolStatus === 'success' || toolStatus === 'error') {
    for (const item of items) {
      if (item.type === 'action' && item.status === 'running') {
        item.status = 'success'
      }
    }
  }

  return items
}

/**
 * @Api /claw/agentTool/getLogs
 * @Summary 获取工具调用结构化日志
 * @BodyParam toolCallId string 工具调用唯一 ID
 * @ReturnDataExample {"items":[{"type":"action","status":"success","title":"读取文件","content":"src/index.ts"}],"status":"success","durationMs":1200}
 */
router.post(
  '/claw/agentTool/getLogs',
  apiHandler(async (req, res) => {
    const { toolCallId } = req.body
    const userId = (req as unknown as AuthRequest).user.userId
    const { t } = useI18n(req)

    if (!toolCallId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentToolCallIdRequired')
      )

    const row = clawDb.findAgentToolByCallId(String(toolCallId))
    if (!row || row.user_id !== userId)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.agentToolNotFound')
      )

    return success(res, {
      items: parseToolLogs(row.logs, row.status),
      status: row.status,
      durationMs: row.duration_ms,
    })
  })
)

export default router
