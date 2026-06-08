/**
 * Telegram channel — public API.
 * Re-exports all symbols from the focused sub-modules:
 *   utils            — shared constants and format helpers
 *   adapter          — TelegramAdapter (agent-based, legacy token-per-agent)
 *   channelAdapter   — TelegramChannelAdapter (channel-row-based, extends ChannelAdapterBase)
 */

export * from './adapter.js'
export * from './channelAdapter.js'

/** Maximum Telegram message length (Telegram API limit) */
export const MAX_MSG_LENGTH = 4096
/**
 * Timeout (ms) to wait for additional message chunks before merging and dispatching.
 * Telegram may split a very long message into multiple shorter ones;
 * we buffer them and flush once no new chunk arrives within this window.
 */
export const MESSAGE_MERGE_TIMEOUT_MS = 2000

/**
 * Convert a agent name/role to a valid Telegram command slug.
 * Telegram commands: lowercase a-z, 0-9, underscore, 1-32 chars.
 */
export function toCommandSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[-\s]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 32) || 'agent'
  )
}

/** Escape characters that have special meaning in Telegram MarkdownV2 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`)
}

/** Escape HTML special characters */
export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Convert Markdown text to Telegram HTML format.
 *
 * Handles: fenced code blocks, headings, bold/italic markers,
 * inline code, links, and horizontal rules.
 * All non-code text is HTML-escaped so the result is always safe to
 * send with parse_mode HTML.
 */
export function markdownToTelegramHtml(md: string): string {
  if (!md) return md
  // Split on fenced code blocks to avoid processing their contents
  const parts = md.split(/(```[\w]*\n?[\s\S]*?```)/g)
  const segments: Array<{ type: 'code' | 'text'; content: string }> = []
  for (const part of parts) {
    const codeMatch = part.match(/^```[\w]*\n?([\s\S]*?)```$/)
    if (codeMatch) {
      segments.push({ type: 'code', content: codeMatch[1] })
    } else {
      segments.push({ type: 'text', content: part })
    }
  }
  const processText = (text: string): string => {
    // Pre-process: convert HTML <a href="...">text</a> to Markdown [text](url)
    // so they survive escHtml and get rendered as proper Telegram links
    text = text.replace(
      /<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, url, linkText) => {
        const decodedUrl = url
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
        const plainText = linkText.replace(/<[^>]+>/g, '').trim()
        return `[${plainText}](${decodedUrl})`
      }
    )
    // Pre-process: convert common HTML formatting tags to Markdown equivalents
    // so they survive escHtml (handles LLM output that uses HTML instead of Markdown)
    text = text.replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
    text = text.replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, '_$1_')
    text = text.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
    // Extract inline code spans into placeholders BEFORE italic/bold processing.
    // Without this, `_([^_\n]+)_` can match underscores that span across multiple
    // backtick code spans (because [^_\n] matches backticks), producing mismatched
    // <i> tags that cross <code> boundaries and make Telegram reject the HTML.
    const codeSpans: string[] = []
    text = text.replace(/`([^`\n]+)`/g, (_, inner) => {
      codeSpans.push(inner)
      return `\x00CODE${codeSpans.length - 1}\x00`
    })
    let s = escHtml(text)
    // Headings → bold
    s = s.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
    // Bold: **text** or __text__
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    s = s.replace(/__([^_\n]+)__/g, '<b>$1</b>')
    // Italic: *text* or _text_ (single markers)
    s = s.replace(/\*([^*\n]+)\*/g, '<i>$1</i>')
    s = s.replace(/_([^_\n]+)_/g, '<i>$1</i>')
    // Links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Horizontal rule
    s = s.replace(/^(?:---|\*\*\*|___)\s*$/gm, '──────────')
    // Restore inline code spans (HTML-escape content separately)
    s = s.replace(
      new RegExp(
        String.fromCharCode(0) + 'CODE(\\d+)' + String.fromCharCode(0),
        'g'
      ),
      (_, idx) => `<code>${escHtml(codeSpans[parseInt(idx)])}</code>`
    )
    return s
  }
  return segments
    .map((seg) =>
      seg.type === 'code'
        ? `<pre>${escHtml(seg.content)}</pre>`
        : processText(seg.content)
    )
    .join('')
}
