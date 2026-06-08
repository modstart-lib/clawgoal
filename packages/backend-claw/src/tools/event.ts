/**
 * Event management tools.
 *
 *   event_batch_add    — 批量在项目下新增多个事件
 *   event_batch_edit   — 批量编辑多个事件（标题/描述/截止日期）
 *   event_batch_delete — 批量删除事件
 */

import { clawDb } from '../storage/store/index.js'
import type { ToolDefinition, ToolResult } from '../types/index.js'

// ─── event_batch_add ──────────────────────────────────────────────────────────

async function eventBatchAdd(args: {
  project_id: number
  events: Array<{
    title: string
    biz?: string
    description?: string
    day?: string
    type?: string
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
    if (!Array.isArray(args.events) || args.events.length === 0) {
      return { success: false, output: '', error: 'events 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.events.length; i++) {
      const e = args.events[i]
      if (!e.title?.trim()) {
        errors.push(`第 ${i + 1} 条：标题不能为空。`)
        continue
      }
      try {
        const event = clawDb.insertEvent({
          projectId: Number(args.project_id),
          title: e.title.trim(),
          biz: e.biz?.trim() || undefined,
          description: e.description,
          day: e.day,
          type: e.type,
        })
        results.push(
          `  - [id:${event.id}] **${event.title}**${e.day ? ` (${e.day})` : ''}`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条 "${e.title}" 失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功添加 ${results.length} 个事件（项目: ${p.title}）：`)
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
    return { success: false, output: '', error: `event_batch_add 失败: ${msg}` }
  }
}

// ─── event_batch_edit ─────────────────────────────────────────────────────────

async function eventBatchEdit(args: {
  events: Array<{
    id: number
    title?: string
    biz?: string
    description?: string
    day?: string | null
    type?: string | null
  }>
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.events) || args.events.length === 0) {
      return { success: false, output: '', error: 'events 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const e of args.events) {
      const m = clawDb.findEventById(Number(e.id))
      if (!m) {
        errors.push(`找不到 id=${e.id} 的事件。`)
        continue
      }
      const update: Record<string, any> = {}
      if (e.title?.trim()) update.title = e.title.trim()
      if (e.biz !== undefined) update.biz = e.biz?.trim() || null
      if (e.description?.trim()) update.description = e.description.trim()
      if (e.day?.trim()) update.day = e.day.trim()
      if (e.type != null) update.type = e.type
      try {
        clawDb.updateEvent(Number(e.id), update as any)
        results.push(`  - [id:${e.id}] 已更新`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${e.id} 更新失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功更新 ${results.length} 个事件：`)
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
      error: `event_batch_edit 失败: ${msg}`,
    }
  }
}

// ─── event_batch_delete ───────────────────────────────────────────────────────

async function eventBatchDelete(args: { ids: number[] }): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.ids) || args.ids.length === 0) {
      return { success: false, output: '', error: 'ids 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const id of args.ids) {
      const m = clawDb.findEventById(Number(id))
      if (!m) {
        errors.push(`找不到 id=${id} 的事件。`)
        continue
      }
      try {
        const deleted = clawDb.deleteEvent(Number(id))
        if (deleted) {
          results.push(`  - [id:${id}] "${m.title}" 已删除`)
        } else {
          errors.push(`id=${id} 删除失败。`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${id} 删除失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功删除 ${results.length} 个事件：`)
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
      error: `event_batch_delete 失败: ${msg}`,
    }
  }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const eventItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', description: '[edit required] event id' },
    title: { type: 'string', description: '[add required] event title' },
    description: {
      type: 'string',
      description: 'event description (optional)',
    },
    day: {
      type: 'string',
      description: 'occurrence date YYYY-MM-DD (optional)',
    },
    type: { type: 'string', description: 'event type (optional)' },
  },
}

export const eventBatchAddDefinition: ToolDefinition = {
  name: 'event_batch_add',
  description: 'Add events to a project.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      events: {
        type: 'array',
        description: 'list of events to add',
        items: eventItemSchema,
      },
    },
    required: ['project_id', 'events'],
  },
}

export const eventBatchEditDefinition: ToolDefinition = {
  name: 'event_batch_edit',
  description: 'Edit project events.',
  parameters: {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        description: 'list of events to edit',
        items: eventItemSchema,
      },
    },
    required: ['events'],
  },
}

export const eventBatchDeleteDefinition: ToolDefinition = {
  name: 'event_batch_delete',
  description: 'Delete project events by ids.',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'list of ids to delete',
      },
    },
    required: ['ids'],
  },
}

export { eventBatchAdd, eventBatchEdit, eventBatchDelete }
