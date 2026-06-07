import { getUserLang } from '../../../backend/src/locale/index.js'
import {
  buildSystemInfoLangPrompt,
  buildSystemInfoPrompt,
} from '../../../backend/src/utils/env.js'

/**
 * Build the full system info prompt (time + OS + language) for a background task agent.
 */
export async function buildUserSystemInfoPrompt(
  tenantId: number,
  userId: number
): Promise<string> {
  const language = await getUserLang(tenantId, userId)
  return buildSystemInfoPrompt(new Date(), language)
}

/**
 * Build only the language instruction line for inline prompts.
 * e.g. "Language: Please communicate with the user in Simplified Chinese (简体中文)"
 */
export async function buildUserSystemInfoLangPrompt(
  tenantId: number,
  userId: number
): Promise<string> {
  const language = await getUserLang(tenantId, userId)
  return buildSystemInfoLangPrompt(language)
}
