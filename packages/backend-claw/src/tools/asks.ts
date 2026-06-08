/**
 * Asks tool — lets an agent ask the user a question with selectable options.
 *
 * When called inside a task context (agentContext.taskId is set):
 *   1. Sets the task status to 'asking' so the dispatcher stops re-dispatching it.
 *   2. Emits a message:outgoing event with the question/options so the web UI can render them.
 *   3. Emits task:updated so the task list refreshes.
 *   4. Returns pause:true so the model loop detects and pauses execution.
 *
 * Outside a task context (plain chat):
 *   - Emits message:outgoing with the question/options to the current chat.
 *   - Returns success as usual (no pause).
 */

import { clawDb } from '../storage/store/index.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'
import { clawMessage } from '../types/index.js'

const logger = createLogger('tool:asks')

export const asksDefinition: ToolDefinition = {
  name: 'asks',
  description:
    'Use when you need the user to provide additional information, make a choice, or confirm something. ' +
    'Sends a question with optional pre-defined options. The user only needs to click, not type. ' +
    'In a task session the task will pause until the user answers.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Optional introductory message shown above the question.',
      },
      question: {
        type: 'string',
        description: 'The specific question text shown to the user.',
      },
      options: {
        type: 'array',
        description: 'Selectable option labels, e.g. ["Option A", "Option B"].',
        items: { type: 'string', description: 'Option label' },
      },
    },
    required: ['question'],
  },
}

export async function asksTool(
  args: {
    content?: string
    question?: string
    options?: string[]
    actionView?: { label: string; data?: Record<string, any> }
  },
  context: ToolContext
): Promise<ToolResult> {
  const { content, question, options, actionView } = args
  const { agentContext } = context
  const taskId = agentContext.taskId

  logger.info(
    { question, optionsCount: options?.length, taskId },
    'asks: sending question to user'
  )

  // Build the asks message content
  const asks = question
    ? [
        {
          id: context.toolCallId,
          question,
          options: options?.map((o, i) => ({ label: o, value: String(i) })),
        },
      ]
    : undefined

  // Broadcast the question message + persist via agentLog.ts (driven by message:outgoing)
  const agentId = agentContext.agentId
  const sessionId = agentContext.sessionId ?? 0
  // Source: task_job if in a task context, otherwise web (session/workflow)
  const msgSource = taskId ? 'task_job' : 'web'
  void clawEventBus.emit('message:outgoing', {
    agentId,
    chatId: 0,
    content: clawMessage.text(content ?? ''),
    userId: agentContext.userId,
    source: msgSource,
    sessionId,
    msgId: context.toolCallId,
    dbContent: {
      role: 'assistant',
      text: content ?? '',
      asks,
      actionView: actionView ?? undefined,
      source: msgSource,
      timestamp: String(Date.now()),
    },
    agentContext,
  })

  // If running inside a task, change status to 'asking' and emit task:updated
  if (taskId) {
    try {
      const task = clawDb.findTaskById(taskId)
      if (task && task.status === 'running') {
        clawDb.updateTaskStatus(taskId, 'asking', 'Waiting for user input')
        void clawEventBus.emit('task:updated', { taskId, status: 'asking' })
        logger.info({ taskId }, 'asks: task status set to asking')
      }
    } catch (err) {
      logger.warn({ err, taskId }, 'asks: failed to update task status')
    }

    return {
      success: true,
      output: 'asks sent — waiting for user input',
      pause: true,
    }
  }

  // If running inside a workflow session (no task), return pause signal as well.
  // AgentModel/schedule.ts detects pause → cancels workflow → _runGraph serializes the paused state.
  if (sessionId > 0) {
    logger.info({ sessionId }, 'asks: workflow session pause detected')
    return {
      success: true,
      output: 'asks sent — waiting for user input',
      pause: true,
    }
  }

  return {
    success: true,
    output: JSON.stringify({
      sent: true,
      question,
      optionsCount: options?.length ?? 0,
    }),
  }
}
