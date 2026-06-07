/**
 * Anthropic Claude driver and LangChain model factory.
 * Adapts the OpenAI-format messages to Anthropic's messages API,
 * providing the same interface as OpenAiDriver so the kernel can use them interchangeably.
 */

import { ChatAnthropic } from '@langchain/anthropic'
import type { ModelConfig } from '../../config'

/**
 * Create a LangChain ChatAnthropic model instance for Claude providers.
 */
export function createClaudeLangChainModel(
  config: ModelConfig,
  streaming: boolean,
  temperature: number,
  maxTokens?: number
) {
  return new ChatAnthropic({
    model: config.model,
    temperature,
    apiKey: config.apiKey,
    ...(maxTokens ? { maxTokens } : {}),
    ...(config.apiBase ? { clientOptions: { baseURL: config.apiBase } } : {}),
    streaming,
  })
}
