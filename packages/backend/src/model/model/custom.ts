/**
 * Gemini provider LangChain model factory.
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { ModelConfig } from '../../config'

/**
 * Ensure the Gemini base URL ends with '/openai' for OpenAI-compatible routing.
 */
export function resolveGeminiBase(apiBase?: string): string {
  const base = (
    apiBase ?? 'https://generativelanguage.googleapis.com/v1beta'
  ).replace(/\/$/, '')
  if (!base.endsWith('/openai')) return base + '/openai'
  return base
}

/**
 * Create a LangChain ChatGoogleGenerativeAI model instance for Gemini providers.
 */
export function createGeminiLangChainModel(
  config: ModelConfig,
  streaming: boolean,
  temperature: number,
  maxTokens?: number
) {
  return new ChatGoogleGenerativeAI({
    model: config.model,
    temperature,
    apiKey: config.apiKey,
    ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
    streaming,
  })
}
