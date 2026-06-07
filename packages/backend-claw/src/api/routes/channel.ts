/**
 * Channel config API routes (claw module)
 *
 * POST /claw/channel/list         — list all channels
 * POST /claw/channel/add          — create a channel
 * POST /claw/channel/edit         — update a channel
 * POST /claw/channel/delete       — delete a channel
 * POST /claw/channel/toggleEnable — enable / disable a channel
 * POST /claw/channel/testSend     — send a test message
 */
import { Router } from 'express'
import type { AuthRequest } from '../../../../backend/src/api/middlewares/auth.js'
import { ResponseCodes } from '../../../../backend/src/api/types/constants.js'
import { apiHandler } from '../../../../backend/src/utils/api.js'
import { error, success } from '../../../../backend/src/utils/response.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import { createLogger } from '../../kernel/logger.js'
import { useI18n } from '../../locale/index.js'
import { clawDb } from '../../storage/store/index.js'
import type { AgentContext } from '../../types/index.js'
import { clawMessage } from '../../types/index.js'

const router: Router = Router()

// ─── Channel CRUD ─────────────────────────────────────────────────────────────

/**
 * @Api /api/claw/channel/list
 * @Summary List channel
 * @ReturnDataExample {"channels":[{"id":1,"title":"My Channel","type":"telegram","enable":true}]}
 */
router.post(
  '/claw/channel/list',
  apiHandler(async (req, res) => {
    const userId = (req as unknown as AuthRequest).user.userId
    const tenantId = (req as unknown as AuthRequest).user.tenantId
    const channels = clawDb.findAllChannels(tenantId, userId)
    return success(res, {
      channels: channels.map((b) => ({
        id: b.id,
        title: b.title,
        type: b.type,
        enable: b.enable === 1,
        isGlobal: b.is_global === 1,
        status: b.status,
        config: b.config ? JSON.parse(b.config) : {},
        createdAt: b.created_at,
      })),
    })
  })
)

/**
 * @Api /api/claw/channel/add
 * @Summary Add channel
 * @BodyParam title string Channel display title
 * @BodyParam type string Channel type: telegram|feishu
 * @BodyParam enable boolean? Enable on creation
 * @BodyParam isGlobal boolean? Apply to all agents globally
 * @BodyParam config object? Channel-specific configuration
 * @ReturnDataExample {"id":1}
 */
router.post(
  '/claw/channel/add',
  apiHandler(async (req, res) => {
    const {
      title,
      type,
      enable,
      isGlobal,
      config: channelConfig,
    } = req.body as {
      title: string
      type:
        | 'telegram'
        | 'feishu'
        | 'dingtalk'
        | 'wecom'
        | 'discord'
        | 'slack'
        | 'msteams'
        | 'line'
        | 'matrix'
        | 'mattermost'
      enable?: boolean
      isGlobal?: boolean
      config?: Record<string, string>
    }

    const row = clawDb.insertChannel({
      tenantId: Number((req as unknown as AuthRequest).user.tenantId),
      userId: Number((req as unknown as AuthRequest).user.userId),
      title,
      type,
      enable,
      isGlobal,
      config: channelConfig,
    })
    clawEventBus.emit('channel:configChanged', { channelId: row.id })
    return success(res, { id: row.id })
  })
)

/**
 * @Api /api/claw/channel/edit
 * @Summary Edit channel
 * @BodyParam id number Channel ID
 * @BodyParam title string? Updated title
 * @BodyParam type string? Updated type: telegram|feishu
 * @BodyParam enable boolean? Enable or disable
 * @BodyParam isGlobal boolean? Global flag
 * @BodyParam config object? Updated config
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/claw/channel/edit',
  apiHandler(async (req, res) => {
    const {
      id,
      title,
      type,
      enable,
      isGlobal,
      config: channelConfig,
    } = req.body as {
      id: number
      title?: string
      type?:
        | 'telegram'
        | 'feishu'
        | 'dingtalk'
        | 'wecom'
        | 'discord'
        | 'slack'
        | 'msteams'
        | 'line'
        | 'matrix'
        | 'mattermost'
      enable?: boolean
      isGlobal?: boolean
      config?: Record<string, string>
    }

    // Compare with existing record to determine if the connection must be re-established
    const existingRow = clawDb.findChannelById(id)
    const existingCfg: Record<string, string> = existingRow?.config
      ? (JSON.parse(existingRow.config) as Record<string, string>)
      : {}

    const connectivityChanged =
      (type !== undefined && type !== existingRow?.type) ||
      (channelConfig !== undefined &&
        (channelConfig.token !== existingCfg.token ||
          channelConfig.chatId !== existingCfg.chatId ||
          channelConfig.ownerId !== existingCfg.ownerId))

    const enableChanged =
      enable !== undefined &&
      existingRow !== undefined &&
      (enable ? 1 : 0) !== existingRow.enable

    clawDb.updateChannel(id, {
      title,
      type,
      enable,
      isGlobal,
      config: channelConfig,
      ...(connectivityChanged ? { status: 'pending' } : {}),
    })

    if (connectivityChanged || enableChanged) {
      clawEventBus.emit('channel:configChanged', { channelId: id })
    }

    return success(res, { saved: true })
  })
)

/**
 * @Api /api/claw/channel/delete
 * @Summary Remove channel
 * @BodyParam id number Channel ID
 * @ReturnDataExample {"deleted":true}
 */
router.post(
  '/claw/channel/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body as { id: number }
    // Emit before deleting so the manager can still resolve the channel row if needed
    clawEventBus.emit('channel:configDeleted', { channelId: id })
    clawDb.deleteChannel(id)
    return success(res, { deleted: true })
  })
)

/**
 * @Api /api/claw/channel/toggleEnable
 * @Summary Toggle Enable
 * @BodyParam id number Channel ID
 * @BodyParam enable boolean Enable or disable
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/claw/channel/toggleEnable',
  apiHandler(async (req, res) => {
    const { id, enable } = req.body as { id: number; enable: boolean }
    clawDb.updateChannel(id, { enable })
    clawEventBus.emit('channel:configChanged', { channelId: id })
    return success(res, { saved: true })
  })
)

/**
 * @Api /api/claw/channel/testSend
 * @Summary Test send channel
 * @BodyParam id number Channel ID
 * @ReturnDataExample {"sent":true}
 */
router.post(
  '/claw/channel/testSend',
  apiHandler(async (req, res) => {
    const { id } = req.body as { id: number }
    const { t } = useI18n(req)
    if (!id) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))
    }

    const row = clawDb.findChannelById(id)
    if (!row) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.channelNotFound'))
    }

    const cfg: Record<string, string> = row.config ? JSON.parse(row.config) : {}
    const chatId =
      cfg['chatId'] ||
      cfg['ownerId'] ||
      cfg['userId'] ||
      cfg['toUser'] ||
      cfg['channelId'] ||
      cfg['conversationId'] ||
      cfg['roomId']
    if (!chatId) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.channelChatIdRequired')
      )
    }

    clawEventBus.emit('message:outgoing', {
      agentId: 'system',
      chatId: Number(chatId),
      content: clawMessage.text(t('claw.channelTestMessage')),
      userId: row.user_id,
      channelId: id,
      source: 'channel',
      agentContext: {
        logger: createLogger('channel-test'),
        tenantId: row.tenant_id,
        userId: row.user_id,
        agentId: 0,
        sessionId: 0,
      } satisfies AgentContext,
    })

    return success(res, { sent: true })
  })
)

export default router
