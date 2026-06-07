import { marked } from 'marked'

marked.setOptions({ async: false })

/** 将 Markdown 字符串解析为 HTML 字符串 */
export function renderMarkdown(md: string): string {
  if (!md) return ''
  return marked.parse(md) as string
}
