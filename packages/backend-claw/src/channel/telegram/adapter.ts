/**
 * TelegramAdapter — agent-based Telegram bot adapter.
 * Each Agent gets its own TelegramAdapter instance backed by a dedicated bot token.
 *
 * Uses long-polling via Telegraf for simplicity and reliability.
 * Supports Markdown message formatting, typing indicators, and error recovery.
 *
 * Event-driven design:
 *   Incoming messages  → emits  message:incoming  on clawEventBus
 *   message:typing     → listens and sends typing action to Telegram
 *   message:outgoing   → listens and sends the reply to Telegram
 */

import { type Context, Telegraf } from 'telegraf'
import { splitMarkdown } from '../../../../backend/src/utils/utils.js'
import { cronManager } from '../../cron'
import { clawEventBus } from '../../kernel/eventBus.js'
import { createLogger } from '../../kernel/logger.js'
import type { AdapterStatus, Agent, ModelRef } from '../../types'
import { clawMessage } from '../../types'
import { agentManager } from '../../agent'
import { getRoleEmoji } from '../utils.js'
import {
  processSessionCommand,
  resolveIncomingSession,
} from '../../storage/sessionManager.js'

import {
  escapeMarkdownV2,
  escHtml,
  markdownToTelegramHtml,
  MAX_MSG_LENGTH,
  MESSAGE_MERGE_TIMEOUT_MS,
} from './index'
import { config } from '../../../../backend/src/config/index.js'

const logger = createLogger('telegram')

export class TelegramAdapter {
  private bot: Telegraf
  private agent: Agent
  private status: AdapterStatus
  private running = false
  /** 标记是否为主动停止（区别于异常断线），阻止重连逻辑触发 */
  private _intentionalStop = false
  /** 当前重连尝试次数，用于指数退避计算 */
  private _reconnectAttempt = 0
  /** If set, only this Telegram user ID is allowed to interact with the bot.
   * If not set, the first user to send a message is automatically bound as owner. */
  private ownerUserId?: number
  /** If set, only messages from this chat ID are processed (access control). Managed by channel layer. */
  private allowedChatId?: number

  /**
   * Per-chat message merge buffer.
   * Accumulates split chunks keyed by chatId until the debounce timer fires.
   */
  private _mergePending = new Map<
    number,
    {
      chunks: string[]
      timer: ReturnType<typeof setTimeout>
      ctx: Context
      userId: number
      username?: string
    }
  >()

  constructor(agent: Agent) {
    this.agent = agent
    // 从渠道状态读取 Telegram 专属配置，不污染 Agent 对象
    const channelState = agentManager.getAgentChannelState(agent.id)
    this.bot = new Telegraf(channelState.telegramToken!)
    this.ownerUserId = channelState.ownerUserId
    this.allowedChatId = channelState.chatId
    this.status = {
      agentId: agent.id,
      agentTitle: agent.title,
      running: false,
      errorCount: 0,
    }
  }

  // ── Send helpers ──────────────────────────────────────────────────────────────

  /**
   * Send HTML text to a chat.
   * - Splits long text into chunks at newline boundaries.
   * - Link previews are always disabled.
   * - Falls back to plain text if the Telegram HTML parser rejects the message.
   */
  private async _sendHtml(chatId: number, html: string): Promise<void> {
    const chunks = splitMarkdown(html, MAX_MSG_LENGTH)
    logger.debug(
      `[send] agent=${this.agent.id} chat=${chatId} chunks=${chunks.length} totalLen=${html.length}`
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
              `[send:ok] agent=${this.agent.id} chat=${chatId} chunk=${idx + 1}/${chunks.length}`
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

  /** Convert Markdown to Telegram HTML and send. */
  private async _sendMarkdown(chatId: number, markdown: string): Promise<void> {
    await this._sendHtml(chatId, markdownToTelegramHtml(markdown))
  }

  // ─────────────────────────────────────────────────────────────────────────────

  /** Validate the bot token and fetch bot info */
  async validate(): Promise<string> {
    const me = await this.bot.telegram.getMe()
    this.status.botUsername = me.username
    logger.info(
      `claw @${me.username} validated for agent "${this.agent.title}"`
    )
    return me.username ?? ''
  }

  /** Register all message handlers */
  private registerHandlers(): void {
    const agent = this.agent

    // Owner restriction middleware:
    //   - No owner yet (first launch): first message auto-binds the sender as owner and persists it.
    //   - Owner set: only the owner is admitted; all other users are rejected.
    this.bot.use(async (ctx, next) => {
      if (!this.ownerUserId) {
        // Auto-bind first user as owner + chatId
        const userId = ctx.from?.id
        const chatId = ctx.chat?.id
        if (userId && chatId) {
          this.ownerUserId = userId
          this.allowedChatId = chatId
          agentManager.persistChannelOwnerUserId(agent.id, userId)
          agentManager.persistChannelChatId(agent.id, chatId)
          const name = ctx.from?.first_name ?? String(userId)
          await ctx.reply(
            `✅ 初始化完成！

` +
              `🤖 机器人：${agent.title}
` +
              `👤 所有者：${name}（Telegram ID: ${userId}）
` +
              `💬 绑定聊天：${chatId}

` +
              `🔒 只有你可以使用此机器人，其他用户将被拒绝。`
          )
        }
        return next()
      }
      if (ctx.from?.id !== this.ownerUserId) {
        logger.warn(
          `Blocked unauthorized user ${ctx.from?.id} (@${ctx.from?.username}) for ${agent.title}`
        )
        await ctx.reply('⛔ Unauthorized. This bot is private.')
        return
      }
      return next()
    })

    // Handle /start command
    this.bot.start(async (ctx) => {
      const greeting =
        `👋 Hello! I'm **${agent.title}** — your ${agent.description}.\n\n` +
        `You can start chatting with me right away. Type /help for more information.`
      await ctx.replyWithMarkdown(greeting)
    })

    // Handle /help command
    this.bot.help(async (ctx) => {
      const tools = agent.config.capabilities.tools
      const toolList = tools.join(', ') || 'None'
      const help =
        `**${agent.title}** (Role: ${agent.roleName})\n\n` +
        `📝 ${agent.description}\n\n` +
        `**Available tools:** ${toolList}\n\n` +
        `**Commands:**\n` +
        `/cron — List all scheduled tasks\n` +
        `Just send me any message to start chatting!`
      await ctx.replyWithMarkdown(help)
    })

    // Handle /status command
    this.bot.command('status', async (ctx) => {
      const uptime = process.uptime()
      const hours = Math.floor(uptime / 3600)
      const minutes = Math.floor((uptime % 3600) / 60)
      const status =
        `**Status: ${agent.title}**\n\n` +
        `🤖 Role: ${agent.roleName}\n` +
        `🔧 Model: ${(() => {
          const s = agent.config.models?.['default']
          const r: ModelRef | undefined =
            typeof s === 'string' ? { name: s } : (s as ModelRef | undefined)
          const n = r?.name ?? 'default'
          return Array.isArray(n) ? n[0] : n
        })()}\n` +
        `⏱️ Uptime: ${hours}h ${minutes}m\n` +
        `❌ Errors: ${this.status.errorCount}\n` +
        `🕐 Last activity: ${this.status.lastActivity?.toLocaleString() ?? 'never'}`
      await ctx.replyWithMarkdown(status)
    })

    // Handle /cron command — list all scheduled tasks
    this.bot.command('cron', async (ctx) => {
      const tasks = cronManager.listTasks(
        this.agent.tenantId,
        this.agent.userId
      )
      if (tasks.length === 0) {
        await ctx.reply(
          config.lang !== 'en-US'
            ? '📅 暂无计划任务。'
            : '📅 No scheduled tasks.'
        )
        return
      }
      const allAgents = agentManager.getAllByUser(this.agent.userId)
      const lines: string[] = [`📅 **定时任务** (共 ${tasks.length} 个)\n`]
      for (const task of tasks) {
        const agentTitle =
          allAgents.find((m) => m.id === task.agentId)?.title ??
          `#${task.agentId}`
        const enableIcon = task.enable ? '✅' : '⏸'
        const lastRun = task.lastRunAt
          ? new Date(task.lastRunAt).toLocaleString('zh-CN', {
              timeZone: 'Asia/Shanghai',
            })
          : config.lang !== 'en-US'
            ? '从未运行'
            : 'Never run'
        lines.push(
          `${enableIcon} **${task.title}** (id=${task.id})\n` +
            `⏰ \`${task.cron}\`  👤 ${agentTitle}\n` +
            `🕐 ${lastRun}`
        )
      }
      await ctx.replyWithMarkdown(lines.join('\n\n'))
    })

    // Handle /clear command
    this.bot.command('clear', async (ctx) => {
      // The knowledge memory system has no per-session history.
      // Inform the user that memory is persistent knowledge, not conversation history.
      await ctx.reply(
        '✅ Conversation context has been reset for this turn.\n' +
          'Note: Long-term knowledge memory (MEMORY.md) is persistent and not cleared by this command.'
      )
      logger.info(`Clear command received: ${agent.title} chat=${ctx.chat.id}`)
    })

    // Handle /new command — create a new session for this agent
    this.bot.command('new', async (ctx) => {
      const agentIdNum = agent.id
      const result = processSessionCommand(
        '/new',
        agent.tenantId,
        agent.userId,
        agentIdNum,
        0
      )
      if (result.type === 'new') {
        await ctx.reply(
          `🆕 已开始新会话（ID: ${result.sessionId}），之前的对话历史已保存。`
        )
        logger.info(
          `New session command: ${agent.title} chat=${ctx.chat.id} sessionId=${result.sessionId}`
        )
      }
    })

    // Handle /session command — switch to an existing session or list sessions
    this.bot.command('session', async (ctx) => {
      const args = ctx.message.text.split(/\s+/).slice(1)
      const agentIdNum = agent.id
      const cmd = args[0] ? `/session ${args[0]}` : '/session'
      const result = processSessionCommand(
        cmd,
        agent.tenantId,
        agent.userId,
        agentIdNum,
        0
      )
      if (result.type === 'list') {
        if (result.sessions.length === 0) {
          await ctx.reply(
            config.lang !== 'en-US'
              ? '💭 暂无历史会话。'
              : '💭 No conversation history.'
          )
          return
        }
        const lines = result.sessions.slice(0, 10).map((s) => {
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
        return
      }
      if (result.type === 'error') {
        await ctx.reply(`❌ ${result.message}`)
        return
      }
      if (result.type === 'switch') {
        await ctx.reply(`✅ 已切换到会话 #${result.sessionId}`)
        logger.info(
          `Session switch command: ${agent.title} sessionId=${result.sessionId}`
        )
      }
    })

    // Handle regular text messages
    this.bot.on('text', async (ctx) => {
      await this.handleTextMessage(ctx)
    })

    // Handle photo messages — route to Model with image URL and optional caption
    this.bot.on('photo', async (ctx) => {
      await this.handlePhotoMessage(ctx)
    })

    // Log unhandled message types (e.g. sticker, voice, video, document, etc.)
    this.bot.on('message', (ctx) => {
      const msg = ctx.message as unknown as Record<string, unknown>
      const types = [
        'sticker',
        'voice',
        'video',
        'document',
        'audio',
        'animation',
        'contact',
        'location',
        'poll',
        'dice',
        'venue',
      ]
      const detectedType = types.find((t) => t in msg) ?? 'unknown'
      logger.debug(
        `[unhandled message] type=${detectedType} chat=${ctx.chat?.id} from=${ctx.from?.id} ` +
          `caption=${JSON.stringify((msg.caption as string | undefined) ?? '')} ` +
          `raw=${JSON.stringify(msg).slice(0, 300)}`
      )
    })

    // Handle errors
    this.bot.catch((err, ctx) => {
      this.status.errorCount++
      logger.error(
        { err },
        `claw error for ${agent.title} in chat ${ctx.chat?.id}`
      )
    })
  }

  /** Handle an incoming photo message — resolves the file URL and emits message:incoming */
  private async handlePhotoMessage(ctx: Context): Promise<void> {
    if (!ctx.message || !('photo' in ctx.message)) return
    const chatId = ctx.chat?.id
    if (!chatId) return

    if (this.allowedChatId !== undefined && chatId !== this.allowedChatId) {
      logger.warn(
        `Blocked unauthorized chat ${chatId} (allowed: ${this.allowedChatId})`
      )
      await ctx.reply('⛔ Unauthorized.')
      return
    }

    this.status.lastActivity = new Date()

    const photos = (ctx.message as any).photo as Array<{ file_id: string }>
    const largestPhoto = photos[photos.length - 1]
    const caption: string = (ctx.message as any).caption ?? ''

    try {
      const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id)
      const imageUrl = fileLink.href
      logger.info(
        `Photo from @${ctx.from?.username ?? ctx.from?.id} to ${this.agent.title}: ${imageUrl} caption="${caption.slice(0, 60)}"`
      )
      const agentIdNum =
        typeof this.agent.id === 'number'
          ? this.agent.id
          : parseInt(String(this.agent.id), 10)
      const sessionResult = resolveIncomingSession({
        tenantId: this.agent.tenantId,
        userId: this.agent.userId,
        agentId: agentIdNum,
        channelId: 0,
      })
      clawEventBus.emit('message:incoming', {
        agentId: this.agent.id,
        chatId,
        content: clawMessage.image({ url: imageUrl, caption }),
        userId: this.agent.userId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        messageId: (ctx.message as any).message_id,
        timestamp: new Date(),
        sessionId: sessionResult.sessionId,
        channelId: 0,
      })
    } catch (err) {
      logger.error(
        { err },
        `Failed to get photo file link for ${this.agent.title}`
      )
      await ctx.reply(
        config.lang !== 'en-US'
          ? '❌ 无法获取图片链接，请稍后重试。'
          : '❌ Cannot get image URL, please retry.'
      )
    }
  }

  /** Handle an incoming text message — emits message:incoming on the bus and returns immediately */
  private async handleTextMessage(ctx: Context): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return

    const chatId = ctx.chat?.id
    if (!chatId) return

    const text = ctx.message.text
    const userId = ctx.from?.id ?? 0
    const username = ctx.from?.username

    // Access control: if chatId is set, only allow that chat
    if (this.allowedChatId !== undefined && chatId !== this.allowedChatId) {
      logger.warn(
        `Blocked unauthorized chat ${chatId} (allowed: ${this.allowedChatId})`
      )
      await ctx.reply('⛔ Unauthorized.')
      return
    }

    this.status.lastActivity = new Date()

    // ── Message-merge buffer ───────────────────────────────────────────────
    // Telegram may split a very long user message into several consecutive
    // updates.  We buffer chunks per chatId and flush them as one combined
    // message after MESSAGE_MERGE_TIMEOUT_MS of silence.
    const existing = this._mergePending.get(chatId)
    if (existing) {
      // Another chunk arrived – reset the timer and append.
      clearTimeout(existing.timer)
      existing.chunks.push(text)
      existing.timer = setTimeout(
        () => this._flushMergeBuffer(chatId),
        MESSAGE_MERGE_TIMEOUT_MS
      )
      logger.debug(
        `Buffering message chunk for chat ${chatId} (${existing.chunks.length} parts so far)`
      )
    } else {
      // First chunk – create a new buffer entry.
      const timer = setTimeout(
        () => this._flushMergeBuffer(chatId),
        MESSAGE_MERGE_TIMEOUT_MS
      )
      this._mergePending.set(chatId, {
        chunks: [text],
        timer,
        ctx,
        userId,
        username,
      })
      logger.debug(`Started merge buffer for chat ${chatId}`)
    }
  }

  /** Flush the merge buffer for a chat and emit the combined message */
  private _flushMergeBuffer(chatId: number): void {
    const pending = this._mergePending.get(chatId)
    if (!pending) return
    this._mergePending.delete(chatId)

    const { chunks, ctx, userId, username } = pending
    const mergedText = chunks.join('\n')

    logger.info(
      `Message from @${username ?? userId} to ${this.agent.title} (${chunks.length} part(s)): ${mergedText.slice(0, 60)}`
    )
    logger.debug(
      `[incoming] agent=${this.agent.id} chat=${chatId} userId=${userId} username=${username ?? ''} parts=${chunks.length} len=${mergedText.length} text=${mergedText}`
    )

    if (!ctx.message || !('message_id' in ctx.message)) return

    // sessionId: 通过 resolveIncomingSession 确保非零（命令已由 bot.command() 拦截，此处不会触发命令逻辑）
    const agentIdNum =
      typeof this.agent.id === 'number'
        ? this.agent.id
        : parseInt(String(this.agent.id), 10)
    const sessionResult = resolveIncomingSession({
      tenantId: this.agent.tenantId,
      userId: this.agent.userId,
      agentId: agentIdNum,
      channelId: 0,
      text: mergedText,
    })

    clawEventBus.emit('message:incoming', {
      agentId: this.agent.id,
      chatId,
      content: clawMessage.text(mergedText),
      userId: this.agent.userId,
      username,
      firstName: ctx.from?.first_name,
      messageId: ctx.message.message_id,
      timestamp: new Date(),
      sessionId: sessionResult.sessionId,
      channelId: 0,
    })
  }

  /**
   * 启动轮询并在意外断线时自动重连（指数退避：5s / 10s / 20s … 最大 60s）。
   * 当 _intentionalStop=true 时不再重连。
   */
  private _launchBot(): void {
    const startedAt = Date.now()
    this.bot.launch({ dropPendingUpdates: true }).catch((err: any) => {
      this.status.errorCount++
      logger.warn(
        `claw launch failed for "${this.agent.title}": ${err.message || err}`
      )
      if (this._intentionalStop) return
      // 若已稳定运行超过 30s，则重置重连计数（避免偶发失败后退避过长）
      if (Date.now() - startedAt > 30_000) {
        this._reconnectAttempt = 0
      }
      this._reconnectAttempt++
      const delay = Math.min(
        5000 * Math.pow(2, this._reconnectAttempt - 1),
        60_000
      )
      logger.info(
        `Reconnecting "${this.agent.title}" in ${delay / 1000}s (attempt #${this._reconnectAttempt})...`
      )
      setTimeout(() => {
        if (this._intentionalStop) return
        logger.info(
          `Reconnect attempt #${this._reconnectAttempt} for "${this.agent.title}"`
        )
        // 重新创建 Telegraf 实例（旧实例已失效）
        const channelState = agentManager.getAgentChannelState(this.agent.id)
        this.bot = new Telegraf(channelState.telegramToken!)
        this.registerHandlers()
        this._launchBot()
      }, delay)
    })
  }

  /** Start the bot (begins long-polling) and registers event bus listeners */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn(`Adapter for ${this.agent.title} is already running`)
      return
    }

    this._intentionalStop = false
    this._reconnectAttempt = 0
    this.registerHandlers()
    this._launchBot()

    this.running = true
    this.status.running = true
    logger.info(
      `Telegram adapter started for "${this.agent.title}" (@${this.status.botUsername})`
    )
  }

  /** Stop the bot gracefully and removes event bus listeners */
  async stop(): Promise<void> {
    if (!this.running) return
    this._intentionalStop = true
    this.bot.stop('SIGTERM')
    // Clear any pending merge timers to avoid post-stop emissions
    for (const pending of this._mergePending.values()) {
      clearTimeout(pending.timer)
    }
    this._mergePending.clear()
    this.running = false
    this.status.running = false
    logger.info(`Telegram adapter stopped for "${this.agent.title}"`)
  }

  /**
   * Send a message proactively to a specific chat.
   * For reactive replies triggered by the Model loop use clawEventBus 'message:outgoing' instead.
   */
  async sendMessage(chatId: number, text: string): Promise<void> {
    await this._sendMarkdown(chatId, text)
  }

  /** Format and deliver a routed outgoing message. Called by BotGateway. */
  deliverOutgoing(chatId: number, rawText: string): void {
    logger.debug(
      `[outgoing] agent=${this.agent.id} title=${this.agent.title} chat=${chatId} len=${rawText.length} text=${rawText.slice(0, 300)}`
    )
    const roleEmoji = getRoleEmoji(this.agent.roleName)
    const text = rawText
      ? `${roleEmoji} <b>[${escHtml(this.agent.title)}]</b>\n\n${markdownToTelegramHtml(rawText)}`
      : rawText
    this._sendHtml(chatId, text).catch((err) => {
      this.status.errorCount++
      logger.error(
        { err },
        `Failed to deliver outgoing message for ${this.agent.title}`
      )
    })
  }

  /** Send typing indicator. Called by BotGateway. */
  deliverTyping(chatId: number): void {
    this.bot.telegram.sendChatAction(chatId, 'typing').catch(() => {})
  }

  getStatus(): AdapterStatus {
    return { ...this.status }
  }

  getAgentId(): number {
    return this.agent.id
  }

  /** Expose escapeMarkdownV2 for external use */
  static escape = escapeMarkdownV2
}
