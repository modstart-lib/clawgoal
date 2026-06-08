import type { ToolDefinition, ToolResult } from '../types/index.js'

/** Sentinel returned by context_set so AgentModel can detect and update state.context */
export const CONTEXT_SET_PREFIX = '__CONTEXT_SET__:'

export const contextSetDefinition: ToolDefinition = {
  name: 'context_set',
  description:
    'Set a named key in the workflow context. Use this to record decisions that later pipeline nodes (ContextRouter) can branch on. ' +
    'For example, call context_set(key="studioResolved", value="runtime=local runner=opencode") once the AI Studio runner is confirmed.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Context key name (camelCase, e.g. studioResolved)',
      },
      value: {
        type: 'string',
        description: 'Value to store (non-empty string means "set/truthy")',
      },
    },
    required: ['key', 'value'],
  },
}

export async function contextSet(args: {
  key: string
  value: string
}): Promise<ToolResult> {
  const { key, value } = args
  if (!key) return { success: false, output: '', error: 'key is required' }
  // Return a sentinel that AgentModel intercepts to update state.context
  return {
    success: true,
    output: `${CONTEXT_SET_PREFIX}${JSON.stringify({ key, value })}`,
  }
}
