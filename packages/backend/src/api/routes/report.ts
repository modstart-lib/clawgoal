import { Router } from 'express'
import { createNamedLogger, logger } from '../../utils/logger.js'
import { success } from '../../utils/response.js'
import { sendToBeacon } from '../../utils/report.js'
import { collectData } from '../../utils/collector.js'

const router = Router()

// 前端错误独立日志（写入 frontend_error-YYYYMMDD.log）
function getFrontendErrorLogger() {
  return createNamedLogger('frontend_error')
}

/**
 * @Api /api/error
 * @Summary 前端错误上报（无需认证）
 * @BodyParam events array 事件数组（Grow 埋点格式）
 * @ReturnDataExample {"ok":true}
 */
router.post('/error', async (req, res) => {
  try {
    const events = req.body?.events
    if (!Array.isArray(events) || events.length === 0) {
      return success(res, { ok: true })
    }

    // 写入前端错误独立日志文件
    const feLogger = getFrontendErrorLogger()
    for (const event of events) {
      feLogger.error(
        {
          path: event.path,
          did: event.did,
          sid: event.sid,
          type: event.type,
          props: event.props,
        },
        event.props?.msg ?? 'frontend error'
      )
    }

    // 批量上报到 Grow 信标
    sendToBeacon(events)
  } catch (err) {
    logger.warn({ err }, 'report: failed to process events')
  }

  return success(res, { ok: true })
})

/**
 * @Api /api/collect
 * @Summary 前端用户行为数据收集（无需认证）
 * @BodyParam name string 数据名称（如 "visit"）
 * @BodyParam data object 行为数据内容
 * @ReturnDataExample {"ok":true}
 */
router.post('/collect', async (req, res) => {
  try {
    const { name, data } = req.body as {
      name?: string
      data?: unknown
    }

    if (name && data !== undefined) {
      collectData(name, data)
    }

    return success(res, { ok: true })
  } catch (err) {
    logger.warn({ err }, 'collect: failed to process collect request')
    return success(res, { ok: true })
  }
})

export default router
