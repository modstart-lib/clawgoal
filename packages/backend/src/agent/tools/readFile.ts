/**
 * Read file tool
 * LangChain Tool wrapping IFileDriver.read
 */
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import type { AgentExecutor } from '../agentExecutor.js'

export function createReadFileTool(
  executor: AgentExecutor
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'read_file',
    description:
      'Read the content of task-related files. Supports reading the entire file or a specific line range.',
    schema: z.object({
      reasoning: z
        .string()
        .describe(
          'Reason for this action: explain why this file needs to be read and how its content will be used'
        ),
      filename: z
        .string()
        .describe('Filename to read, e.g. meta.json, content.md'),
      startLine: z
        .number()
        .optional()
        .describe('Start line number (optional, 1-based)'),
      endLine: z
        .number()
        .optional()
        .describe('End line number (optional, inclusive)'),
    }),
    func: async ({ reasoning, filename, startLine, endLine }) => {
      try {
        executor.logger.info(
          { reasoning, filename, startLine, endLine },
          '[tool:read_file] Starting file read'
        )
        const content = await executor.file.read(filename, {
          startLine,
          endLine,
        })
        executor.logger.info(
          { filename, contentLength: content.length },
          '[tool:read_file] File read successfully'
        )
        return JSON.stringify({
          success: true,
          filename,
          content,
          lines: content.split('\n').length,
        })
      } catch (error: any) {
        executor.logger.error(
          { filename, error: error.message },
          '[tool:read_file] File read failed'
        )
        return JSON.stringify({
          success: false,
          error: error.message,
        })
      }
    },
  })
}
