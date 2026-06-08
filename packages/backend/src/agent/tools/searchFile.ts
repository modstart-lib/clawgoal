/**
 * Search file tool
 * LangChain Tool wrapping IFileDriver.search
 */
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import type { AgentExecutor } from '../agentExecutor.js'

export function createSearchFileTool(
  executor: AgentExecutor
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'search_file',
    description:
      'Search for matching content in a file, with regex support. Returns all matching lines.',
    schema: z.object({
      reasoning: z
        .string()
        .describe(
          'Reason for this action: explain why this file needs to be searched and how the results will be used'
        ),
      filename: z.string().describe('Filename to search'),
      pattern: z
        .string()
        .describe('Search pattern — plain string or regular expression'),
      isRegex: z
        .boolean()
        .optional()
        .describe('Whether to use regex (default: false)'),
    }),
    func: async ({ reasoning, filename, pattern, isRegex = false }) => {
      try {
        executor.logger.info(
          { reasoning, filename, pattern, isRegex },
          '[tool:search_file] Starting file search'
        )
        const regex = isRegex ? new RegExp(pattern, 'gi') : pattern
        const results = await executor.file.search(filename, regex)
        executor.logger.info(
          { filename, matchCount: results.length },
          '[tool:search_file] Search complete'
        )

        return JSON.stringify({
          success: true,
          filename,
          pattern,
          matchCount: results.length,
          results: results.slice(0, 50), // Limit to first 50 results
        })
      } catch (error: any) {
        executor.logger.error(
          { filename, pattern, error: error.message },
          '[tool:search_file] Search failed'
        )
        return JSON.stringify({
          success: false,
          error: error.message,
        })
      }
    },
  })
}
