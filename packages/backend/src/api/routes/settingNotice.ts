import { Router } from 'express'
import { AppConfig } from '../../config.js'
import { config } from '../../config/index.js'
import { useI18n } from '../../locale/index.js'
import { noticeDb } from '../../storage/store/notice.js'
import { apiHandler } from '../../utils/api.js'
import { logger } from '../../utils/logger.js'
import {
  createNoticeProvider,
  proxyFetch,
  type ProxyInfo,
} from '../../utils/notice.js'
import { error, success } from '../../utils/response.js'
import {
  authMiddleware,
  AuthRequest,
  supervisorMiddleware,
} from '../middlewares/auth.js'
import { ResponseCodes } from '../types/constants.js'

const router = Router()

/**
 * @Api /api/setting/notice/list
 * @Summary List setting notice
 * @ReturnDataExample {"records":[{"id":1,"title":"Telegram","type":"telegram","enable":true}]}
 */
router.post(
  '/setting/notice/list',
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const records = await noticeDb.findAllNotices(tenantId, userId)
    return success(res, { records })
  })
)

/**
 * @Api /api/setting/notice/add
 * @Summary Add setting notice
 * @BodyParam title string Channel name
 * @BodyParam type string Channel type (e.g. telegram, email)
 * @BodyParam enable boolean Optional, default true
 * @BodyParam config object Channel-specific config
 * @BodyParam proxyName string Optional proxy name
 * @ReturnDataExample {"record":{"id":1,"title":"Telegram","type":"telegram","enable":true}}
 */
router.post(
  '/setting/notice/add',
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const {
      title,
      enable = true,
      rateLimitEnable = false,
      rateInterval = 60,
      type,
      config = {},
      proxyName,
    } = req.body as {
      title: string
      enable?: boolean
      rateLimitEnable?: boolean
      rateInterval?: number
      type: string
      config?: Record<string, any>
      proxyName?: string | null
    }

    if (!title)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('noticeTitleRequired'))
    if (!type)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('noticeTypeRequired'))

    const record = await noticeDb.createNotice({
      tenantId,
      userId,
      title,
      enable,
      rateLimitEnable,
      rateInterval,
      type,
      config,
      proxyName: proxyName ?? null,
    })
    return success(res, { record })
  })
)

/**
 * @Api /api/setting/notice/edit
 * @Summary Edit setting notice
 * @BodyParam id number Channel ID
 * @BodyParam title string Optional new title
 * @BodyParam type string Optional channel type
 * @BodyParam enable boolean Optional enable flag
 * @BodyParam config object Optional config
 * @ReturnDataExample {"record":{"id":1,"title":"Telegram","type":"telegram","enable":true}}
 */
router.post(
  '/setting/notice/edit',
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const userId = (req as AuthRequest).user.userId
    const {
      id,
      title,
      enable,
      rateLimitEnable,
      rateInterval,
      type,
      config,
      proxyName,
    } = req.body as {
      id: number
      title?: string
      enable?: boolean
      rateLimitEnable?: boolean
      rateInterval?: number
      type?: string
      config?: Record<string, any>
      proxyName?: string | null
    }

    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    const existing = await noticeDb.findNoticeById(id)
    if (!existing || existing.userId !== userId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('noticeChannelNotFound'))

    const updateInput: any = {
      title,
      enable,
      rateLimitEnable,
      rateInterval,
      type,
      config,
    }
    if ('proxyName' in req.body) updateInput.proxyName = proxyName ?? null
    const record = await noticeDb.updateNotice(id, updateInput)
    return success(res, { record })
  })
)

/**
 * @Api /api/setting/notice/delete
 * @Summary Remove setting notice
 * @BodyParam id number Channel ID
 * @ReturnDataExample {"id":1}
 */
router.post(
  '/setting/notice/delete',
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const userId = (req as AuthRequest).user.userId
    const { id } = req.body as { id: number }

    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    const existing = await noticeDb.findNoticeById(id)
    if (!existing || existing.userId !== userId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('noticeChannelNotFound'))

    await noticeDb.deleteNotice(id)
    return success(res, { id })
  })
)

/**
 * @Api /api/setting/notice/test
 * @Summary Test setting notice
 * @BodyParam id number Channel ID
 * @ReturnDataExample {"sent":true}
 */
router.post(
  '/setting/notice/test',
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const { id } = req.body as { id: number }

    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    const notice = await noticeDb.findNoticeById(id)
    if (!notice || notice.userId !== userId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('noticeChannelNotFound'))

    const provider = await createNoticeProvider(notice)
    if (!provider)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        `${t('noticeTypeNotSupported')}: ${notice.type}`
      )

    const result = await provider.send(
      t('noticeTestTitle'),
      t('noticeTestContent').replace('%s', AppConfig.title)
    )

    await noticeDb.createNoticeLog({
      tenantId,
      userId,
      noticeId: id,
      title: t('noticeTestTitle'),
      content: t('noticeTestSummary'),
      status: result.success ? 'success' : 'fail',
    })

    if (!result.success)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        result.message ?? t('noticeSendFailed')
      )
    return success(res, { sent: true })
  })
)

/**
 * @Api /api/setting/notice/log/paginate
 * @Summary Paginate setting notice log
 * @BodyParam noticeId number Optional filter by channel ID
 * @BodyParam page number Page number, default 1
 * @BodyParam pageSize number Page size, default 20
 * @BodyParam startTime string Optional start time
 * @BodyParam endTime string Optional end time
 * @ReturnDataExample {"records":[],"page":1,"pageSize":20,"total":0}
 */
router.post(
  '/setting/notice/log/paginate',
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const {
      noticeId = null,
      startTime,
      endTime,
      page = 1,
      pageSize = 20,
    } = req.body as {
      noticeId?: number | null
      startTime?: string
      endTime?: string
      page?: number
      pageSize?: number
    }

    const result = await noticeDb.paginateNoticeLogs(
      tenantId,
      userId,
      noticeId,
      page,
      pageSize,
      startTime,
      endTime
    )
    return success(res, {
      records: result.data,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    })
  })
)

/**
 * @Api /api/setting/notice/telegram/startListen
 * @Summary Start listening setting notice telegram
 * @BodyParam botToken string Telegram bot token
 * @BodyParam proxyName string Optional proxy name
 * @ReturnDataExample {"started":true}
 */
router.post(
  '/setting/notice/telegram/startListen',
  authMiddleware,
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { botToken, proxyName } = req.body as {
      botToken: string
      proxyName?: string | null
    }

    if (!botToken || !botToken.trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('noticeBotTokenRequired')
      )
    }

    // 立即返回，后台异步轮询
    const token = botToken.trim()

    pollTelegramForChatId(token, proxyName).catch((e) => {
      logger.warn({ e }, 'telegram_poll_error')
    })

    return success(res, { started: true })
  })
)

/**
 * 使用可选代理对 HTTPS URL 发起 GET 请求并解析 JSON
 * 支持 HTTP 和 SOCKS5 代理（通过 proxyFetch 统一处理）
 */
async function fetchJson(
  url: string,
  proxy?: ProxyInfo,
  timeoutMs = 5000
): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await proxyFetch(url, { method: 'GET' }, proxy)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 后台轮询 Telegram getUpdates，获取到消息后通过 systemWs 广播 Chat ID
 */
async function pollTelegramForChatId(
  botToken: string,
  proxyName?: string | null
): Promise<void> {
  // 解析代理
  let proxy: ProxyInfo | undefined = undefined
  if (proxyName) {
    const proxyEntry = (config as any).proxy?.find(
      (x: any) => x.name === proxyName
    )
    if (proxyEntry) {
      const { buildProxyUrl } = await import('../../config/index.js')
      const proxyUrl = buildProxyUrl(proxyEntry)
      if (proxyUrl) {
        proxy = { url: proxyUrl, type: proxyEntry.type }
      }
    }
  }

  let offset = 0
  const maxAttempts = 30 // 每次轮询最多 2s，合计约 60s

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const json = await fetchJson(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=2&limit=10`,
        proxy,
        5000
      )

      if (!json.ok) {
        const { wsService } = await import('../../websocket/index.js')
        wsService.broadcastSystemEvent('system:telegramBot:chatIdReceived', {
          error: json.description ?? 'Telegram API 返回错误',
        })
        return
      }

      if (Array.isArray(json.result) && json.result.length > 0) {
        for (const update of json.result) {
          offset = update.update_id + 1
          const chatId =
            update.message?.chat?.id ??
            update.callback_query?.message?.chat?.id ??
            update.my_chat_member?.chat?.id

          if (chatId != null) {
            const { wsService } = await import('../../websocket/index.js')
            wsService.broadcastSystemEvent(
              'system:telegramBot:chatIdReceived',
              {
                chatId: String(chatId),
              }
            )
            // 发送确认消息到 Telegram
            fetchJson(
              `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&parse_mode=HTML&text=${encodeURIComponent(`✅ <b>通知渠道绑定成功！</b>\n\n💬 Chat ID：<code>${chatId}</code>\n\n系统消息与通知将发送到此对话。`)}`,
              proxy,
              5000
            ).catch(() => {
              /* 发送通知失败不影响主流程 */
            })
            return
          }
        }
      }
    } catch (e: any) {
      const { wsService } = await import('../../websocket/index.js')
      wsService.broadcastSystemEvent('system:telegramBot:chatIdReceived', {
        error: e?.message ?? '网络错误，请重试',
      })
      return
    }
  }

  // 超时
  const { wsService } = await import('../../websocket/index.js')
  wsService.broadcastSystemEvent('system:telegramBot:chatIdReceived', {
    error: '监听超时，请重试',
  })
}

export default router
