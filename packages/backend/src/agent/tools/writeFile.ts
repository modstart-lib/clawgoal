/**
 * Write file tool
 * LangChain Tool wrapping IFileDriver.write
 */
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import type { AgentExecutor } from '../agentExecutor.js'

export function createWriteFileTool(
  executor: AgentExecutor
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'write_file',
    description:
      'Write content to a file. Supports overwrite (append=false) and append (append=true) modes. Changes are immediately persisted to the database.',
    schema: z.object({
      reasoning: z
        .string()
        .describe(
          'Reason for this action: explain why this file needs to be written and what the written content will achieve'
        ),
      filename: z.string().describe('Filename to write to'),
      content: z.string().describe('Content to write'),
      append: z
        .boolean()
        .optional()
        .describe(
          'Append mode: true = append to end of file, false = overwrite entire file (default: false)'
        ),
    }),
    func: async ({ reasoning, filename, content, append = false }) => {
      try {
        executor.logger.info(
          {
            reasoning,
            filename,
            contentLength: content.length,
            append,
          },
          '[tool:write_file] Starting file write'
        )
        await executor.file.write(filename, content, { append })
        executor.logger.info(
          {
            filename,
            bytesWritten: Buffer.byteLength(content, 'utf-8'),
          },
          '[tool:write_file] File write successful'
        )

        return JSON.stringify({
          success: true,
          filename,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
          mode: append ? 'append' : 'overwrite',
        })
      } catch (error: any) {
        executor.logger.error(
          { filename, error: error.message },
          '[tool:write_file] File write failed'
        )
        return JSON.stringify({
          success: false,
          error: error.message,
        })
      }
    },
  })
}
