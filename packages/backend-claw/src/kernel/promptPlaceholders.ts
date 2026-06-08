/**
 * System prompt placeholder resolution.
 *
 * Supported placeholders (case-insensitive, format: `{{placeholder_name}}`):
 *
 *   {{project_list_simple}} — One-line-per-project summary for awareness only.
 *   {{user_lang}}           — The user's conversation language (e.g. "Chinese(简体中文)").
 *
 * Usage in a role's config.yaml systemPrompt:
 *
 *   systemPrompt: |
 *     You are the Secretary. Please reply in {{user_lang}}.
 *
 * At call time, `resolvePlaceholders(prompt)` scans the string for `{{...}}` tokens
 * and replaces each recognised one with the output of the corresponding handler.
 * Unknown tokens are left unchanged so they can safely serve as template markers
 * for future extensions without breaking existing prompts.
 */

import { buildLang } from '../../../backend/src/utils/env'
import { type LocaleKey } from '../../../backend/src/locale/index.js'
import { clawDb } from '../storage/store/index.js'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Runtime context passed to every placeholder handler. */
export interface PlaceholderContext {
  /** The user's preferred language; defaults to `'en-US'` when omitted. */
  language?: LocaleKey
  /** Agent's user-configured param values, keyed by param name. */
  agentParam?: Record<string, unknown>
  /** Runtime workflow context (state.context), used for {{context.KEY}} tokens. */
  context?: Record<string, unknown>
}

/** A handler returns a string (or Promise<string>) to replace a placeholder. */
type PlaceholderHandler = (ctx: PlaceholderContext) => string | Promise<string>

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * {{project_list_simple}} — one-line-per-project summary for awareness only.
 * Format: `- [id] title (status)`
 */
function buildProjectListSimple(): string {
  const projects = clawDb.findAllProjects(1, 1)
  if (projects.length === 0) {
    return '（暂无项目）'
  }
  const STATUS_LABEL: Record<string, string> = {
    planning: '规划中',
    active: '进行中',
    paused: '已暂停',
    done: '已完成',
  }
  return projects
    .map(
      (p) => `- ${p.title} (ID=${p.id},${STATUS_LABEL[p.status] ?? p.status})`
    )
    .join('\n')
}

/**
 * {{user_lang}} — the user's conversation language string.
 * Uses `buildLang` from env utils; defaults to `'en-US'` when no language is set.
 */
function buildUserLang(ctx: PlaceholderContext): string {
  return buildLang(ctx.language)
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Map of lowercase placeholder name → handler function.
 * Add new entries here to support additional placeholders.
 */
const PLACEHOLDER_REGISTRY: Record<string, PlaceholderHandler> = {
  project_list_simple: buildProjectListSimple,
  user_lang: buildUserLang,
}

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Replace all `{{placeholder}}` tokens in `prompt` with dynamically generated
 * content from the registered handlers.
 *
 * - Tokens are matched case-insensitively.
 * - Unknown tokens are left unchanged.
 * - All handlers are resolved concurrently for performance.
 *
 * @param prompt  - The raw system prompt string (may contain zero or more placeholders).
 * @param context - Optional runtime context (e.g. the current agent's allowed tools).
 * @returns       - The prompt with all known placeholders replaced.
 */
export async function resolvePlaceholders(
  prompt: string,
  context: PlaceholderContext = {}
): Promise<string> {
  // Fast-path: no placeholders present — avoid regex overhead
  if (!prompt.includes('{{')) {
    return prompt
  }

  // Collect unique placeholder names referenced in the prompt
  // TOKEN_RE supports dot-notation for agent.param.* tokens
  const TOKEN_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g
  const referenced = new Set<string>()
  for (const match of prompt.matchAll(TOKEN_RE)) {
    referenced.add(match[1]!)
  }

  // Resolve all recognised handlers concurrently
  const resolved = new Map<string, string>()
  await Promise.all(
    [...referenced]
      .filter((name) => name.toLowerCase() in PLACEHOLDER_REGISTRY)
      .map(async (name) => {
        const key = name.toLowerCase()
        try {
          const value = await PLACEHOLDER_REGISTRY[key]!(context)
          resolved.set(name, value)
        } catch (err) {
          // On error, replace with an empty placeholder note rather than crashing
          resolved.set(
            name,
            `（${name} 加载失败: ${err instanceof Error ? err.message : String(err)}）`
          )
        }
      })
  )

  // Resolve agent.param.* tokens from context.agentParam
  for (const name of referenced) {
    if (name.startsWith('agent.param.') && !resolved.has(name)) {
      const paramKey = name.slice('agent.param.'.length)
      const val = context.agentParam?.[paramKey]
      resolved.set(
        name,
        val != null && String(val).trim() !== '' ? String(val) : `<${name}>`
      )
    }
  }

  // Resolve context.* tokens from runtime workflow context (state.context)
  for (const name of referenced) {
    if (name.startsWith('context.') && !resolved.has(name)) {
      const ctxKey = name.slice('context.'.length)
      const val = context.context?.[ctxKey]
      resolved.set(
        name,
        val != null && String(val).trim() !== '' ? String(val) : ''
      )
    }
  }

  // Replace tokens in the prompt
  return prompt.replace(TOKEN_RE, (_match, raw: string) => {
    return resolved.has(raw) ? resolved.get(raw)! : _match
  })
}
