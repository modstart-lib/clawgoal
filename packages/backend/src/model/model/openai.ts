/**
 * OpenAI API driver and LangChain model factory.
 * Handles chat completions with tool calling support.
 * This is a thin wrapper that keeps the openai SDK isolated here.
 */

import { ChatOpenAICompletions } from '@langchain/openai'
import type { ModelConfig } from '../../config'
import { jsonParse, jsonStringify } from '../../utils/json.js'
import { logger } from '../../utils/logger'

const MAX_DEBUG_BODY = 12_000

function chatCompletionsUrl(url: string): boolean {
  return (
    /\/chat\/completions(\?|$|#)/i.test(url) ||
    /\/v1\/chat\/completions/i.test(url)
  )
}

/**
 * Wraps fetch so failed HTTP or empty `choices` on chat/completions logs response shape (truncated).
 */
function createOpenAICompatDebugFetch(
  innerFetch: typeof globalThis.fetch
): typeof globalThis.fetch {
  return async (input, init) => {
    const res = await innerFetch(
      input as Parameters<typeof innerFetch>[0],
      init
    )
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url

    if (!chatCompletionsUrl(url)) return res

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text/event-stream')) {
      if (!res.ok) {
        try {
          const text = await res.clone().text()
          logger.warn(
            {
              scope: 'openai-compat',
              status: res.status,
              url: url.slice(0, 512),
              bodyPreview: text.slice(0, MAX_DEBUG_BODY),
            },
            'OpenAICompat.ChatCompletions.StreamHttpError'
          )
        } catch {
          /* ignore */
        }
      }
      return res
    }

    let text: string
    try {
      text = await res.clone().text()
    } catch {
      return res
    }

    let parsed: unknown
    try {
      parsed = text ? jsonParse(text) : null
    } catch {
      if (!res.ok) {
        logger.warn(
          {
            scope: 'openai-compat',
            status: res.status,
            url: url.slice(0, 512),
            bodyPreview: text.slice(0, MAX_DEBUG_BODY),
          },
          'OpenAICompat.ChatCompletions.NonJsonBody'
        )
      }
      return res
    }

    const choices =
      parsed &&
      typeof parsed === 'object' &&
      parsed !== null &&
      'choices' in parsed &&
      Array.isArray((parsed as { choices: unknown }).choices)
        ? (parsed as { choices: unknown[] }).choices
        : null
    const choicesLength = choices?.length ?? null

    const emptyChoices = res.ok && choices !== null && choices.length === 0
    if (!res.ok || emptyChoices) {
      const serialized = jsonStringify(parsed)
      logger.warn(
        {
          scope: 'openai-compat',
          status: res.status,
          ok: res.ok,
          url: url.slice(0, 512),
          choicesLength,
          responseBodyPreview: serialized.slice(0, MAX_DEBUG_BODY),
          responseBodyTotalLength: serialized.length,
        },
        emptyChoices
          ? 'OpenAICompat.ChatCompletions.EmptyChoices'
          : 'OpenAICompat.ChatCompletions.HttpErrorBody'
      )
    }

    return res
  }
}

/**
 * Create a LangChain ChatOpenAI model instance for OpenAI or OpenAI-compatible endpoints.
 * Use for provider type 'openai' and 'custom'.
 */
export function createOpenAILangChainModel(
  config: ModelConfig,
  streaming: boolean,
  temperature: number,
  maxTokens?: number
) {
  return new ChatOpenAICompletions({
    model: config.model,
    temperature,
    apiKey: config.apiKey,
    ...(maxTokens ? { maxTokens } : {}),
    configuration: {
      baseURL: config.apiBase || undefined,
      fetch: createOpenAICompatDebugFetch(globalThis.fetch.bind(globalThis)),
    },
    streaming,
  })
}
