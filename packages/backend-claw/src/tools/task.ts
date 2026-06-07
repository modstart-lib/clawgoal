/**
 * Task management tools.
 */

import { config } from '../../../backend/src/config/index.js'
import { clawDb } from '../storage/store/index.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  ready: '就绪',
  asking: '待反馈',
  running: '进行中',
  success: '成功',
  fail: '失败',
  canceled: '已取消',
}

// ─── task_list ────────────────────────────────────────────────────────────────

async function taskList(
  args: { status?: string; limit?: number },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const limit = Math.min(args.limit ?? 20, 50)
    const tasks = clawDb.findAllTasks(
      context.agentContext.tenantId,
      context.agentContext.userId,
      {
        status: args.status,
        limit,
      }
    )
    if (tasks.length === 0) {
      return {
        success: true,
        output: args.status
          ? `没有状态为"${args.status}"的任务。`
          : '暂无任务。',
      }
    }
    const cell = (v: string | null | undefined) =>
      (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
    const header =
      '| id | title | status | due_at | estimated_hours | created_at |'
    const sep = '|---|---|---|---|---|---|'
    const rows = tasks.map((t) => {
      const statusLabel = STATUS_LABELS[t.status] ?? t.status
      return `| ${t.id} | ${cell(t.title)} | ${statusLabel} | ${cell(t.due_at)} | ${t.estimated_hours ?? '-'} | ${cell(t.created_at)} |`
    })
    return {
      success: true,
      output: [`共 ${tasks.length} 条任务：`, '', header, sep, ...rows].join(
        '\n'
      ),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `task_list 失败: ${msg}` }
  }
}

// ─── task_batch_add ───────────────────────────────────────────────────────────

async function taskBatchAdd(
  args: {
    tasks: Array<{
      title: string
      key_result_id?: number
      description?: string
      agent_id?: number
      due_at?: string
      estimated_hours?: number
    }>
  },
  context: ToolContext
): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.tasks) || args.tasks.length === 0) {
      return { success: false, output: '', error: 'tasks 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.tasks.length; i++) {
      const t = args.tasks[i]
      if (!t.title?.trim()) {
        errors.push(`第 ${i + 1} 条：任务标题不能为空。`)
        continue
      }
      try {
        const row = clawDb.insertTask({
          tenantId: context.agentContext.tenantId,
          userId: context.agentContext.userId,
          title: t.title.trim(),
          keyResultId: t.key_result_id ?? undefined,
          description: t.description || undefined,
          agentId: t.agent_id ?? undefined,
          status: 'ready',
          dueAt: t.due_at || undefined,
          estimatedHours: t.estimated_hours ?? undefined,
        })
        results.push(`  - [id:${row.id}] **${row.title}**`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条 "${t.title}" 失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功创建 ${results.length} 个任务：`)
      lines.push(...results)
    }
    if (errors.length > 0) {
      lines.push(`失败 ${errors.length} 条：`)
      errors.forEach((e) => lines.push(`  - ${e}`))
    }
    return {
      success: results.length > 0,
      output: lines.join('\n'),
      error: errors.length > 0 ? errors.join('; ') : undefined,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `task_batch_add 失败: ${msg}` }
  }
}

// ─── task_batch_edit ──────────────────────────────────────────────────────────

async function taskBatchEdit(args: {
  tasks: Array<{
    id: number
    key_result_id?: number | null
    title?: string
    description?: string
    due_at?: string | null
    estimated_hours?: number | null
  }>
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.tasks) || args.tasks.length === 0) {
      return { success: false, output: '', error: 'tasks 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const t of args.tasks) {
      const task = clawDb.findTaskById(Number(t.id))
      if (!task) {
        errors.push(`找不到 id=${t.id} 的任务。`)
        continue
      }
      const update: Record<string, any> = {}
      if (t.title?.trim()) update.title = t.title.trim()
      if (t.key_result_id !== undefined)
        update.keyResultId = t.key_result_id ?? null
      if (t.description !== undefined)
        update.description = t.description ?? null
      if (t.due_at !== undefined) update.dueAt = t.due_at ?? null
      if (t.estimated_hours !== undefined)
        update.estimatedHours = t.estimated_hours ?? null
      try {
        clawDb.updateTask(Number(t.id), update)
        results.push(`  - [id:${t.id}] 已更新`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${t.id} 更新失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功更新 ${results.length} 个任务：`)
      lines.push(...results)
    }
    if (errors.length > 0) {
      lines.push(`失败 ${errors.length} 条：`)
      errors.forEach((e) => lines.push(`  - ${e}`))
    }
    return {
      success: results.length > 0,
      output: lines.join('\n'),
      error: errors.length > 0 ? errors.join('; ') : undefined,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `task_batch_edit 失败: ${msg}`,
    }
  }
}

// ─── get_shared_content ────────────────────────────────────────────────────────

async function sharedContentGet(
  args: { task_id: number },
  _context: ToolContext
): Promise<ToolResult> {
  try {
    if (!args.task_id) {
      return { success: false, output: '', error: 'task_id 不能为空。' }
    }
    const task = clawDb.findTaskById(Number(args.task_id))
    if (!task) {
      return {
        success: false,
        output: '',
        error: `任务 id=${args.task_id} 不存在。`,
      }
    }
    if (!task.shared_content) {
      return { success: true, output: JSON.stringify(null) }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(task.shared_content)
    } catch {
      parsed = task.shared_content
    }
    return { success: true, output: JSON.stringify(parsed, null, 2) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `get_shared_content 失败: ${msg}`,
    }
  }
}

// ─── set_shared_content ────────────────────────────────────────────────────────

async function sharedContentSet(
  args: { task_id: number; content: Record<string, unknown> },
  _context: ToolContext
): Promise<ToolResult> {
  try {
    if (!args.task_id) {
      return { success: false, output: '', error: 'task_id 不能为空。' }
    }
    if (args.content == null || typeof args.content !== 'object') {
      return {
        success: false,
        output: '',
        error: 'content 必须是 JSON 对象。',
      }
    }
    const task = clawDb.findTaskById(Number(args.task_id))
    if (!task) {
      return {
        success: false,
        output: '',
        error: `任务 id=${args.task_id} 不存在。`,
      }
    }
    clawDb.updateTask(Number(args.task_id), { sharedContent: args.content })
    return {
      success: true,
      output: `任务 id:${args.task_id} 共享内容已更新。`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `set_shared_content 失败: ${msg}`,
    }
  }
}

// ─── task_batch_delete ────────────────────────────────────────────────────────

async function taskBatchDelete(args: { ids: number[] }): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.ids) || args.ids.length === 0) {
      return { success: false, output: '', error: 'ids 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const id of args.ids) {
      const task = clawDb.findTaskById(Number(id))
      if (!task) {
        errors.push(`找不到 id=${id} 的任务。`)
        continue
      }
      if (task.status === 'running') {
        errors.push(`id=${id} 任务运行中，无法删除。`)
        continue
      }
      try {
        clawDb.deleteTask(Number(id))
        results.push(`  - [id:${id}] "${task.title}" 已删除`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${id} 删除失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功删除 ${results.length} 个任务：`)
      lines.push(...results)
    }
    if (errors.length > 0) {
      lines.push(`失败 ${errors.length} 条：`)
      errors.forEach((e) => lines.push(`  - ${e}`))
    }
    return {
      success: results.length > 0,
      output: lines.join('\n'),
      error: errors.length > 0 ? errors.join('; ') : undefined,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `task_batch_delete 失败: ${msg}`,
    }
  }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

export const taskListDefinition: ToolDefinition = {
  name: 'task_list',
  description: 'List tasks. Filter by status. Associated key_result_id.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description:
          'Filter by status: draft / ready / asking / running / success / fail / canceled',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default 20, max 50)',
      },
    },
    required: [],
  },
}

export const taskBatchAddDefinition: ToolDefinition = {
  name: 'task_batch_add',
  description: 'Bulk create tasks.',
  parameters: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: 'Task list',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title' },
            key_result_id: {
              type: 'number',
              description: 'Associated key_result_id',
            },
            description: { type: 'string', description: 'Task description' },
            agent_id: { type: 'number', description: 'Assigned Agent id' },
            due_at: {
              type: 'string',
              description: 'Due date in YYYY-MM-DD format',
            },
            estimated_hours: {
              type: 'number',
              description: 'Estimated hours (e.g. 2)',
            },
          },
        },
      },
    },
    required: ['tasks'],
  },
}

export const taskBatchEditDefinition: ToolDefinition = {
  name: 'task_batch_edit',
  description: 'Bulk edit tasks.',
  parameters: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: 'Task list',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Task id' },
            title: { type: 'string', description: 'Task title' },
            key_result_id: {
              type: 'number',
              description: 'Associated key_result_id',
            },
            description: { type: 'string', description: 'Task description' },
            agent_id: { type: 'number', description: 'Assigned Agent id' },
            due_at: {
              type: 'string',
              description: 'Due date in YYYY-MM-DD format',
            },
            estimated_hours: {
              type: 'number',
              description: 'Estimated hours (e.g. 2)',
            },
          },
        },
      },
    },
    required: ['tasks'],
  },
}

export const taskBatchDeleteDefinition: ToolDefinition = {
  name: 'task_batch_delete',
  description: 'Bulk delete tasks.',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'List of task ids to delete',
      },
    },
    required: ['ids'],
  },
}

export const sharedContentGetDefinition: ToolDefinition = {
  name: 'task_shared_content_get',
  description: 'Read shared content of a task.',
  parameters: {
    type: 'object',
    properties: {
      task_id: { type: 'number', description: 'Task ID' },
    },
    required: ['task_id'],
  },
}

export const sharedContentSetDefinition: ToolDefinition = {
  name: 'task_shared_content_set',
  description: 'Atomically overwrite shared content of a task.',
  parameters: {
    type: 'object',
    properties: {
      task_id: { type: 'number', description: 'Task ID' },
      content: {
        type: 'object',
        description:
          'JSON object to write as shared content (overwrites existing)',
      },
    },
    required: ['task_id', 'content'],
  },
}

export {
  taskList,
  taskBatchAdd,
  taskBatchEdit,
  taskBatchDelete,
  sharedContentGet,
  sharedContentSet,
}
