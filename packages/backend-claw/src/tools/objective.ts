/**
 * Objective management tools.
 *
 * ⚠️  Objective（目标）是"规划层"工具，用于管理持久化的中长期战略目标、关键结果（Key Result）和近期聚焦快照。
 *     数据持久保存在数据库中，适合记录有方向性、跨多个会话追踪的目标与展开关键结果。
 *     如需记录当次会话中的临时执行步骤，请使用 todo_* 工具（执行层）。
 *
 * Objective tools:
 *   objective_list          — 列出所有战略目标（含关键结果数量概览）
 *   objective_get           — 获取指定目标的完整详情（含所有关键结果）
 *   objective_batch_add     — 批量新建战略目标
 *   objective_batch_edit    — 批量编辑目标（标题/描述/状态/图标/结果/时间等）
 *   objective_batch_delete  — 批量删除目标（含其所有 Action）
 *
 * ObjectiveKeyResult tools:
 *   objective_key_result_batch_add    — 批量新增关键结果
 *   objective_key_result_batch_edit   — 批量编辑关键结果（描述/状态/截止时间/预计耗时）
 *   objective_key_result_batch_delete — 批量删除关键结果
 *
 */

import { clawDb } from '../storage/store/index.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OBJECTIVE_STATUS_LABELS: Record<string, string> = {
  pending: '未开始',
  active: '进行中',
  paused: '已暂停',
  completed: '已完成',
  failed: '已失败',
}

const ACTION_STATUS_LABELS: Record<string, string> = {
  running: '进行中',
  done: '已完成',
  canceled: '已取消',
}

// ─── objective_list ───────────────────────────────────────────────────────────

async function objectiveList(
  args: { status?: string },
  context: ToolContext
): Promise<ToolResult> {
  try {
    let objectives = clawDb.findAllObjectives(
      context.agentContext.tenantId,
      context.agentContext.userId
    )
    if (args.status) {
      objectives = objectives.filter((o) => o.status === args.status)
    }
    if (objectives.length === 0) {
      return {
        success: true,
        output: args.status
          ? `没有状态为"${args.status}"的目标。`
          : '还没有创建任何目标。',
      }
    }
    const cell = (v: string | null | undefined) =>
      (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
    const header =
      '| id | title | status | kr进度 | start_at | end_at | description |'
    const sep = '|---|---|---|---|---|---|---|'
    const rows = objectives.map((o) => {
      const krs = clawDb.findKeyResultsByObjectiveId(o.id)
      const done = krs.filter((a) => a.status === 'done').length
      const statusLabel = OBJECTIVE_STATUS_LABELS[o.status] ?? o.status
      return `| ${o.id} | ${cell(o.title)} | ${statusLabel} | ${done}/${krs.length} | ${cell(o.start_at)} | ${cell(o.end_at)} | ${cell(o.description)} |`
    })
    return {
      success: true,
      output: [
        `共 ${objectives.length} 个目标：`,
        '',
        header,
        sep,
        ...rows,
      ].join('\n'),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `objective_list 失败: ${msg}` }
  }
}

// ─── objective_get ────────────────────────────────────────────────────────────

async function objectiveGet(args: { id: number }): Promise<ToolResult> {
  try {
    const o = clawDb.findObjectiveById(Number(args.id))
    if (!o)
      return {
        success: false,
        output: '',
        error: `目标 id=${args.id} 不存在。`,
      }
    const actions = clawDb.findKeyResultsByObjectiveId(o.id)
    const done = actions.filter((a) => a.status === 'done').length
    const statusLabel = OBJECTIVE_STATUS_LABELS[o.status] ?? o.status
    const lines: string[] = [
      `**${o.title}** [id:${o.id}]`,
      `状态: ${statusLabel}  |  关键结果: ${done}/${actions.length}`,
    ]
    if (o.description) lines.push(`描述: ${o.description}`)
    if (o.result) lines.push(`结果/复盘: ${o.result}`)
    if (o.start_at) lines.push(`开始: ${o.start_at}`)
    if (o.end_at) lines.push(`截止: ${o.end_at}`)
    lines.push(`创建时间: ${o.created_at}`)
    if (actions.length === 0) {
      lines.push('\n关键结果（Key Result）: （暂无）')
    } else {
      lines.push(`\n关键结果（共 ${actions.length} 个）:`)
      lines.push('| id | title | status |')
      lines.push('|---|---|---|')
      for (const a of actions) {
        const statusLabel = ACTION_STATUS_LABELS[a.status] ?? a.status
        lines.push(
          `| ${a.id} | ${a.title.replace(/\|/g, '\\|')} | ${statusLabel} |`
        )
      }
    }
    return { success: true, output: lines.join('\n') }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `objective_get 失败: ${msg}` }
  }
}

// ─── objective_batch_add ──────────────────────────────────────────────────────

async function objectiveBatchAdd(
  args: {
    objectives: Array<{
      title: string
      description?: string
      status?: string
      icon?: string
      start_at?: string
      end_at?: string
      due_at?: string
    }>
  },
  context: ToolContext
): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.objectives) || args.objectives.length === 0) {
      return { success: false, output: '', error: 'objectives 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.objectives.length; i++) {
      const obj = args.objectives[i]
      if (!obj.title?.trim()) {
        errors.push(`第 ${i + 1} 条：目标标题不能为空。`)
        continue
      }
      try {
        const row = clawDb.insertObjective({
          tenantId: context.agentContext.tenantId,
          userId: context.agentContext.userId,
          title: obj.title.trim(),
          description: obj.description || undefined,
          status: (obj.status as any) || 'active',
          icon: (obj.icon as any) || 'target',
          startAt: obj.start_at || undefined,
          endAt: obj.end_at || undefined,
          dueAt: obj.due_at || undefined,
        })
        results.push(
          `  - [id:${row.id}] **${row.title}**（状态: ${row.status}）`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条 "${obj.title}" 失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功创建 ${results.length} 个目标：`)
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
      error: `objective_batch_add 失败: ${msg}`,
    }
  }
}

// ─── objective_batch_edit ─────────────────────────────────────────────────────

async function objectiveBatchEdit(args: {
  objectives: Array<{
    id: number
    title?: string
    description?: string
    status?: string
    icon?: string
    result?: string
    start_at?: string
    end_at?: string
    due_at?: string | null
  }>
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.objectives) || args.objectives.length === 0) {
      return { success: false, output: '', error: 'objectives 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const obj of args.objectives) {
      const o = clawDb.findObjectiveById(Number(obj.id))
      if (!o) {
        errors.push(`找不到 id=${obj.id} 的目标。`)
        continue
      }
      const update: Record<string, any> = {}
      if (obj.title?.trim()) update.title = obj.title.trim()
      if (obj.description?.trim()) update.description = obj.description.trim()
      if (obj.status?.trim()) update.status = obj.status.trim()
      if (obj.icon?.trim()) update.icon = obj.icon.trim()
      if (obj.result?.trim()) update.result = obj.result.trim()
      if (obj.start_at?.trim()) update.startAt = obj.start_at.trim()
      if (obj.end_at?.trim()) update.endAt = obj.end_at.trim()
      if (obj.due_at !== undefined) update.dueAt = obj.due_at ?? null
      try {
        clawDb.updateObjective(Number(obj.id), update as any)
        results.push(`  - [id:${obj.id}] 已更新`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${obj.id} 更新失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功更新 ${results.length} 个目标：`)
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
      error: `objective_batch_edit 失败: ${msg}`,
    }
  }
}

// ─── objective_batch_delete ───────────────────────────────────────────────────

async function objectiveBatchDelete(args: {
  ids: number[]
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.ids) || args.ids.length === 0) {
      return { success: false, output: '', error: 'ids 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const id of args.ids) {
      const o = clawDb.findObjectiveById(Number(id))
      if (!o) {
        errors.push(`找不到 id=${id} 的目标。`)
        continue
      }
      try {
        clawDb.deleteObjective(Number(id))
        results.push(`  - [id:${id}] "${o.title}" 已删除`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${id} 删除失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功删除 ${results.length} 个目标：`)
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
      error: `objective_batch_delete 失败: ${msg}`,
    }
  }
}

// ─── objective_key_result_batch_add ───────────────────────────────────────────────

async function objectiveKeyResultBatchAdd(
  args: {
    items: Array<{
      objective_id: number
      title: string
      detail?: string
      status?: string
      due_at?: string
      estimated_hours?: number
    }>
  },
  context: ToolContext
): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.items) || args.items.length === 0) {
      return { success: false, output: '', error: 'items 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i]
      if (!item.title?.trim()) {
        errors.push(`第 ${i + 1} 条：关键结果标题不能为空。`)
        continue
      }
      const o = clawDb.findObjectiveById(Number(item.objective_id))
      if (!o) {
        errors.push(`第 ${i + 1} 条：目标 id=${item.objective_id} 不存在。`)
        continue
      }
      try {
        const row = clawDb.insertKeyResult({
          tenantId: context.agentContext.tenantId,
          userId: context.agentContext.userId,
          objectiveId: Number(item.objective_id),
          title: item.title.trim(),
          detail: item.detail?.trim() || '',
          status: (item.status as any) || 'running',
          dueAt: item.due_at || undefined,
          estimatedHours: item.estimated_hours ?? undefined,
        })
        results.push(`  - [id:${row.id}] ${row.title}（目标: ${o.title}）`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条 "${item.title}" 失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功添加 ${results.length} 个关键结果：`)
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
      error: `objective_key_result_batch_add 失败: ${msg}`,
    }
  }
}

// ─── objective_key_result_batch_edit ──────────────────────────────────────────────

async function objectiveKeyResultBatchEdit(args: {
  items: Array<{
    id: number
    title?: string
    detail?: string
    status?: string
    due_at?: string | null
    estimated_hours?: number | null
  }>
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.items) || args.items.length === 0) {
      return { success: false, output: '', error: 'items 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const item of args.items) {
      const a = clawDb.findKeyResultById(Number(item.id))
      if (!a) {
        errors.push(`找不到 id=${item.id} 的关键结果。`)
        continue
      }
      const update: Record<string, any> = {}
      if (item.title?.trim()) update.title = item.title.trim()
      if (item.detail?.trim()) update.detail = item.detail.trim()
      if (item.status?.trim()) update.status = item.status.trim()
      if (item.due_at !== undefined) update.dueAt = item.due_at ?? null
      if (item.estimated_hours !== undefined)
        update.estimatedHours = item.estimated_hours ?? null
      try {
        clawDb.updateKeyResult(Number(item.id), update as any)
        results.push(`  - [id:${item.id}] 已更新`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${item.id} 更新失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功更新 ${results.length} 个关键结果：`)
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
      error: `objective_key_result_batch_edit 失败: ${msg}`,
    }
  }
}

// ─── objective_key_result_batch_delete ────────────────────────────────────────────

async function objectiveKeyResultBatchDelete(args: {
  ids: number[]
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.ids) || args.ids.length === 0) {
      return { success: false, output: '', error: 'ids 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const id of args.ids) {
      const a = clawDb.findKeyResultById(Number(id))
      if (!a) {
        errors.push(`找不到 id=${id} 的关键结果。`)
        continue
      }
      try {
        clawDb.deleteKeyResult(Number(id))
        results.push(`  - [id:${id}] 已删除`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${id} 删除失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功删除 ${results.length} 个关键结果：`)
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
      error: `objective_key_result_batch_delete 失败: ${msg}`,
    }
  }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

const objectiveItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', description: '[update required] objective id' },
    title: { type: 'string', description: '[create required] objective title' },
    description: { type: 'string', description: 'Objective description' },
    status: {
      type: 'string',
      description: 'Status: active (default) / completed / failed',
    },
    icon: { type: 'string', description: 'Icon: target / rocket / flame' },
    result: {
      type: 'string',
      description: 'Result summary (filled upon completion)',
    },
    start_at: { type: 'string', description: 'Start date YYYY-MM-DD' },
    end_at: { type: 'string', description: 'End date YYYY-MM-DD' },
    due_at: {
      type: 'string',
      description: 'Due date YYYY-MM-DD; pass null to clear',
    },
  },
}

const keyResultItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', description: '[action_edit required] key result id' },
    objective_id: {
      type: 'number',
      description: '[action_add required] associated objective id',
    },
    title: {
      type: 'string',
      description: '[action_add required] key result title',
    },
    detail: { type: 'string', description: 'KeyResult details' },
    status: {
      type: 'string',
      description: 'Status: running (default) / done / canceled',
    },
    due_at: {
      type: 'string',
      description: 'Due date YYYY-MM-DD; pass null to clear',
    },
    estimated_hours: {
      type: 'number',
      description: 'Estimated hours (pass null to clear)',
    },
  },
}

export const objectiveListDefinition: ToolDefinition = {
  name: 'objective_list',
  description: 'List objectives. Filter by status.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'status filter: active/completed/failed',
      },
    },
    required: [],
  },
}

export const objectiveGetDefinition: ToolDefinition = {
  name: 'objective_get',
  description: 'Get objective details by id.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'objective id' },
    },
    required: ['id'],
  },
}

export const objectiveBatchAddDefinition: ToolDefinition = {
  name: 'objective_batch_add',
  description: 'Create one or more objectives.',
  parameters: {
    type: 'object',
    properties: {
      objectives: {
        type: 'array',
        description: 'list of objectives to create',
        items: objectiveItemSchema,
      },
    },
    required: ['objectives'],
  },
}

export const objectiveBatchEditDefinition: ToolDefinition = {
  name: 'objective_batch_edit',
  description: 'Edit one or more objectives.',
  parameters: {
    type: 'object',
    properties: {
      objectives: {
        type: 'array',
        description: 'list of objectives to edit',
        items: objectiveItemSchema,
      },
    },
    required: ['objectives'],
  },
}

export const objectiveBatchDeleteDefinition: ToolDefinition = {
  name: 'objective_batch_delete',
  description: 'Delete objectives by ids.',
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

export const objectiveKeyResultBatchAddDefinition: ToolDefinition = {
  name: 'objective_key_result_batch_add',
  description: 'Add key results to an objective.',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'list of key results to create',
        items: keyResultItemSchema,
      },
    },
    required: ['items'],
  },
}

export const objectiveKeyResultBatchEditDefinition: ToolDefinition = {
  name: 'objective_key_result_batch_edit',
  description: 'Edit one or more key results.',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'list of key results to edit',
        items: keyResultItemSchema,
      },
    },
    required: ['items'],
  },
}

export const objectiveKeyResultBatchDeleteDefinition: ToolDefinition = {
  name: 'objective_key_result_batch_delete',
  description: 'Delete key results by ids.',
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

export {
  objectiveList,
  objectiveGet,
  objectiveBatchAdd,
  objectiveBatchEdit,
  objectiveBatchDelete,
  objectiveKeyResultBatchAdd,
  objectiveKeyResultBatchEdit,
  objectiveKeyResultBatchDelete,
}
