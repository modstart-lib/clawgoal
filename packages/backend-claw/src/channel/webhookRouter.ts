/**
 * webhookRouter — 统一 Webhook 路由
 *
 * 为飞书、钉钉、企业微信、Discord、Slack、MS Teams、LINE、Mattermost 等
 * Webhook 模式渠道提供统一的 HTTP 接收端点。
 *
 * 路由格式：/api/webhook/channel/:type/:channelId
 */

import { Router } from 'express'
import { createLogger } from '../kernel/logger.js'
import type { FeishuChannelAdapter } from './feishu/channelAdapter.js'
import type { DingtalkChannelAdapter } from './dingtalk/channelAdapter.js'
import type { WecomChannelAdapter } from './wecom/channelAdapter.js'
import type { DiscordChannelAdapter } from './discord/channelAdapter.js'
import type { SlackChannelAdapter } from './slack/channelAdapter.js'
import type { MSTeamsChannelAdapter } from './msteams/channelAdapter.js'
import type { LineChannelAdapter } from './line/channelAdapter.js'
import type { MattermostChannelAdapter } from './mattermost/channelAdapter.js'

const logger = createLogger('webhook-router')

function getChannelManager() {
  return import('./manager.js').then((m) => m.channelManager)
}

function parseChannelId(raw: string | undefined): number {
  return parseInt(raw ?? '0', 10)
}

export function createChannelWebhookRouter(): Router {
  const router = Router()

  // ── 飞书 ──────────────────────────────────────────────────────────────────
  router.post('/webhook/channel/feishu/:channelId', async (req, res) => {
    const channelId = parseChannelId(req.params['channelId'])
    if (!channelId) {
      res.status(400).json({ error: 'invalid channelId' })
      return
    }
    try {
      const manager = await getChannelManager()
      const adapter = manager.getAdapter(channelId) as
        | FeishuChannelAdapter
        | undefined
      if (!adapter || adapter.channelType !== 'feishu') {
        res.status(404).json({ error: 'channel not found' })
        return
      }
      const result = await adapter.handleWebhook(
        req.body as Record<string, unknown>
      )
      res.json(result)
    } catch (err) {
      logger.error({ err }, `[feishu webhook] channelId=${channelId}`)
      res.status(500).json({ error: 'internal error' })
    }
  })

  // ── 钉钉 ──────────────────────────────────────────────────────────────────
  router.post('/webhook/channel/dingtalk/:channelId', async (req, res) => {
    const channelId = parseChannelId(req.params['channelId'])
    if (!channelId) {
      res.status(400).json({ error: 'invalid channelId' })
      return
    }
    try {
      const manager = await getChannelManager()
      const adapter = manager.getAdapter(channelId) as
        | DingtalkChannelAdapter
        | undefined
      if (!adapter || adapter.channelType !== 'dingtalk') {
        res.status(404).json({ error: 'channel not found' })
        return
      }
      const headers = {
        timestamp: String(req.headers['timestamp'] ?? ''),
        sign: String(req.headers['sign'] ?? ''),
      }
      const result = await adapter.handleWebhook(
        req.body as Record<string, unknown>,
        headers
      )
      res.json(result)
    } catch (err) {
      logger.error({ err }, `[dingtalk webhook] channelId=${channelId}`)
      res.status(500).json({ error: 'internal error' })
    }
  })

  // ── 企业微信（GET=验证，POST=消息）────────────────────────────────────────
  router.get('/webhook/channel/wecom/:channelId', async (req, res) => {
    const channelId = parseChannelId(req.params['channelId'])
    if (!channelId) {
      res.status(400).send('invalid channelId')
      return
    }
    try {
      const manager = await getChannelManager()
      const adapter = manager.getAdapter(channelId) as
        | WecomChannelAdapter
        | undefined
      if (!adapter || adapter.channelType !== 'wecom') {
        res.status(404).send('channel not found')
        return
      }
      const echostr = adapter.handleVerify(req.query as Record<string, string>)
      if (echostr === null) {
        res.status(403).send('signature verification failed')
        return
      }
      res.send(echostr)
    } catch (err) {
      logger.error({ err }, `[wecom webhook verify] channelId=${channelId}`)
      res.status(500).send('internal error')
    }
  })

  router.post('/webhook/channel/wecom/:channelId', async (req, res) => {
    const channelId = parseChannelId(req.params['channelId'])
    if (!channelId) {
      res.status(400).send('invalid channelId')
      return
    }
    try {
      const manager = await getChannelManager()
      const adapter = manager.getAdapter(channelId) as
        | WecomChannelAdapter
        | undefined
      if (!adapter || adapter.channelType !== 'wecom') {
        res.status(404).send('channel not found')
        return
      }
      const rawBody =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      await adapter.handleWebhook(rawBody, req.query as Record<string, string>)
      res.send('success')
    } catch (err) {
      logger.error({ err }, `[wecom webhook] channelId=${channelId}`)
      res.status(500).send('internal error')
    }
  })

  // ── Discord（Interaction Endpoint）───────────────────────────────────────
  router.post('/webhook/channel/discord/:channelId', async (req, res) => {
    const channelId = parseChannelId(req.params['channelId'])
    if (!channelId) {
      res.status(400).json({ error: 'invalid channelId' })
      return
    }
    try {
      const manager = await getChannelManager()
      const adapter = manager.getAdapter(channelId) as
        | DiscordChannelAdapter
        | undefined
      if (!adapter || adapter.channelType !== 'discord') {
        res.status(404).json({ error: 'channel not found' })
        return
      }
      const rawBody =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      const headers: Record<string, string> = {
        'x-signature-ed25519': String(req.headers['x-signature-ed25519'] ?? ''),
        'x-signature-timestamp': String(
          req.headers['x-signature-timestamp'] ?? ''
        ),
      }
      const result = await adapter.handleWebhook(
        req.body as Record<string, unknown>,
        rawBody,
        headers
      )
      if (result === null) {
        res.status(401).json({ error: 'invalid signature' })
        return
      }
      res.json(result)
    } catch (err) {
      logger.error({ err }, `[discord webhook] channelId=${channelId}`)
      res.status(500).json({ error: 'internal error' })
    }
  })

  // ── Slack（Events API）────────────────────────────────────────────────────
  router.post('/webhook/channel/slack/:channelId', async (req, res) => {
    const channelId = parseChannelId(req.params['channelId'])
    if (!channelId) {
      res.status(400).json({ error: 'invalid channelId' })
      return
    }
    try {
      const manager = await getChannelManager()
      const adapter = manager.getAdapter(channelId) as
        | SlackChannelAdapter
        | undefined
      if (!adapter || adapter.channelType !== 'slack') {
        res.status(404).json({ error: 'channel not found' })
        return
      }
      const rawBody =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      const headers: Record<string, string> = {
        'x-slack-request-timestamp': String(
          req.headers['x-slack-request-timestamp'] ?? ''
        ),
        'x-slack-signature': String(req.headers['x-slack-signature'] ?? ''),
      }
      const result = await adapter.handleWebhook(
        req.body as Record<string, unknown>,
        rawBody,
        headers
      )
      if (result === null) {
        res.status(401).json({ error: 'invalid signature' })
        return
      }
      res.json(result)
    } catch (err) {
      logger.error({ err }, `[slack webhook] channelId=${channelId}`)
      res.status(500).json({ error: 'internal error' })
    }
  })

  // ── MS Teams（Bot Framework）──────────────────────────────────────────────
  router.post('/webhook/channel/msteams/:channelId', async (req, res) => {
    const channelId = parseChannelId(req.params['channelId'])
    if (!channelId) {
      res.status(400).json({ error: 'invalid channelId' })
      return
    }
    try {
      const manager = await getChannelManager()
      const adapter = manager.getAdapter(channelId) as
        | MSTeamsChannelAdapter
        | undefined
      if (!adapter || adapter.channelType !== 'msteams') {
        res.status(404).json({ error: 'channel not found' })
        return
      }
      await adapter.handleWebhook(req.body as Record<string, unknown>)
      res.json({})
    } catch (err) {
      logger.error({ err }, `[msteams webhook] channelId=${channelId}`)
      res.status(500).json({ error: 'internal error' })
    }
  })

  // ── LINE（Messaging API Webhook）──────────────────────────────────────────
  router.post('/webhook/channel/line/:channelId', async (req, res) => {
    const channelId = parseChannelId(req.params['channelId'])
    if (!channelId) {
      res.status(400).json({ error: 'invalid channelId' })
      return
    }
    try {
      const manager = await getChannelManager()
      const adapter = manager.getAdapter(channelId) as
        | LineChannelAdapter
        | undefined
      if (!adapter || adapter.channelType !== 'line') {
        res.status(404).json({ error: 'channel not found' })
        return
      }
      const rawBody =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      const headers: Record<string, string> = {
        'x-line-signature': String(req.headers['x-line-signature'] ?? ''),
      }
      await adapter.handleWebhook(
        req.body as Record<string, unknown>,
        rawBody,
        headers
      )
      res.json({})
    } catch (err) {
      logger.error({ err }, `[line webhook] channelId=${channelId}`)
      res.status(500).json({ error: 'internal error' })
    }
  })

  // ── Mattermost（Outgoing Webhook）─────────────────────────────────────────
  router.post('/webhook/channel/mattermost/:channelId', async (req, res) => {
    const channelId = parseChannelId(req.params['channelId'])
    if (!channelId) {
      res.status(400).json({ error: 'invalid channelId' })
      return
    }
    try {
      const manager = await getChannelManager()
      const adapter = manager.getAdapter(channelId) as
        | MattermostChannelAdapter
        | undefined
      if (!adapter || adapter.channelType !== 'mattermost') {
        res.status(404).json({ error: 'channel not found' })
        return
      }
      const result = await adapter.handleWebhook(
        req.body as Record<string, unknown>
      )
      if (result === null) {
        res.status(401).json({ error: 'invalid token' })
        return
      }
      res.json(result)
    } catch (err) {
      logger.error({ err }, `[mattermost webhook] channelId=${channelId}`)
      res.status(500).json({ error: 'internal error' })
    }
  })

  return router
}
