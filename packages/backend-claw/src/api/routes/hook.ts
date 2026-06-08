/**
 * Hook API — public webhook endpoints (no auth required).
 *
 * Routes:
 *   GET  /hook/claw/agent/say/:token   — push message to agent channels via webhook token
 *   POST /hook/claw/agent/say/:token   — push message to agent channels via webhook token
 *
 * Body / query params:
 *   content  (string, required) — message content
 *   format   ('markdown' | 'html' | 'text', default: 'markdown')
 */

import { Router, type RequestHandler } from 'express'
import { logger } from '../../../../backend/src/utils/logger.js'
import { htmlToMarkdown } from '../../../../backend/src/utils/utils.js'
import { channelManager } from '../../channel/manager.js'

const router: Router = Router()

type WebhookFormat = 'markdown' | 'html' | 'text'

function normalizeToMarkdown(content: string, format: WebhookFormat): string {
  if (format === 'html') return htmlToMarkdown(content)
  return content
}

const agentSayHandler: RequestHandler = async (req, res) => {
  const token = req.params.token
  const content =
    (req.body as { content?: string })?.content ??
    (req.query.content as string | undefined)
  const format = ((req.body as { format?: string })?.format ??
    (req.query.format as string | undefined) ??
    'markdown') as WebhookFormat
  logger.info(
    { method: req.method, path: req.path, token, format },
    'hook_request'
  )
  if (!token || !content) {
    return res
      .status(400)
      .json({ code: 400, msg: 'token and content are required' })
  }
  const validFormats: WebhookFormat[] = ['markdown', 'html', 'text']
  if (!validFormats.includes(format)) {
    return res
      .status(400)
      .json({ code: 400, msg: 'format must be one of: markdown, html, text' })
  }
  const markdown = normalizeToMarkdown(String(content), format)
  try {
    const result = await channelManager.sendByWebhookToken(
      String(token),
      markdown
    )
    return res.json({ code: 0, msg: 'ok', data: result })
  } catch (err) {
    const e = err as Error & { code?: string }
    if (e.code === 'INVALID_TOKEN') {
      return res.status(403).json({ code: 403, msg: 'Invalid token' })
    }
    return res
      .status(500)
      .json({ code: 500, msg: e.message ?? 'Internal error' })
  }
}

/**
 * @Api /api/hook/claw/agent/say/:token
 * @Summary Say
 * @BodyParam content string Message content to send
 * @BodyParam format string? Message format: markdown|html|text (default: markdown)
 * @ReturnDataExample {"code":0,"msg":"ok","data":{}}
 */
router.post('/claw/agent/say/:token', agentSayHandler)

export default router
