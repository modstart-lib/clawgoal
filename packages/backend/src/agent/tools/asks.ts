/**
 * Ask user tool
 * Used to send an inquiry request event when user input is needed during AI execution
 */
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { generateId } from '../../utils/utils.js'
import { agentEventBus } from '../agentEventBus'
import type { AgentExecutor } from '../agentExecutor.js'
import { EventItemType } from '../types.js'

/**
 * Create the ask user tool
 * @param executor Agent executor instance, used to obtain taskId
 */
export function createAsksTool(executor: AgentExecutor): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'asks',
    description:
      'Use when you need the user to provide additional information, confirm something, or make a choice. Sends an inquiry request to the user and waits for their response. Applicable when: user needs to select an option, confirm information, or provide supplementary input.',
    schema: z.object({
      reasoning: z
        .string()
        .describe(
          'Reason for this action: explain why user input is needed and how the answer will affect subsequent operations'
        ),
      content: z
        .string()
        .optional()
        .describe(
          'Message content (optional) — main content shown to the user'
        ),
      question: z
        .string()
        .optional()
        .describe(
          'Specific question text (optional) — typically shown above the options list'
        ),
      options: z
        .array(z.string())
        .optional()
        .describe(
          'Option list (optional), e.g. ["Option A", "Option B", "Option C"]'
        ),
    }),
    func: async ({ reasoning, content, question, options }) => {
      try {
        executor.logger.info(
          {
            reasoning,
            hasContent: !!content,
            hasQuestion: !!question,
            optionsCount: options?.length,
          },
          '[tool:asks] Sending ask request'
        )
        agentEventBus.emit({
          id: generateId(),
          taskId: executor.taskId,
          event: EventItemType.TaskNodeAsksRequest,
          data: {
            content,
            question,
            options,
          },
          timestamp: Date.now(),
        })
        executor.logger.info('[tool:asks] Ask request sent')
        return JSON.stringify({
          success: true,
          message: 'Ask request sent, waiting for user response',
          hasContent: !!content,
          hasQuestion: !!question,
          hasOptions: !!options,
          optionsCount: options?.length || 0,
        })
      } catch (error: any) {
        executor.logger.error(
          { error: error.message },
          '[tool:asks] Ask request failed'
        )
        return JSON.stringify({
          success: false,
          error: error.message,
        })
      }
    },
  })
}
