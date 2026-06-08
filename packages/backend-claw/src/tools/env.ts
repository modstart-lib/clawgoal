/**
 * Env management tool.
 *
 * Tool:
 *   env_list_name  — List all environment variable names (values are hidden from LLM)
 */

import { paramDb } from '../../../backend/src/storage/store/userParam.js'
import type { ToolContext, ToolResult } from '../types/index.js'

const ENV_PREFIX = 'Env.'

// ─── env_list_name ────────────────────────────────────────────────────────────

export async function envListName(
  _args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const { userId } = context.agentContext
  try {
    const rows = await paramDb.listByPrefix(
      context.agentContext.tenantId,
      userId,
      ENV_PREFIX
    )
    if (rows.length === 0) {
      return {
        success: true,
        output: 'No environment variables configured currently.',
      }
    }
    const lines = rows.map((r) =>
      r.name.startsWith(ENV_PREFIX)
        ? `- ${r.name.slice(ENV_PREFIX.length)}`
        : `- ${r.name}`
    )
    return {
      success: true,
      output: [
        `Total ${rows.length} environment variables (showing names only, values are hidden):`,
        ...lines,
      ].join('\n'),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `env_list_name failed: ${msg}`,
    }
  }
}
