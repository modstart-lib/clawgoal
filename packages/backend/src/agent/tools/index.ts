import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { AgentExecutor } from '../agentExecutor.js'
import { createAsksTool } from './asks.js'
import { createReadFileTool } from './readFile.js'
import { createSearchFileTool } from './searchFile.js'
import { createWriteFileTool } from './writeFile.js'

export const AgentTools = {
  readFile: 'read_file',
  writeFile: 'write_file',
  searchFile: 'search_file',
  asks: 'asks',
} as const

export type AgentToolName = (typeof AgentTools)[keyof typeof AgentTools]

/**
 * Get the specified tool list
 * @param executor Agent executor instance
 * @param toolNames Array of tool names to retrieve, e.g., ['asks', 'read_file', 'write_file']
 * @returns Array of tool instances, can be passed directly to invokeLLM
 * @throws If the tool name is invalid or not implemented
 *
 * @example
 * ```typescript
 * const tools = useTools(context.executor, ['asks', 'read_file']);
 * await invokeLLM({ tools, ... });
 * ```
 */
export function useTools(
  executor: AgentExecutor,
  toolNames: AgentToolName[]
): DynamicStructuredTool[] {
  const tools: DynamicStructuredTool[] = []
  const validToolNames = Object.values(AgentTools)

  for (const toolName of toolNames) {
    if (!validToolNames.includes(toolName)) {
      throw new Error(
        `Invalid tool name: "${toolName}". Valid tools are: ${validToolNames.join(', ')}`
      )
    }
    switch (toolName) {
      case AgentTools.asks:
        tools.push(createAsksTool(executor))
        break
      case AgentTools.readFile:
        tools.push(createReadFileTool(executor))
        break
      case AgentTools.searchFile:
        tools.push(createSearchFileTool(executor))
        break
      case AgentTools.writeFile:
        tools.push(createWriteFileTool(executor))
        break
      default:
        throw new Error(`Tool "${toolName}" is not implemented`)
    }
  }

  return tools
}

/**
 * Manually invoke a single tool (without going through Model)
 * @param executor Agent executor instance
 * @param toolName Tool name
 * @param input Tool input parameters
 * @param onModelToolsStart Callback when tool call starts
 * @param onModelToolsEnd Callback when tool call ends
 * @param toolsGetter Custom tool resolver (defaults to useTools; can pass useMarketTools etc.)
 * @returns Tool execution result string
 *
 * @example
 * ```typescript
 * // Using default agent tools
 * const result = await callTool(executor, 'read_file', { filename: 'content.md' });
 * // Using market extended tools
 * const result = await callTool(executor, 'material_read', { id: 1 }, onStart, onEnd, useMarketTools);
 * ```
 */
export async function callTool(
  executor: AgentExecutor,
  toolName: AgentToolName | string,
  input: Record<string, any> = {},
  /** Callback when tool call starts */
  onModelToolsStart?: (name: string, args: any) => void | Promise<void>,
  /** Callback when tool call ends */
  onModelToolsEnd?: (
    name: string,
    status: 'success' | 'fail',
    result?: string,
    error?: string
  ) => void | Promise<void>,
  /** Custom tool resolver (defaults to useTools; can pass useMarketTools etc.) */
  toolsGetter?: (
    executor: AgentExecutor,
    names: any[]
  ) => DynamicStructuredTool[]
): Promise<string> {
  const getter =
    toolsGetter ??
    ((exec: AgentExecutor, names: string[]) =>
      useTools(exec, names as AgentToolName[]))
  const [tool] = getter(executor, [toolName])
  if (onModelToolsStart) await onModelToolsStart(toolName, input)
  try {
    const result = await tool.invoke(input)
    const resultStr =
      typeof result === 'string' ? result : JSON.stringify(result)
    if (onModelToolsEnd)
      await onModelToolsEnd(toolName, 'success', resultStr, undefined)
    return resultStr
  } catch (error: any) {
    if (onModelToolsEnd)
      await onModelToolsEnd(toolName, 'fail', undefined, error.message)
    throw error
  }
}
