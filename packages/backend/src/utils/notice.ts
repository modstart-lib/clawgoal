/**
 * 通知提供者模块
 * 支持 url / email / dingtalk / feishu / wework / telegram / slack / ntfy
 */
import tls from 'node:tls'
import nodemailer from 'nodemailer'
import { AppConfig } from '../config.js'
import type { NoticeRow } from '../storage/store/notice.js'
import { noticeDb } from '../storage/store/notice.js'
import { logger } from './logger.js'

// ─── Markdown 工具函数 ────────────────────────────────────────────────────────

/** 将 Markdown 内联语法转为 HTML */
function inlineMarkdownToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /`(.+?)`/g,
      '<code style="background:#f3f4f6;padding:2px 6px;border-radius:3px;font-size:0.875em;font-family:\'SF Mono\',Monaco,monospace;">$1</code>'
    )
}

/** 将 Markdown 转为美化的 HTML 片段（用于邮件 body） */
function markdownToEmailHtml(markdown: string): string {
  const lines = markdown.split('\n')
  const result: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        result.push('<ul style="margin:6px 0;padding-left:18px;">')
        inList = true
      }
      result.push(
        `<li style="margin:2px 0;line-height:1.6;">${inlineMarkdownToHtml(trimmed.slice(2))}</li>`
      )
    } else {
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      if (trimmed === '---') {
        result.push(
          '<hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0;">'
        )
      } else if (trimmed.startsWith('### ')) {
        result.push(
          `<h3 style="font-size:14px;font-weight:600;margin:10px 0 4px;color:#1f2937;">${inlineMarkdownToHtml(trimmed.slice(4))}</h3>`
        )
      } else if (trimmed.startsWith('## ')) {
        result.push(
          `<h2 style="font-size:16px;font-weight:700;margin:12px 0 6px;color:#111827;">${inlineMarkdownToHtml(trimmed.slice(3))}</h2>`
        )
      } else if (trimmed.startsWith('# ')) {
        result.push(
          `<h1 style="font-size:18px;font-weight:700;margin:14px 0 6px;color:#111827;">${inlineMarkdownToHtml(trimmed.slice(2))}</h1>`
        )
      } else if (trimmed === '') {
        result.push('<br>')
      } else {
        result.push(
          `<p style="margin:4px 0;line-height:1.6;color:#374151;">${inlineMarkdownToHtml(trimmed)}</p>`
        )
      }
    }
  }
  if (inList) result.push('</ul>')
  return result.join('\n')
}

/** 构建美化的 HTML 邮件完整模板 */
function buildEmailHtml(title: string, content: string): string {
  const contentHtml = markdownToEmailHtml(content)
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapedTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:0 8px 12px;">
    <div style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#ffffff;padding:14px 24px 12px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:16px;font-weight:700;color:#111827;line-height:1.4;">${escapedTitle}</div>
        <div style="margin-top:3px;font-size:11px;color:#9ca3af;">${AppConfig.title} · 系统通知</div>
      </div>
      <div style="padding:12px 24px 10px;font-size:14px;">
        ${contentHtml}
      </div>
      <div style="padding:8px 24px;border-top:1px solid #f0f0f0;text-align:center;font-size:11px;color:#aaaaaa;">
        本邮件由 <b style="color:#6b7280;">${AppConfig.title}</b> 自动发送，请勿直接回复
      </div>
    </div>
  </div>
</body>
</html>`
}

/** 将 Markdown 转为 Telegram HTML 格式（parse_mode: HTML） */
function markdownToTelegramHtml(markdown: string): string {
  return markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<b>$1</b>')
    .replace(/^## (.+)$/gm, '<b>$1</b>')
    .replace(/^# (.+)$/gm, '<b>$1</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '──────────────────')
}

/** 将 Markdown 转为 Slack mrkdwn 格式 */
function markdownToSlackMrkdwn(markdown: string): string {
  return markdown
    .replace(/^### (.+)$/gm, '*$1*')
    .replace(/^## (.+)$/gm, '*$1*')
    .replace(/^# (.+)$/gm, '*$1*')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^---$/gm, '──────────────────')
}

export interface NoticeSendResult {
  success: boolean
  message?: string
}

// ─── 代理 Fetch 辅助 ─────────────────────────────────────────────────────────

export interface ProxyInfo {
  url: string // e.g. socks5://127.0.0.1:1086 or http://127.0.0.1:7890
  type: string // 'socks5' | 'http'
}

interface ProxyFetchResponse {
  ok: boolean
  status: number
  json(): Promise<any>
  text(): Promise<string>
}

/**
 * Bun-compatible fetch with proxy support.
 * - No proxy: native fetch()
 * - HTTP proxy: Bun native fetch({ proxy })
 * - SOCKS5: SocksClient tunnel (Bun's fetch doesn't support socks5://)
 */
export async function proxyFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string },
  proxy?: ProxyInfo
): Promise<ProxyFetchResponse> {
  if (!proxy?.url) {
    return fetch(url, options) as Promise<ProxyFetchResponse>
  }
  if (proxy.type !== 'socks5') {
    // HTTP proxy: Bun's native fetch supports http:// proxy directly
    return (fetch as any)(url, {
      ...options,
      proxy: proxy.url,
    }) as Promise<ProxyFetchResponse>
  }
  // SOCKS5: manually establish tunnel via socks package
  const { SocksClient } = await import('socks')
  const targetUrl = new URL(url)
  const targetHost = targetUrl.hostname
  const targetPort =
    parseInt(targetUrl.port) || (targetUrl.protocol === 'https:' ? 443 : 80)
  const proxyParsed = new URL(proxy.url)
  const socksOpts: any = {
    proxy: {
      host: proxyParsed.hostname,
      port: parseInt(proxyParsed.port),
      type: 5,
    },
    command: 'connect',
    destination: { host: targetHost, port: targetPort },
    timeout: 15000,
  }
  if (proxyParsed.username) {
    socksOpts.proxy.userId = decodeURIComponent(proxyParsed.username)
    if (proxyParsed.password)
      socksOpts.proxy.password = decodeURIComponent(proxyParsed.password)
  }
  const info = await SocksClient.createConnection(socksOpts)
  let socket: any = info.socket
  if (targetUrl.protocol === 'https:') {
    socket = tls.connect({
      socket,
      servername: targetHost,
      rejectUnauthorized: false,
    })
    await new Promise<void>((resolve, reject) => {
      socket.once('secureConnect', resolve)
      socket.once('error', reject)
    })
  }
  const method = options.method ?? 'GET'
  const bodyBuf = options.body ? Buffer.from(options.body, 'utf8') : undefined
  const headers: Record<string, string> = { ...(options.headers ?? {}) }
  headers['Host'] = targetHost
  headers['Connection'] = 'close'
  if (bodyBuf) headers['Content-Length'] = String(bodyBuf.byteLength)
  const reqPath = (targetUrl.pathname || '/') + (targetUrl.search || '')
  let reqStr = `${method} ${reqPath} HTTP/1.1\r\n`
  for (const [k, v] of Object.entries(headers)) reqStr += `${k}: ${v}\r\n`
  reqStr += '\r\n'
  socket.write(reqStr)
  if (bodyBuf) socket.write(bodyBuf)
  const raw = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    socket.on('data', (c: Buffer) => chunks.push(c))
    socket.once('error', reject)
    socket.once('close', () => resolve(Buffer.concat(chunks)))
  })
  const rawStr = raw.toString('latin1')
  const statusMatch = rawStr.match(/^HTTP\/1\.[01] (\d{3})/)
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 0
  const bodyStart = rawStr.indexOf('\r\n\r\n')
  const responseBody =
    bodyStart >= 0 ? raw.slice(bodyStart + 4).toString('utf8') : ''
  return {
    ok: status >= 200 && status < 400,
    status,
    async json() {
      return JSON.parse(responseBody)
    },
    async text() {
      return responseBody
    },
  }
}

// ─── 基类 ─────────────────────────────────────────────────────────────────────

export abstract class NoticeProvider {
  abstract send(title: string, content: string): Promise<NoticeSendResult>
}

// ─── URL Webhook ───────────────────────────────────────────────────────────────

export class UrlNoticeProvider extends NoticeProvider {
  constructor(
    private cfg: { url: string; method: 'POST' | 'GET'; key: string },
    private proxy?: ProxyInfo
  ) {
    super()
  }

  async send(title: string, content: string): Promise<NoticeSendResult> {
    try {
      const { url, method, key } = this.cfg
      const payload = { [key]: `${title}\n${content}`, title, content }
      let finalUrl = url
      const opts: {
        method: string
        headers?: Record<string, string>
        body?: string
      } = { method }
      if (method === 'GET') {
        const params = new URLSearchParams({
          [key]: `${title}\n${content}`,
          title,
          content,
        })
        finalUrl = `${url}?${params.toString()}`
      } else {
        opts.body = JSON.stringify(payload)
        opts.headers = { 'Content-Type': 'application/json' }
      }
      const res = await proxyFetch(finalUrl, opts, this.proxy)
      if (!res.ok) return { success: false, message: `HTTP ${res.status}` }
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message }
    }
  }
}

// ─── Email ─────────────────────────────────────────────────────────────────────

export class EmailNoticeProvider extends NoticeProvider {
  constructor(
    private cfg: {
      smtpHost: string
      smtpPort: number
      smtpUser: string
      smtpPassword: string
      smtpSecure?: boolean
      toEmail: string
      fromEmail?: string
    },
    private proxyUrl?: string
  ) {
    super()
  }

  async send(title: string, content: string): Promise<NoticeSendResult> {
    try {
      const transportOpts: any = {
        host: this.cfg.smtpHost,
        port: this.cfg.smtpPort,
        secure: this.cfg.smtpSecure ?? this.cfg.smtpPort === 465,
        auth: { user: this.cfg.smtpUser, pass: this.cfg.smtpPassword },
      }
      if (this.proxyUrl) transportOpts.proxy = this.proxyUrl
      const transporter = nodemailer.createTransport(transportOpts)
      const rawFrom = this.cfg.fromEmail?.trim()
      const fromField = rawFrom
        ? rawFrom.includes('@')
          ? rawFrom
          : `"${rawFrom}" <${this.cfg.smtpUser}>`
        : this.cfg.smtpUser
      await transporter.sendMail({
        from: fromField,
        to: this.cfg.toEmail,
        subject: title,
        text: content,
        html: buildEmailHtml(title, content),
      })
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message }
    }
  }
}

// ─── 钉钉 ─────────────────────────────────────────────────────────────────────

export class DingTalkNoticeProvider extends NoticeProvider {
  constructor(
    private cfg: { webhookUrl: string; secret?: string },
    private proxy?: ProxyInfo
  ) {
    super()
  }

  private async sign(): Promise<string> {
    if (!this.cfg.secret) return ''
    const ts = Date.now()
    const stringToSign = `${ts}\n${this.cfg.secret}`
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.cfg.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(stringToSign)
    )
    const base64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return `&timestamp=${ts}&sign=${encodeURIComponent(base64)}`
  }

  async send(title: string, content: string): Promise<NoticeSendResult> {
    try {
      const suffix = await this.sign()
      const res = await proxyFetch(
        `${this.cfg.webhookUrl}${suffix}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'markdown',
            markdown: { title, text: `## ${title}\n\n${content}` },
          }),
        },
        this.proxy
      )
      const json: any = await res.json()
      if (json.errcode !== 0) return { success: false, message: json.errmsg }
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message }
    }
  }
}

// ─── 飞书 ─────────────────────────────────────────────────────────────────────

export class FeishuNoticeProvider extends NoticeProvider {
  constructor(
    private cfg: { webhookUrl: string; secret?: string },
    private proxy?: ProxyInfo
  ) {
    super()
  }

  private async sign(ts: number): Promise<string> {
    if (!this.cfg.secret) return ''
    const stringToSign = `${ts}\n${this.cfg.secret}`
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.cfg.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(stringToSign)
    )
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
  }

  async send(title: string, content: string): Promise<NoticeSendResult> {
    try {
      const ts = Math.floor(Date.now() / 1000)
      const sign = await this.sign(ts)
      const body: any = {
        msg_type: 'post',
        content: {
          post: {
            zh_cn: {
              title,
              content: [[{ tag: 'lark_md', content }]],
            },
          },
        },
      }
      if (this.cfg.secret) {
        body.timestamp = String(ts)
        body.sign = sign
      }
      const res = await proxyFetch(
        this.cfg.webhookUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        this.proxy
      )
      const json: any = await res.json()
      if (json.code !== 0) return { success: false, message: json.msg }
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message }
    }
  }
}

// ─── 企业微信 ─────────────────────────────────────────────────────────────────

export class WeWorkNoticeProvider extends NoticeProvider {
  constructor(
    private cfg: { webhookUrl: string },
    private proxy?: ProxyInfo
  ) {
    super()
  }

  async send(title: string, content: string): Promise<NoticeSendResult> {
    try {
      const res = await proxyFetch(
        this.cfg.webhookUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'markdown',
            markdown: { content: `## ${title}\n\n${content}` },
          }),
        },
        this.proxy
      )
      const json: any = await res.json()
      if (json.errcode !== 0) return { success: false, message: json.errmsg }
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message }
    }
  }
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

export class TelegramNoticeProvider extends NoticeProvider {
  constructor(
    private cfg: { botToken: string; chatId: string },
    private proxy?: ProxyInfo
  ) {
    super()
  }

  async send(title: string, content: string): Promise<NoticeSendResult> {
    try {
      const res = await proxyFetch(
        `https://api.telegram.org/bot${this.cfg.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.cfg.chatId,
            text: `<b>${title}</b>\n\n${markdownToTelegramHtml(content)}`,
            parse_mode: 'HTML',
          }),
        },
        this.proxy
      )
      const json: any = await res.json()
      if (!json.ok) return { success: false, message: json.description }
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message }
    }
  }
}

// ─── Slack ────────────────────────────────────────────────────────────────────

export class SlackNoticeProvider extends NoticeProvider {
  constructor(
    private cfg: { webhookUrl: string },
    private proxy?: ProxyInfo
  ) {
    super()
  }

  async send(title: string, content: string): Promise<NoticeSendResult> {
    try {
      const res = await proxyFetch(
        this.cfg.webhookUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `*${title}*\n${markdownToSlackMrkdwn(content)}`,
            blocks: [
              {
                type: 'header',
                text: { type: 'plain_text', text: title, emoji: true },
              },
              {
                type: 'section',
                text: { type: 'mrkdwn', text: markdownToSlackMrkdwn(content) },
              },
              { type: 'divider' },
              {
                type: 'context',
                elements: [
                  { type: 'mrkdwn', text: `来自 *${AppConfig.title}*` },
                ],
              },
            ],
          }),
        },
        this.proxy
      )
      const text = await res.text()
      if (text !== 'ok') return { success: false, message: text }
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message }
    }
  }
}

// ─── Ntfy ─────────────────────────────────────────────────────────────────────

export class NtfyNoticeProvider extends NoticeProvider {
  constructor(
    private cfg: { serverUrl: string; topic: string; token?: string },
    private proxy?: ProxyInfo
  ) {
    super()
  }

  async send(title: string, content: string): Promise<NoticeSendResult> {
    try {
      const headers: Record<string, string> = {
        Title: title,
        'Content-Type': 'text/plain',
        Markdown: 'yes',
      }
      if (this.cfg.token) headers['Authorization'] = `Bearer ${this.cfg.token}`
      const res = await proxyFetch(
        `${this.cfg.serverUrl}/${this.cfg.topic}`,
        {
          method: 'POST',
          headers,
          body: content,
        },
        this.proxy
      )
      if (!res.ok) return { success: false, message: `HTTP ${res.status}` }
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message }
    }
  }
}

// ─── 工厂 ─────────────────────────────────────────────────────────────────────

export async function createNoticeProvider(
  notice: NoticeRow
): Promise<NoticeProvider | null> {
  const cfg = notice.config as any

  // 解析代理
  let proxy: ProxyInfo | undefined = undefined
  let proxyUrl: string | undefined = undefined
  if (notice.proxyName) {
    const { config, buildProxyUrl } = await import('../config/index.js')
    const proxyEntry = (config as any).proxy?.find(
      (x: any) => x.name === notice.proxyName
    )
    if (proxyEntry) {
      const url = buildProxyUrl(proxyEntry)
      if (url) {
        proxy = { url, type: proxyEntry.type }
        proxyUrl = url // for Email (nodemailer supports socks5:// natively)
      }
    }
  }

  switch (notice.type) {
    case 'url':
      return new UrlNoticeProvider(
        { url: cfg.url, method: cfg.method ?? 'POST', key: cfg.key ?? 'data' },
        proxy
      )
    case 'email':
      return new EmailNoticeProvider(cfg, proxyUrl)
    case 'dingtalk':
      return new DingTalkNoticeProvider(cfg, proxy)
    case 'feishu':
      return new FeishuNoticeProvider(cfg, proxy)
    case 'wework':
      return new WeWorkNoticeProvider(cfg, proxy)
    case 'telegram':
      return new TelegramNoticeProvider(cfg, proxy)
    case 'slack':
      return new SlackNoticeProvider(cfg, proxy)
    case 'ntfy':
      return new NtfyNoticeProvider(cfg, proxy)
    default:
      return null
  }
}

// ─── 速率限制缓存 ─────────────────────────────────────────────────────────────

const _lastSentAt = new Map<number, number>()

/**
 * 发送通知（含速率限制和日志记录）
 */
export async function sendNotice(
  userId: number,
  noticeId: number,
  title: string,
  content: string
): Promise<NoticeSendResult> {
  const notice = await noticeDb.findNoticeById(noticeId)
  if (!notice || !notice.enable)
    return { success: false, message: '通知渠道未启用' }

  if (notice.rateLimitEnable) {
    const last = _lastSentAt.get(noticeId) ?? 0
    const diffSeconds = (Date.now() - last) / 1000
    if (diffSeconds < notice.rateInterval) {
      return {
        success: false,
        message: `速率限制中，请 ${Math.ceil(notice.rateInterval - diffSeconds)} 秒后重试`,
      }
    }
  }

  const provider = await createNoticeProvider(notice)
  if (!provider)
    return { success: false, message: `不支持的通知类型: ${notice.type}` }

  const result = await provider.send(title, content)

  if (notice.rateLimitEnable && result.success) {
    _lastSentAt.set(noticeId, Date.now())
  }

  try {
    await noticeDb.createNoticeLog({
      tenantId: notice.tenantId,
      userId,
      noticeId,
      title,
      content,
      status: result.success ? 'success' : 'fail',
    })
  } catch (e) {
    logger.warn({ e }, 'Failed to write notice log')
  }

  return result
}

/**
 * 批量向 userId 下所有启用的通知渠道发送
 */
export async function broadcastNotice(
  userId: number,
  title: string,
  content: string,
  tenantId: number = 1
): Promise<void> {
  const notices = (await noticeDb.findAllNotices(tenantId, userId)).filter(
    (n) => n.enable
  )
  if (!notices.length) {
    try {
      await noticeDb.createNoticeLog({
        tenantId,
        userId,
        noticeId: 0,
        title,
        content,
        status: 'fail',
      })
    } catch (e) {
      logger.warn({ e }, 'Failed to write notice log (no channel)')
    }
    return
  }
  await Promise.allSettled(
    notices.map((n) => sendNotice(userId, n.id, title, content))
  )
}

/**
 * 向所有用户的"默认通知渠道"发送（用于系统级广播，如服务启动通知）。
 * 遵循 default_notice_ids 设置；若留空则发送到该用户所有已启用渠道。
 */
export async function broadcastNoticeAll(
  title: string,
  content: string
): Promise<void> {
  const notices = await noticeDb.findAllEnabledNotices()
  const userMap = new Map<string, { userId: number; tenantId: number }>()
  for (const n of notices) {
    const key = `${n.tenantId}:${n.userId}`
    if (!userMap.has(key)) {
      userMap.set(key, { userId: n.userId, tenantId: n.tenantId })
    }
  }
  await Promise.allSettled(
    [...userMap.values()].map(({ userId, tenantId }) =>
      broadcastNoticeToDefault(userId, title, content, tenantId)
    )
  )
}

/**
 * 向指定用户的"默认通知渠道"发送通知。
 * 若 default_notice_ids 设置留空，则发送到该用户所有已启用渠道。
 */
export async function broadcastNoticeToDefault(
  userId: number,
  title: string,
  content: string,
  tenantId: number = 1
): Promise<void> {
  const { getSetting } = await import('./setting.js')
  const idsRaw = await getSetting('default_notice_ids', '[]')
  let ids: number[] = []
  try {
    ids = JSON.parse(idsRaw)
  } catch {
    /* 留空时发所有 */
  }

  if (!ids.length) {
    return broadcastNotice(userId, title, content, tenantId)
  }

  const allNotices = (await noticeDb.findAllNotices(tenantId, userId)).filter(
    (n) => n.enable && ids.includes(n.id)
  )
  if (!allNotices.length) {
    try {
      await noticeDb.createNoticeLog({
        tenantId,
        userId,
        noticeId: 0,
        title,
        content,
        status: 'fail',
      })
    } catch (e) {
      logger.warn({ e }, 'Failed to write notice log (no channel)')
    }
    return
  }
  await Promise.allSettled(
    allNotices.map((n) => sendNotice(userId, n.id, title, content))
  )
}
