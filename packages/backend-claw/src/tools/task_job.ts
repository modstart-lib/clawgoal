/**
 * TaskJob management tools – allow agents to dispatch sub-tasks to other agents
 * and report the outcome of tasks assigned to them.
 *
 *   task_job_dispatch — 向另一个 Agent 派发一个子任务，并在任务队列中排队等待执行
 *   task_job_done     — 标记当前子任务已完成，填写输出结果
 *   task_job_fail     — 标记当前子任务失败
 */

import { clawDb } from '../storage/store/index.js'
import { clawEventBus } from '../kernel/eventBus.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

// ─── task_job_dispatch ──────────────────────────────────────────────────────────

async function taskJobDispatch(
  args: {
    agent_id: number
    input: string
    task_id?: number
    key_result_id?: number
    sort?: number
  },
  context: ToolContext
): Promise<ToolResult> {
  try {
    if (!args.input?.trim()) {
      return { success: false, output: '', error: 'input 不能为空。' }
    }
    const agent = clawDb.findById(Number(args.agent_id))
    if (!agent) {
      return {
        success: false,
        output: '',
        error: `Agent id=${args.agent_id} 不存在。`,
      }
    }
    // 使用当前上下文中的 taskId 作为父任务 ID
    const parentId = context.agentContext.taskId ?? args.task_id ?? undefined
    let rootId: number | undefined
    if (parentId) {
      const parentTask = clawDb.findTaskById(Number(parentId))
      if (parentTask) {
        rootId = parentTask.root_id > 0 ? parentTask.root_id : Number(parentId)
      }
    }
    const subTask = clawDb.insertTask({
      tenantId: context.agentContext.tenantId,
      userId: context.agentContext.userId,
      agentId: Number(args.agent_id),
      title: args.input.trim(),
      keyResultId: args.key_result_id ?? undefined,
      status: 'ready',
      parentId: parentId ?? undefined,
      rootId,
      sort: parentId ? clawDb.getNextChildSort(Number(parentId)) : 0,
      source: 'manual',
    })
    return {
      success: true,
      output: `子任务已派发。task id: ${subTask.id}，agent: ${agent.title}（id:${agent.id}），状态: ready。`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `task_job_dispatch 失败: ${msg}`,
    }
  }
}

// ─── task_job_success ──────────────────────────────────────────────

async function taskJobSuccess(args: {
  action_id: number
  output?: string
}): Promise<ToolResult> {
  try {
    const task = clawDb.findTaskById(Number(args.action_id))
    if (!task) {
      return {
        success: false,
        output: '',
        error: `子任务 id=${args.action_id} 不存在。`,
      }
    }
    clawDb.updateTaskStatus(
      Number(args.action_id),
      'success',
      args.output ?? null
    )
    clawEventBus.emit('task:updated', {
      taskId: Number(args.action_id),
      status: 'success',
    })
    clawDb.checkAndAutoCompleteParent(Number(args.action_id))
    return {
      success: true,
      output: `子任务 id:${task.id} 已标记为成功。`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `task_job_success 失败: ${msg}`,
    }
  }
}

// ─── task_job_fail ──────────────────────────────────────────────────────────────

async function taskJobFail(args: {
  action_id: number
  reason?: string
}): Promise<ToolResult> {
  try {
    const task = clawDb.findTaskById(Number(args.action_id))
    if (!task) {
      return {
        success: false,
        output: '',
        error: `子任务 id=${args.action_id} 不存在。`,
      }
    }
    clawDb.updateTaskStatus(
      Number(args.action_id),
      'failed',
      args.reason ?? null
    )
    clawEventBus.emit('task:updated', {
      taskId: Number(args.action_id),
      status: 'failed',
    })
    clawDb.checkAndAutoCompleteParent(Number(args.action_id))
    return {
      success: true,
      output: `子任务 id:${task.id} 已标记为失败。`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `task_job_fail 失败: ${msg}` }
  }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

export const taskJobDispatchDefinition: ToolDefinition = {
  name: 'task_job_dispatch',
  description: 'Dispatch a sub-task to an Agent.',
  parameters: {
    type: 'object',
    properties: {
      agent_id: { type: 'number', description: 'ID of the target Agent' },
      input: { type: 'string', description: 'Instruction for the Agent' },
      task_id: {
        type: 'number',
        description:
          'Parent task_id (optional, defaults to current context task)',
      },
      key_result_id: {
        type: 'number',
        description: 'Optional key result association',
      },
      sort: {
        type: 'number',
        description: 'Execution order hint (informational only)',
      },
    },
    required: ['agent_id'],
  },
}

export const taskJobSuccessDefinition: ToolDefinition = {
  name: 'task_job_success',
  description: 'Mark a sub-task as successful.',
  parameters: {
    type: 'object',
    properties: {
      action_id: { type: 'number', description: 'Sub-task (task) id' },
      output: { type: 'string', description: 'Result summary' },
    },
    required: ['action_id'],
  },
}

export const taskJobFailDefinition: ToolDefinition = {
  name: 'task_job_fail',
  description: 'Mark a sub-task as failed.',
  parameters: {
    type: 'object',
    properties: {
      action_id: { type: 'number', description: 'Sub-task (task) id' },
      reason: { type: 'string', description: 'Reason for failure (optional)' },
    },
    required: ['action_id'],
  },
}

export { taskJobDispatch, taskJobSuccess, taskJobFail }
