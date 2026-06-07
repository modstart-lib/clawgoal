/**
 * Project backlog (requirement) management tools.
 *
 * Tools expose the claw_backlog table to agents:
 *
 *   backlog_list          — 列出项目需求池（支持按状态过滤）
 *   backlog_batch_add     — 批量在项目下新增多个需求
 *   backlog_batch_edit    — 批量编辑多个需求（标题/状态/类型/来源/截止日期）
 *   backlog_batch_delete  — 批量删除需求
 */

import { clawDb } from '../storage/store/index.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

// ─── backlog_list ─────────────────────────────────────────────────────

async function backlogList(args: {
  project_id: number
  status?: string
}): Promise<ToolResult> {
  try {
    const p = clawDb.findProjectById(Number(args.project_id))
    if (!p) {
      return {
        success: false,
        output: '',
        error: `找不到 id=${args.project_id} 的项目。`,
      }
    }
    const items = clawDb.findBacklogsByProjectId(Number(args.project_id), {
      status: args.status,
    })
    if (items.length === 0) {
      const filterStr = args.status ? `（状态: ${args.status}）` : ''
      return {
        success: true,
        output: `项目 "${p.title}" 需求池为空${filterStr}。`,
        error: undefined,
      }
    }
    const header =
      '| id | title | status | type | source | due_at | active_at | done_at |'
    const sep = '|---|---|---|---|---|---|---|---|'
    const rows = items.map(
      (t) =>
        `| ${t.id} | ${t.title} | ${t.status} | ${t.type ?? ''} | ${t.source ?? ''} | ${t.due_at ?? ''} | ${t.active_at ?? ''} | ${t.done_at ?? ''} |`
    )
    return {
      success: true,
      output: [
        `项目 "${p.title}" 需求池共 ${items.length} 条${args.status ? `（状态: ${args.status}）` : ''}：`,
        '',
        header,
        sep,
        ...rows,
      ].join('\n'),
      error: undefined,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `backlog_list 失败: ${msg}`,
    }
  }
}

// ─── backlog_batch_add ────────────────────────────────────────────────

async function backlogBatchAdd(args: {
  project_id: number
  items: Array<{
    title: string
    status?: string
    type?: string
    source?: string
    reason?: string
    detail?: string
    due_at?: string
  }>
}): Promise<ToolResult> {
  try {
    const p = clawDb.findProjectById(Number(args.project_id))
    if (!p) {
      return {
        success: false,
        output: '',
        error: `找不到 id=${args.project_id} 的项目。`,
      }
    }
    if (!Array.isArray(args.items) || args.items.length === 0) {
      return { success: false, output: '', error: 'items 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.items.length; i++) {
      const t = args.items[i]
      if (!t.title?.trim()) {
        errors.push(`第 ${i + 1} 条：标题不能为空。`)
        continue
      }
      const status =
        (t.status as 'pending' | 'active' | 'pool' | 'dropped' | 'done') ??
        'pending'
      if (status === 'dropped' && !t.reason?.trim()) {
        errors.push(`第 ${i + 1} 条：废弃时必须填写 reason。`)
        continue
      }
      try {
        const item = clawDb.insertBacklog({
          projectId: Number(args.project_id),
          title: t.title.trim(),
          status,
          type: t.type,
          source: t.source,
          reason: t.reason,
          detail: t.detail,
          dueAt: t.due_at,
        })
        results.push(
          `  - [id:${item.id}] **${item.title}**${t.due_at ? ` (截止: ${t.due_at})` : ''}`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条 "${t.title}" 失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功添加 ${results.length} 条需求（项目: ${p.title}）：`)
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
      error: `backlog_batch_add 失败: ${msg}`,
    }
  }
}

// ─── backlog_batch_edit ───────────────────────────────────────────────

async function backlogBatchEdit(args: {
  items: Array<{
    id: number
    title?: string
    status?: string
    type?: string
    source?: string
    reason?: string
    detail?: string
    due_at?: string | null
  }>
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.items) || args.items.length === 0) {
      return { success: false, output: '', error: 'items 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.items.length; i++) {
      const t = args.items[i]
      const existing = clawDb.findBacklogById(Number(t.id))
      if (!existing) {
        errors.push(`第 ${i + 1} 条：找不到 id=${t.id} 的需求。`)
        continue
      }
      if (t.status === 'dropped' && !t.reason?.trim()) {
        errors.push(`第 ${i + 1} 条：废弃时必须填写 reason。`)
        continue
      }
      try {
        const update: Record<string, unknown> = {}
        if (t.title != null) update.title = t.title
        if (t.status != null) update.status = t.status
        if ('type' in t) update.type = t.type === '' ? null : (t.type ?? null)
        if ('source' in t)
          update.source = t.source === '' ? null : (t.source ?? null)
        if ('reason' in t)
          update.reason = t.reason === '' ? null : (t.reason ?? null)
        if ('detail' in t)
          update.detail = t.detail === '' ? null : (t.detail ?? null)
        if ('due_at' in t) update.dueAt = t.due_at ?? null
        clawDb.updateBacklog(
          Number(t.id),
          update as Parameters<typeof clawDb.updateBacklog>[1]
        )
        results.push(`  - [id:${t.id}] 更新成功`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条 id=${t.id} 失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功更新 ${results.length} 条需求：`)
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
      error: `backlog_batch_edit 失败: ${msg}`,
    }
  }
}

// ─── backlog_batch_delete ─────────────────────────────────────────────

async function backlogBatchDelete(args: {
  ids: number[]
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.ids) || args.ids.length === 0) {
      return { success: false, output: '', error: 'ids 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const rawId of args.ids) {
      const id = Number(rawId)
      const deleted = clawDb.deleteBacklog(id)
      if (deleted) {
        results.push(`  - [id:${id}] 已删除`)
      } else {
        errors.push(`id=${id} 不存在`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功删除 ${results.length} 条需求：`)
      lines.push(...results)
    }
    if (errors.length > 0) {
      lines.push(`未找到 ${errors.length} 个：`)
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
      error: `backlog_batch_delete 失败: ${msg}`,
    }
  }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

const backlogItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', description: '[Required for update] Backlog ID' },
    title: {
      type: 'string',
      description: '[Required for create] Backlog title',
    },
    status: {
      type: 'string',
      description: 'Status: pending (default) / active / pool / dropped / done',
    },
    type: {
      type: 'string',
      description: 'Backlog type, e.g. "feature", "optimization" (optional)',
    },
    source: {
      type: 'string',
      description: 'Backlog source, e.g. "user feedback" (optional)',
    },
    reason: {
      type: 'string',
      description: 'Reason for dropping (required when status=dropped)',
    },
    detail: { type: 'string', description: 'Detailed content (optional)' },
    due_at: { type: 'string', description: 'Due date YYYY-MM-DD (optional)' },
  },
}

export const backlogListDefinition: ToolDefinition = {
  name: 'backlog_list',
  description: 'List backlogs for a project. Filter by status.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      status: {
        type: 'string',
        description:
          'Filter by status: pending / active / pool / dropped / done',
      },
    },
    required: ['project_id'],
  },
}

export const backlogBatchAddDefinition: ToolDefinition = {
  name: 'backlog_batch_add',
  description: 'Batch create backlogs for a project.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      items: {
        type: 'array',
        description: 'List of backlogs to add',
        items: backlogItemSchema,
      },
    },
    required: ['project_id', 'items'],
  },
}

export const backlogBatchEditDefinition: ToolDefinition = {
  name: 'backlog_batch_edit',
  description: 'Batch edit backlogs.',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'List of backlogs to edit',
        items: backlogItemSchema,
      },
    },
    required: ['items'],
  },
}

export const backlogBatchDeleteDefinition: ToolDefinition = {
  name: 'backlog_batch_delete',
  description: 'Batch delete backlogs by ids.',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'List of backlog IDs to delete',
      },
    },
    required: ['ids'],
  },
}

export { backlogList, backlogBatchAdd, backlogBatchEdit, backlogBatchDelete }
