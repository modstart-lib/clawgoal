/**
 * TelegramChannelAdapter — Telegram-specific channel adapter.
 *
 * Extends ChannelAdapterBase which handles all common logic:
 *   agent routing, pin system, busy state, event bus subscriptions,
 *   deliverOutgoing formatting, and sendMessage.
 *
 * This class only deals with Telegram/Telegraf specifics:
 *   - Bot setup and lifecycle (polling, command registration)
 *   - Access control middleware (owner binding)
 *   - Incoming message handlers (_handleText, _handlePhoto)
 *   - HTML message sending (_sendHtml, _sendHtmlWithKeyboard)
 *   - Platform-specific message formatting (HTML)
 *   - Telegram command handlers (/start, /agents, /cron, /clear, /new)
 */

import { type Context, Telegraf } from 'telegraf'
import type { BotCommandScope } from 'telegraf/types'
import { getUserLang } from '../../../../backend/src/locale/index.js'
import { getByUserId } from '../../../../backend/src/utils/tenant.js'
import {
  convertJSONToMarkdownView,
  splitMarkdown,
} from '../../../../backend/src/utils/utils.js'
import { resolveRoleLocale } from '../../agent/locale/index.js'
import { agentManager } from '../../agent/index.js'
import { cronManager } from '../../cron/index.js'
import { clawEventBus } from '../../kernel/eventBus.js'
import { createLogger } from '../../kernel/logger.js'
import type { ChannelRow } from '../../storage/store/index.js'
import { clawDb } from '../../storage/store/index.js'
import type { Agent } from '../../types/index.js'
import { clawMessage } from '../../types/index.js'
import { ChannelAdapterBase } from '../adapterBase.js'
import { getRoleEmoji } from '../utils.js'
import {
  escHtml,
  markdownToTelegramHtml,
  MAX_MSG_LENGTH,
  toCommandSlug,
} from './index.js'
import { resolveIncomingSession } from '../../storage/sessionManager.js'
import { config } from '../../../../backend/src/config/index.js'

const logger = createLogger('telegram')

export class TelegramChannelAdapter extends ChannelAdapterBase {
  readonly channelType = 'telegram'

  get primaryChatId(): number | undefined {
    return this.allowedChatId
  }

  private bot: Telegraf
  private botUsername = ''
  /** Mutable copy of channel config — updated on auto-setup to persist owner/chatId. */
  private channelConfig: Record<string, string>

  constructor(row: ChannelRow, defaultAgentId: number) {
    const cfg = row.config
      ? (JSON.parse(row.config) as Record<string, string>)
      : {}
    if (!cfg['token']) {
      throw new Error(
        `Channel "${row.title}" (id=${row.id}) has no token configured`
      )
    }
    super(row.id, row.title, row.is_global === 1, row.user_id, defaultAgentId)
    if (cfg['chatId']) this.allowedChatId = parseInt(cfg['chatId'], 10)
    if (cfg['ownerId']) this.ownerUserId = parseInt(cfg['ownerId'], 10)
    this.channelConfig = { ...cfg }
    this.bot = new Telegraf(cfg['token'])
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** 标记是否为主动停止，阻止重连逻辑触发 */
  private _intentionalStop = false
  /** 当前重连尝试次数，用于指数退避计算 */
  private _reconnectAttempt = 0
  /** 心跳定时器，周期性检测轮询是否存活 */
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null

  async start(): Promise<void> {
    if (this.running) return
    this._intentionalStop = false
    this._reconnectAttempt = 0
    this._registerHandlers()
    this._setupEventBus()
    this._launchBot()
    this.running = true
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" Telegram adapter started`
    )
    this._setupBotCommands().catch((err) => {
      logger.warn(
        { err },
        `[channel:${this.channelId}] Failed to setup bot commands`
      )
    })
    this._startHeartbeat()
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this._intentionalStop = true
    this._stopHeartbeat()
    this.bot.stop('SIGTERM')
    this._teardownEventBus()
    this.running = false
    logger.info(
      `[channel:${this.channelId}] "${this.channelTitle}" Telegram adapter stopped`
    )
  }

  /**
   * 启动轮询并在意外断线时自动重连（指数退避：5s / 10s / 20s … 最大 60s）。
   * 当 _intentionalStop=true 时不再重连。
   */
  private _launchBot(): void {
    const startedAt = Date.now()
    this.bot.launch({ dropPendingUpdates: false }).catch((err: any) => {
      this.errorCount++
      logger.warn(
        `[channel:${this.channelId}] "${this.channelTitle}" launch failed: ${err.message || err}`
      )
      clawEventBus.emit('channel:error', {
        channelId: this.channelId,
        channelTitle: this.channelTitle,
        error: err instanceof Error ? err.message : String(err),
      })
      if (this._intentionalStop) return
      // 若已稳定运行超过 30s，重置重连计数
      if (Date.now() - startedAt > 30_000) {
        this._reconnectAttempt = 0
      }
      this._reconnectAttempt++
      const delay = Math.min(
        5000 * Math.pow(2, this._reconnectAttempt - 1),
        60_000
      )
      logger.info(
        `[channel:${this.channelId}] Reconnecting "${this.channelTitle}" in ${delay / 1000}s (attempt #${this._reconnectAttempt})...`
      )
      setTimeout(() => {
        if (this._intentionalStop) return
        logger.info(
          `[channel:${this.channelId}] Reconnect attempt #${this._reconnectAttempt} for "${this.channelTitle}"`
        )
        // 重新创建 Telegraf 实例（旧实例已失效）
        this.bot = new Telegraf(this.channelConfig['token']!)
        this._registerHandlers()
        this._launchBot()
      }, delay)
    })
  }

  /** 心跳检测：每 60s 调用 getMe() 验证轮询是否存活，失败则触发重连 */
  private _startHeartbeat(): void {
    this._stopHeartbeat()
    this._heartbeatTimer = setInterval(async () => {
      if (this._intentionalStop) return
      try {
        await this.bot.telegram.getMe()
        logger.debug(
          `[channel:${this.channelId}] "${this.channelTitle}" heartbeat OK`
        )
      } catch (err: any) {
        logger.warn(
          `[channel:${this.channelId}] "${this.channelTitle}" heartbeat failed: ${err.message || err} — triggering reconnect`
        )
        this._stopHeartbeat()
        try {
          this.bot.stop('SIGTERM')
        } catch (_) {}
        this._reconnectAttempt = 0
        this.bot = new Telegraf(this.channelConfig['token']!)
        this._registerHandlers()
        this._launchBot()
        this._startHeartbeat()
      }
    }, 60_000)
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
  }

  // ── ChannelAdapterBase: send primitives ───────────────────────────────────

  protected async _sendText(chatId: number, html: string): Promise<void> {
    await this._sendHtml(chatId, html)
  }

  protected async _sendTyping(chatId: number): Promise<void> {
    await this.bot.telegram.sendChatAction(chatId, 'typing')
  }

  /** Override to attach a tool-action keyboard to outgoing replies. */
  protected async _deliverReply(
    chatId: number,
    text: string,
    agentObj?: Agent
  ): Promise<void> {
    const keyboard = agentObj
      ? await this._buildToolActionKeyboard(agentObj)
      : null
    await this._sendHtmlWithKeyboard(chatId, text, keyboard ?? undefined)
  }

  // ── ChannelAdapterBase: message building (Telegram HTML) ──────────────────

  protected _buildOutgoingText(
    rawText: string,
    agentObj: Agent | undefined,
    showHeader: boolean
  ): string {
    const agentTitle = agentObj?.title
    const roleEmoji = getRoleEmoji(agentObj?.roleName ?? '')
    return rawText && agentTitle && showHeader
      ? `${roleEmoji} <b>[${escHtml(agentTitle)}]</b>\n\n${markdownToTelegramHtml(rawText)}`
      : markdownToTelegramHtml(rawText)
  }

  protected _buildToolStartText(
    toolName: string,
    params: Record<string, unknown>
  ): string {
    const lines: string[] = [`⚙️ <b>${escHtml(toolName)}</b>`]
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'object' && v !== null) {
        lines.push(`  <code>${escHtml(k)}</code>:`)
        lines.push(convertJSONToMarkdownView(v, 1))
      } else {
        const val = String(v)
        lines.push(
          `  <code>${escHtml(k)}</code>: ${escHtml(val.length > 200 ? val.slice(0, 200) + '…' : val)}`
        )
      }
    }
    return lines.join('\n')
  }

  protected _buildToolMergedText(
    startText: string,
    _toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string {
    const icon = success ? '✅' : '❌'
    const isZh = config.lang !== 'en-US'
    const label = success ? (isZh ? '完成' : 'done') : isZh ? '失败' : 'failed'
    const lines = [
      startText,
      `${icon} ${label} (${(durationMs / 1000).toFixed(1)}s)`,
    ]
    if (result)
      lines.push(
        markdownToTelegramHtml(
          result.length > 1000 ? result.slice(0, 1000) + '…' : result
        )
      )
    return lines.join('\n')
  }

  protected _buildToolEndText(
    toolName: string,
    success: boolean,
    durationMs: number,
    result?: string
  ): string {
    const icon = success ? '✅' : '❌'
    const isZh = config.lang !== 'en-US'
    const label = success ? (isZh ? '完成' : 'done') : isZh ? '失败' : 'failed'
    const lines = [
      `${icon} <b>${escHtml(toolName)}</b> ${label} (${(durationMs / 1000).toFixed(1)}s)`,
    ]
    if (result)
      lines.push(
        markdownToTelegramHtml(
          result.length > 1000 ? result.slice(0, 1000) + '…' : result
        )
      )
    return lines.join('\n')
  }

  // ── ChannelAdapterBase: notifications ────────────────────────────────────

  protected async _notifyMaxRoundsReached(
    chatId: number,
    agentId: number,
    originalChatId?: number
  ): Promise<void> {
    const text =
      config.lang !== 'en-US'
        ? '⚠️ <b>已达到最大工具调用轮次</b>\n\n当前任务尚未完成，是否继续运行？'
        : '⚠️ <b>Max tool call rounds reached</b>\n\nTask not yet complete. Continue?'
    await this.bot.telegram
      .sendMessage(chatId, text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: config.lang !== 'en-US' ? '▶️ 继续运行' : '▶️ Continue',
                callback_data: `continue_rounds:${agentId}:${originalChatId ?? chatId}`,
              },
            ],
          ],
        },
      })
      .catch((err) => {
        this.errorCount++
        logger.error(
          { err },
          `[channel:${this.channelId}] Failed to send maxRoundsReached message`
        )
      })
  }

  protected async _notifyPinChanged(
    chatId: number,
    agent: Agent | undefined,
    resolvedTools: string[]
  ): Promise<void> {
    const title = agent?.title ?? this.pinnedAgentId ?? 'Agent'
    const toolsSection =
      resolvedTools.length > 0
        ? `\n\n🛠 <b>可用工具</b>（${resolvedTools.length} 个）\n` +
          resolvedTools.map((t) => `• <code>${escHtml(t)}</code>`).join('\n')
        : ''
    const text = `📍 已切换到 <b>${escHtml(String(title))}</b>\n\n如需切换，请使用 /agents 选择其他智能体。${toolsSection}`
    const keyboard = agent ? await this._buildToolActionKeyboard(agent) : null
    if (keyboard) {
      await this.bot.telegram
        .sendMessage(chatId, text, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: { inline_keyboard: keyboard },
        })
        .catch((err) =>
          logger.warn(
            { err },
            `[channel:${this.channelId}] Failed to send pin notification`
          )
        )
    } else {
      await this._sendHtml(chatId, text).catch((err) =>
        logger.warn(
          { err },
          `[channel:${this.channelId}] Failed to send pin notification`
        )
      )
    }
  }

  protected async _notifyPinExpired(
    chatId: number,
    agentTitle: string,
    supervisorTitle: string
  ): Promise<void> {
    await this._sendHtml(
      chatId,
      `⏰ 与 <b>${escHtml(agentTitle)}</b> 的专属对话已结束，已恢复由 <b>${escHtml(supervisorTitle)}</b> 接管。`
    ).catch((err) =>
      logger.warn(
        { err },
        `[channel:${this.channelId}] Failed to send pin expiry notification`
      )
    )
  }

  // ── Telegram-specific: HTML send helpers ─────────────────────────────────

  private async _sendHtml(chatId: number, html: string): Promise<void> {
    const chunks = splitMarkdown(html, MAX_MSG_LENGTH)
    logger.debug(
      `[channel:${this.channelId}] [send] chat=${chatId} chunks=${chunks.length} totalLen=${html.length}`
    )
    await Promise.all(
      chunks.map((chunk, idx) =>
        this.bot.telegram
          .sendMessage(chatId, chunk, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
          })
          .then(() =>
            logger.debug(
              `[channel:${this.channelId}] [send:ok] chat=${chatId} chunk=${idx + 1}/${chunks.length}`
            )
          )
          .catch(() =>
            this.bot.telegram.sendMessage(chatId, chunk, {
              link_preview_options: { is_disabled: true },
            })
          )
      )
    )
  }

  /**
   * Send HTML with an inline keyboard attached to the last chunk.
   * Falls back to _sendHtml when no keyboard is provided.
   */
  private async _sendHtmlWithKeyboard(
    chatId: number,
    html: string,
    keyboard?: Array<
      Array<{ text: string; switch_inline_query_current_chat: string }>
    >
  ): Promise<void> {
    if (!keyboard) return this._sendHtml(chatId, html)
    const chunks = splitMarkdown(html, MAX_MSG_LENGTH)
    if (chunks.length > 1) {
      await Promise.all(
        chunks.slice(0, -1).map((chunk) =>
          this.bot.telegram
            .sendMessage(chatId, chunk, {
              parse_mode: 'HTML',
              link_preview_options: { is_disabled: true },
            })
            .catch(() =>
              this.bot.telegram.sendMessage(chatId, chunk, {
                link_preview_options: { is_disabled: true },
              })
            )
        )
      )
    }
    const lastChunk = chunks[chunks.length - 1]
    await this.bot.telegram
      .sendMessage(chatId, lastChunk, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: keyboard },
      })
      .catch(() =>
        this.bot.telegram.sendMessage(chatId, lastChunk, {
          link_preview_options: { is_disabled: true },
          reply_markup: { inline_keyboard: keyboard },
        })
      )
  }

  // ── Telegram-specific: tool action keyboard ───────────────────────────────

  private async _buildToolActionKeyboard(
    agent: Agent
  ): Promise<Array<
    Array<{ text: string; switch_inline_query_current_chat: string }>
  > | null> {
    const raw = agent.config.chats?.toolActions
    if (!raw || raw.length === 0) return null
    const tenantId = getByUserId(this.userId).id
    const locale = await getUserLang(tenantId, this.userId)
    const { toolActions: actions } = resolveRoleLocale(
      { toolActions: raw },
      locale
    )
    const COLS = 2
    const rows: Array<
      Array<{ text: string; switch_inline_query_current_chat: string }>
    > = []
    for (let i = 0; i < actions.length; i += COLS) {
      rows.push(
        actions.slice(i, i + COLS).map((action) => ({
          text: action.title,
          switch_inline_query_current_chat: action.config.template
            .replace(/\{\{[^}]*\}\}/g, '')
            .trim(),
        }))
      )
    }
    return rows
  }

  // ── Telegram bot handlers ─────────────────────────────────────────────────

  private _registerHandlers(): void {
    // Access control middleware:
    //   - Setup mode (no ownerUserId): first message auto-binds the sender as owner + chatId.
    //   - After setup: only the registered owner is allowed.
    this.bot.use(async (ctx, next) => {
      if (!this.ownerUserId) {
        const userId = ctx.from?.id
        const chatId = ctx.chat?.id
        if (userId && chatId) {
          this.ownerUserId = userId
          this.allowedChatId = chatId
          this.channelConfig['chatId'] = String(chatId)
          this.channelConfig['ownerId'] = String(userId)
          try {
            clawDb.updateChannel(this.channelId, {
              config: this.channelConfig as Record<string, string>,
              status: 'success',
            })
            logger.info(
              `[channel:${this.channelId}] Auto-setup complete: ownerId=${userId}, chatId=${chatId}`
            )
          } catch (err) {
            logger.error(
              { err },
              `[channel:${this.channelId}] Failed to persist auto-setup config`
            )
          }
          this._setupBotCommands().catch((err) => {
            logger.warn(
              { err },
              `[channel:${this.channelId}] Failed to update commands after auto-setup`
            )
          })
          await ctx.reply(
            `✅ Bot 配置完成！您已成为此 Bot 的所有者。\n🔒 其他所有用户将被拒绝访问。\n\n👤 ownerId: ${userId}\n💬 chatId: ${chatId}`
          )
        }
        return next()
      }
      if (ctx.from?.id !== this.ownerUserId) {
        logger.warn(
          `[channel:${this.channelId}] Blocked unauthorized user ${ctx.from?.id} (@${ctx.from?.username})`
        )
        await ctx.reply('⛔ Unauthorized. This bot is private.')
        return
      }
      return next()
    })

    // /start — system overview
    this.bot.start(async (ctx) => {
      const agents = agentManager.getAllByUser(this.userId)
      const agentList = agents.length
        ? agents.map((m) => `  • ${m.title}（${m.roleName}）`).join('\n')
        : config.lang !== 'en-US'
          ? '  暂无'
          : '  None'
      await ctx.replyWithHTML(
        `🤖 <b>${this.channelTitle}</b>\n\n` +
          `👥 伙伴数量：${agents.length}\n\n` +
          `<b>伙伴列表：</b>\n${agentList}\n\n` +
          `📋 可用命令：\n` +
          `/start — 系统基本信息\n` +
          `/agents — 伙伴状态\n` +
          `/cron — 定时任务\n` +
          `/clear — 清空聊天记录\n` +
          `/cmds — 命令诊断 / 刷新菜单`
      )
    })

    // /agents — agent status list + switch buttons
    this.bot.command('agents', async (ctx) => {
      const agents = agentManager.getAllByUser(this.userId)
      if (agents.length === 0) {
        await ctx.reply(
          config.lang !== 'en-US' ? '暂无可用的伙伴。' : 'No agents available.'
        )
        return
      }
      const boundAgentCount = agents.filter((m) =>
        m.channelIds?.includes(this.channelId)
      ).length
      const canSwitch = this.isGlobal || boundAgentCount > 1

      if (!canSwitch) {
        const currentAgentId = this._resolveAgentId()
        const currentAgent = agentManager.get(currentAgentId)
        const busy = currentAgentId
          ? this.busyAgentIds.has(currentAgentId)
          : false
        const statusIcon = busy ? '🔴' : '🟢'
        await ctx.replyWithHTML(
          config.lang !== 'en-US'
            ? `👥 <b>智能体</b>

${statusIcon} <b>${escHtml(currentAgent?.title ?? String(currentAgentId))}</b>
${escHtml(currentAgent?.description ?? '')}

此 Bot 已绑定专属智能体，无法切换。`
            : `👥 <b>Agents</b>

${statusIcon} <b>${escHtml(currentAgent?.title ?? String(currentAgentId))}</b>
${escHtml(currentAgent?.description ?? '')}

This bot is bound to a dedicated agent.`
        )
        return
      }

      let statusLines = `👥 <b>智能体</b>\n\n🟢空闲  🔴忙碌  ⭐当前对话`
      if (
        this.pinnedAgentId &&
        this.pinnedUntil &&
        this.pinnedUntil > new Date()
      ) {
        const pinned = agentManager.get(this.pinnedAgentId)
        const remaining = Math.max(
          1,
          Math.round((this.pinnedUntil.getTime() - Date.now()) / 60000)
        )
        statusLines += `\n\n📍 当前路由：<b>${escHtml(pinned?.title ?? String(this.pinnedAgentId))}</b>（剩余 ${remaining} 分钟）\n点击其他伙伴可切换对话`
      } else {
        statusLines += `\n\n点击伙伴即可切换专属对话`
      }

      const COLS = 3
      const rows: Array<Array<{ text: string; callback_data: string }>> = []
      for (let i = 0; i < agents.length; i += COLS) {
        rows.push(
          agents.slice(i, i + COLS).map((m) => {
            const busy = this.busyAgentIds.has(m.id)
            const isActive =
              this.pinnedAgentId === m.id &&
              this.pinnedUntil !== undefined &&
              this.pinnedUntil > new Date()
            return {
              text: `${isActive ? '⭐' : busy ? '🔴' : '🟢'} ${m.title}`,
              callback_data: `pin:${m.id}`,
            }
          })
        )
      }
      await ctx.replyWithHTML(statusLines, {
        reply_markup: { inline_keyboard: rows },
      })
    })

    // Callback queries: pin:agentId, continue_rounds:agentId:chatId
    this.bot.on('callback_query', async (ctx) => {
      if (!('data' in ctx.callbackQuery)) {
        await ctx.answerCbQuery()
        return
      }
      const data = ctx.callbackQuery.data as string

      if (data.startsWith('pin:')) {
        const allAgents = agentManager.getAllByUser(this.userId)
        const boundAgentCount = allAgents.filter((m) =>
          m.channelIds?.includes(this.channelId)
        ).length
        if (!this.isGlobal && boundAgentCount <= 1) {
          await ctx.answerCbQuery(
            config.lang !== 'en-US'
              ? '⚠️ 此 Bot 已绑定专属伙伴，无法切换'
              : '⚠️ This bot is bound to a dedicated agent'
          )
          return
        }
        const agentId = Number(data.slice(4))
        const target = agentManager.get(agentId)
        if (!target) {
          await ctx.answerCbQuery(
            config.lang !== 'en-US' ? '❌ Agent 不存在' : '❌ Agent not found'
          )
          return
        }
        const chatId = ctx.chat?.id ?? this.allowedChatId
        if (!chatId) {
          await ctx.answerCbQuery(
            config.lang !== 'en-US'
              ? '❌ 无法获取聊天 ID'
              : '❌ Cannot get chat ID'
          )
          return
        }
        await this._pinAgent(agentId, chatId)
        await ctx.answerCbQuery(`✅ 已切换到 ${target.title}`)
      } else if (data.startsWith('continue_rounds:')) {
        const parts = data.split(':')
        const agentId = Number(parts[1] ?? '0')
        const chatId = parseInt(parts[2] ?? '0', 10)
        if (!agentId || !chatId) {
          await ctx.answerCbQuery(
            config.lang !== 'en-US' ? '❌ 参数错误' : '❌ Invalid parameters'
          )
          return
        }
        await ctx.answerCbQuery(
          config.lang !== 'en-US' ? '▶️ 继续运行中...' : '▶️ Continuing...'
        )
        await ctx
          .editMessageText(
            config.lang !== 'en-US'
              ? '⏳ <b>继续运行中...</b>\n\n正在继续执行任务，请稍候。'
              : '⏳ <b>Continuing...</b>\n\nResuming task, please wait.',
            {
              parse_mode: 'HTML',
              link_preview_options: { is_disabled: true },
            }
          )
          .catch(() => {})
        clawEventBus.emit('agent:continueRounds', {
          agentId,
          chatId,
          channelId: this.channelId,
        })
      } else {
        await ctx.answerCbQuery()
      }
    })

    // /cron — list scheduled tasks
    this.bot.command('cron', async (ctx) => {
      const effectiveAgentId = this._getEffectiveAgentId()
      const tasks = cronManager.listTasksByAgentId(
        getByUserId(this.userId).id,
        this.userId,
        effectiveAgentId
      )
      if (tasks.length === 0) {
        await ctx.reply(
          config.lang !== 'en-US'
            ? '📅 暂无计划任务。'
            : '📅 No scheduled tasks.'
        )
        return
      }
      const allAgents = agentManager.getAllByUser(this.userId)
      const lines: string[] = [`📅 **定时任务** (共 ${tasks.length} 个)\n`]
      for (const task of tasks) {
        const agentTitle =
          allAgents.find((m) => m.id === task.agentId)?.title ??
          `#${task.agentId}`
        lines.push(
          `${task.enable ? '✅' : '⏸'} **${task.title}** (id=${task.id})\n` +
            `⏰ \`${task.cron}\`  👤 ${agentTitle}\n` +
            `🕐 ${task.lastRunAt ? new Date(task.lastRunAt).toLocaleString(config.lang === 'en-US' ? 'en-US' : 'zh-CN', { timeZone: 'Asia/Shanghai' }) : config.lang !== 'en-US' ? '从未运行' : 'Never run'}`
        )
      }
      await ctx.replyWithMarkdown(lines.join('\n\n'))
    })

    // /clear — delete recent messages and reset session
    this.bot.command('clear', async (ctx) => {
      const triggerMsgId = ctx.message.message_id
      const chatId = ctx.chat.id
      await ctx.deleteMessage().catch(() => {})
      const SWEEP = 200
      const deleteJobs: Promise<boolean>[] = []
      for (
        let id = triggerMsgId;
        id >= Math.max(1, triggerMsgId - SWEEP);
        id--
      ) {
        deleteJobs.push(
          this.bot.telegram
            .deleteMessage(chatId, id)
            .then(() => true)
            .catch(() => false)
        )
      }
      const results = await Promise.all(deleteJobs)
      const deletedCount = results.filter(Boolean).length
      const effectiveAgentId = this._getEffectiveAgentId()
      clawEventBus.emit('session:clear', {
        agentId: effectiveAgentId,
        sessionId: 0,
      })
      const notice = await ctx
        .reply(
          `🗑️ 聊天记录已清理完成（共删除 ${deletedCount} 条消息，会话已重置）。`
        )
        .catch(() => undefined)
      if (notice) {
        setTimeout(
          () =>
            this.bot.telegram
              .deleteMessage(chatId, notice.message_id)
              .catch(() => {}),
          3000
        )
      }
      logger.info(
        `[channel:${this.channelId}] /clear by ${ctx.from?.id} in chat ${chatId}, deleted ${deletedCount}, cleared session for ${effectiveAgentId}`
      )
    })

    // /new — reset session history for the effective agent
    this.bot.command('new', async (ctx) => {
      const effectiveAgentId = this._getEffectiveAgentId()
      clawEventBus.emit('session:clear', {
        agentId: effectiveAgentId,
        sessionId: 0,
      })
      const agent = agentManager.get(effectiveAgentId)
      await ctx.reply(
        `🆕 与 ${agent?.title ?? effectiveAgentId} 的会话已重置，开始新的对话！`
      )
      logger.info(
        `[channel:${this.channelId}] /new by ${ctx.from?.id} — cleared session for ${effectiveAgentId}`
      )
    })

    // Text messages
    this.bot.on('text', async (ctx) => {
      await this._handleText(ctx)
    })

    // Photo messages
    this.bot.on('photo', async (ctx) => {
      await this._handlePhoto(ctx)
    })

    this.bot.catch((err, ctx) => {
      this.errorCount++
      logger.error(
        { err },
        `[channel:${this.channelId}] Error in chat ${ctx.chat?.id}`
      )
      clawEventBus.emit('channel:error', {
        channelId: this.channelId,
        channelTitle: this.channelTitle,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  // ── Incoming message handlers ─────────────────────────────────────────────

  private async _handleText(ctx: Context): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return
    const chatId = ctx.chat?.id
    if (!chatId) return

    if (this.allowedChatId && chatId !== this.allowedChatId) {
      logger.warn(
        `[channel:${this.channelId}] Blocked unauthorized chat ${chatId}`
      )
      await ctx.reply('⛔ Unauthorized.')
      return
    }

    this.lastActivity = new Date()
    this.activeChatIds.add(chatId)
    ctx.react('🫡').catch(() => {})

    let text = ctx.message.text
    if (this.botUsername && text.startsWith(`@${this.botUsername} `)) {
      text = text.slice(`@${this.botUsername} `.length).trimStart()
    }

    // Route /command messages to a specific agent
    const cmdMatch = text.match(/^\/([^\s@/]+)(?:@\S+)?(?:\s+([\s\S]*))?$/)
    if (cmdMatch) {
      const cmdSlug = cmdMatch[1].toLowerCase()
      const cmdText = cmdMatch[2]?.trim() ?? ''
      const BUILTIN_COMMANDS = new Set([
        'agents',
        'cron',
        'clear',
        'new',
        'start',
        'cmds',
      ])
      if (!BUILTIN_COMMANDS.has(cmdSlug)) {
        const agents = agentManager.getAllByUser(this.userId)
        const target = agents.find(
          (m) =>
            m.title === cmdSlug ||
            toCommandSlug(m.roleName) === cmdSlug ||
            toCommandSlug(m.title) === cmdSlug
        )
        if (target) {
          const routedText = cmdText || `你好，${target.title}`
          logger.info(
            `[channel:${this.channelId}] Routing to agent "${target.title}" (/${cmdSlug}): ${routedText.slice(0, 60)}`
          )
          const routeTenantId = getByUserId(this.userId).id
          const routeSession = resolveIncomingSession({
            tenantId: routeTenantId,
            userId: this.userId,
            agentId: target.id,
            channelId: this.channelId,
            text: routedText,
          })
          if (!routeSession.isCommand) {
            clawEventBus.emit('message:incoming', {
              agentId: target.id,
              chatId,
              content: clawMessage.text(routedText),
              userId: this.userId,
              username: ctx.from?.username,
              firstName: ctx.from?.first_name,
              messageId: ctx.message.message_id,
              timestamp: new Date(),
              channelId: this.channelId,
              sessionId: routeSession.sessionId,
            })
          }
          return
        } else {
          logger.info(
            `[channel:${this.channelId}] Unknown command /${cmdSlug} from chat ${chatId}`
          )
          const agentTitles = agentManager
            .getAllByUser(this.userId)
            .map((m) => `/${m.title}`)
            .join('  ')
          await ctx.reply(
            `❓ 未知命令 /${cmdSlug}。\n\n` +
              (agentTitles
                ? config.lang !== 'en-US'
                  ? `可用伙伴：${agentTitles}

`
                  : `Available agents: ${agentTitles}

`
                : '') +
              `使用 /agents 查看伙伴状态，直接发送消息与默认伙伴对话。`
          )
          return
        }
      }
    }

    const effectiveAgentId = this._getEffectiveAgentId()
    if (effectiveAgentId === this.pinnedAgentId) this._extendPin()

    logger.info(
      `[channel:${this.channelId}] Message from chat ${chatId} → agent="${effectiveAgentId}": ${text.slice(0, 60)}`
    )
    logger.debug(
      `[channel:${this.channelId}] [incoming] agent=${effectiveAgentId} chat=${chatId} userId=${ctx.from?.id ?? 0} username=${ctx.from?.username ?? ''} len=${text.length} text=${text}`
    )

    // 在 emit 前解析会话（处理 session 命令或自动新建 session）
    const tenantId = getByUserId(this.userId).id
    const sessionResult = resolveIncomingSession({
      tenantId,
      userId: this.userId,
      agentId: effectiveAgentId,
      channelId: this.channelId,
      text,
    })

    if (sessionResult.isCommand) {
      const r = sessionResult.commandResult!
      if (r.type === 'new') {
        await ctx.reply(
          `🆕 已开始新会话（ID: ${r.sessionId}），之前的对话历史已保存。`
        )
      } else if (r.type === 'switch') {
        await ctx.reply(`✅ 已切换到会话 #${r.sessionId}`)
      } else if (r.type === 'list') {
        if (r.sessions.length === 0) {
          await ctx.reply(
            config.lang !== 'en-US'
              ? '💭 暂无历史会话。'
              : '💭 No conversation history.'
          )
        } else {
          const lines = r.sessions.slice(0, 10).map((s) => {
            const title = s.title || `会话 #${s.id}`
            return `💬 [${s.id}] ${title} (消息数: ${s.message_count})`
          })
          await ctx.reply(
            config.lang !== 'en-US'
              ? `📋 最近10条会话：

${lines.join('\n')}

发送 /session <id> 切换会话`
              : `📋 Recent 10 sessions:

${lines.join('\n')}

Send /session <id> to switch`
          )
        }
      } else if (r.type === 'error') {
        await ctx.reply(`❌ ${r.message}`)
      }
      return
    }

    // Agent 正忙时，10 秒后仍在处理则先发送占线提示
    if (this.busyAgentIds.has(effectiveAgentId)) {
      setTimeout(() => {
        if (this.busyAgentIds.has(effectiveAgentId)) {
          this._sendHtml(
            chatId,
            config.lang !== 'en-US'
              ? '⏳ 我正在处理其他任务，稍后查看这个任务。'
              : '⏳ I am processing another task. This will be handled later.'
          ).catch(() => {})
        }
      }, 10000)
    }

    clawEventBus.emit('message:incoming', {
      agentId: effectiveAgentId,
      chatId,
      content: clawMessage.text(text),
      userId: this.userId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      messageId: ctx.message.message_id,
      timestamp: new Date(),
      channelId: this.channelId,
      sessionId: sessionResult.sessionId,
    })
  }

  private async _handlePhoto(ctx: Context): Promise<void> {
    if (!ctx.message || !('photo' in ctx.message)) return
    const chatId = ctx.chat?.id
    if (!chatId) return

    if (this.allowedChatId && chatId !== this.allowedChatId) {
      logger.warn(
        `[channel:${this.channelId}] Blocked unauthorized chat ${chatId}`
      )
      await ctx.reply('⛔ Unauthorized.')
      return
    }

    this.lastActivity = new Date()
    this.activeChatIds.add(chatId)
    ctx.react('🫡').catch(() => {})

    const photos = (ctx.message as any).photo as Array<{ file_id: string }>
    const largestPhoto = photos[photos.length - 1]
    const caption: string = (ctx.message as any).caption ?? ''

    let imageUrl: string
    try {
      const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id)
      imageUrl = fileLink.href
    } catch (err) {
      logger.error(
        { err },
        `[channel:${this.channelId}] Failed to get photo file link`
      )
      await ctx.reply(
        config.lang !== 'en-US'
          ? '❌ 无法获取图片链接，请稍后重试。'
          : '❌ Cannot get image URL, please retry.'
      )
      return
    }

    const effectiveAgentId = this._getEffectiveAgentId()
    if (effectiveAgentId === this.pinnedAgentId) this._extendPin()

    logger.info(
      `[channel:${this.channelId}] Photo from chat ${chatId} → agent="${effectiveAgentId}": ${imageUrl} caption="${caption.slice(0, 60)}"`
    )

    const tenantId = getByUserId(this.userId).id
    const sessionResult = resolveIncomingSession({
      tenantId,
      userId: this.userId,
      agentId: effectiveAgentId,
      channelId: this.channelId,
    })

    // Agent 正忙时，10 秒后仍在处理则先发送占线提示
    if (this.busyAgentIds.has(effectiveAgentId)) {
      setTimeout(() => {
        if (this.busyAgentIds.has(effectiveAgentId)) {
          this._sendHtml(
            chatId,
            config.lang !== 'en-US'
              ? '⏳ 我正在处理其他任务，稍后查看这个任务。'
              : '⏳ I am processing another task. This will be handled later.'
          ).catch(() => {})
        }
      }, 10000)
    }

    clawEventBus.emit('message:incoming', {
      agentId: effectiveAgentId,
      chatId,
      content: clawMessage.image({ url: imageUrl, caption }),
      userId: this.userId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      messageId: (ctx.message as any).message_id,
      timestamp: new Date(),
      channelId: this.channelId,
      sessionId: sessionResult.sessionId,
    })
  }

  // ── Bot command menu setup ────────────────────────────────────────────────

  private async _setupBotCommands(): Promise<void> {
    try {
      const me = await this.bot.telegram.getMe()
      this.botUsername = me.username ?? ''
      logger.info(
        `[channel:${this.channelId}] Bot info: id=${me.id} username=@${me.username}`
      )
    } catch (err: any) {
      logger.warn(
        `[channel:${this.channelId}] Could not fetch bot info: ${err.message || err}`
      )
    }

    const ownCommands = [
      {
        command: 'start',
        description: config.lang !== 'en-US' ? '系统基本信息' : 'System info',
      },
      {
        command: 'agents',
        description: config.lang !== 'en-US' ? '智能体' : 'Agents',
      },
      {
        command: 'cron',
        description:
          config.lang !== 'en-US' ? '计划任务列表' : 'Scheduled tasks',
      },
      {
        command: 'new',
        description:
          config.lang !== 'en-US'
            ? '开始新会话（清除上下文）'
            : 'Start new session (clear context)',
      },
      {
        command: 'clear',
        description:
          config.lang !== 'en-US' ? '清空聊天记录' : 'Clear chat history',
      },
    ]

    const langCodes = ['zh', 'zh-hans', 'zh-hant', 'en', 'ru']

    try {
      await this.bot.telegram
        .deleteMyCommands({ scope: { type: 'default' } })
        .catch(() => {})
      for (const lang of langCodes) {
        await this.bot.telegram
          .deleteMyCommands({ scope: { type: 'default' }, language_code: lang })
          .catch(() => {})
      }

      if (this.ownerUserId && this.allowedChatId) {
        const isPrivateChat = this.allowedChatId === this.ownerUserId
        const ownerScope: BotCommandScope = isPrivateChat
          ? { type: 'chat', chat_id: this.allowedChatId }
          : {
              type: 'chat_member',
              chat_id: this.allowedChatId,
              user_id: this.ownerUserId,
            }
        try {
          await this.bot.telegram.setMyCommands(ownCommands, {
            scope: ownerScope,
          })
          logger.info(
            `[channel:${this.channelId}] setMyCommands for owner — scope=${JSON.stringify(ownerScope)}`
          )
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e)
          if (errMsg.includes('FROZEN_METHOD_INVALID')) {
            await this.bot.telegram
              .setMyCommands(ownCommands, { scope: { type: 'default' } })
              .catch((e2) => {
                logger.warn(
                  { err: e2 },
                  `[channel:${this.channelId}] Failed to set default scope commands (frozen fallback)`
                )
              })
          } else {
            logger.warn(
              { err: e },
              `[channel:${this.channelId}] Failed to set owner chat scope commands`
            )
          }
        }
        for (const lang of langCodes) {
          await this.bot.telegram
            .deleteMyCommands({ scope: ownerScope, language_code: lang })
            .catch(() => {})
        }
      } else {
        logger.info(
          `[channel:${this.channelId}] Owner not yet known — skipping owner-scope command registration`
        )
      }
    } catch (err) {
      logger.warn(
        { err },
        `[channel:${this.channelId}] Failed to configure commands`
      )
    }
  }
}
