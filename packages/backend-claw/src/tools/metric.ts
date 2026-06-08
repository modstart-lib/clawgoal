/**
 * Project metric management tools.
 *
 * Tools expose the claw_metric / claw_metric_item tables to agents:
 *
 *   metric_list              — 列出项目指标定义
 *   metric_batch_add         — 批量新增指标定义
 *   metric_batch_edit        — 批量编辑指标定义（标题/排序/备注）
 *   metric_batch_delete      — 批量删除指标定义
 *   metric_item_list         — 查询指标数据（支持按名称/日期范围过滤）
 *   metric_item_batch_add    — 批量录入指标数据（upsert）
 *   metric_item_batch_delete — 批量删除指标数据
 */

import { clawDb } from '../storage/store/index.js'
import type { ToolDefinition, ToolResult } from '../types/index.js'

// ─── metric_list ─────────────────────────────────────────────────────

async function metricList(args: { project_id: number }): Promise<ToolResult> {
  try {
    const p = clawDb.findProjectById(Number(args.project_id))
    if (!p) {
      return {
        success: false,
        output: '',
        error: `找不到 id=${args.project_id} 的项目。`,
      }
    }
    const list = clawDb.findMetricByProjectId(Number(args.project_id))
    if (list.length === 0) {
      return { success: true, output: `项目 "${p.title}" 尚未定义任何指标。` }
    }
    const cell = (v: string | null | undefined) =>
      (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
    const header = '| id | name | title | sort | remark |'
    const sep = '|---|---|---|---|---|'
    const rows = list.map(
      (m) =>
        `| ${m.id} | ${cell(m.name)} | ${cell(m.title)} | ${m.sort ?? '-'} | ${cell(m.remark)} |`
    )
    return {
      success: true,
      output: [
        `项目 "${p.title}" 共有 ${list.length} 个指标定义：`,
        '',
        header,
        sep,
        ...rows,
      ].join('\n'),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `metric_list 失败: ${msg}`,
    }
  }
}

// ─── metric_batch_add ────────────────────────────────────────────────

async function metricBatchAdd(args: {
  project_id: number
  items: Array<{
    name: string
    title: string
    sort?: number
    remark?: string
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
      const m = args.items[i]
      if (!m.name?.trim()) {
        errors.push(`第 ${i + 1} 条：name 不能为空。`)
        continue
      }
      if (!m.title?.trim()) {
        errors.push(`第 ${i + 1} 条：title 不能为空。`)
        continue
      }
      try {
        const row = clawDb.insertMetric({
          projectId: Number(args.project_id),
          name: m.name.trim(),
          title: m.title.trim(),
          sort: m.sort,
          remark: m.remark?.trim() || undefined,
        })
        results.push(`  - [id:${row.id}] **${row.title}** (name: ${row.name})`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条 "${m.name}" 失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功创建 ${results.length} 个指标定义（项目: ${p.title}）：`)
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
      error: `metric_batch_add 失败: ${msg}`,
    }
  }
}

// ─── metric_batch_edit ───────────────────────────────────────────────

async function metricBatchEdit(args: {
  items: Array<{
    id: number
    title?: string
    sort?: number
    remark?: string
  }>
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.items) || args.items.length === 0) {
      return { success: false, output: '', error: 'items 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const m of args.items) {
      const existing = clawDb.findMetricById(Number(m.id))
      if (!existing) {
        errors.push(`找不到 id=${m.id} 的指标定义。`)
        continue
      }
      const update: Record<string, any> = {}
      if (m.title?.trim()) update.title = m.title.trim()
      if (m.sort !== undefined) update.sort = m.sort
      if ('remark' in m) update.remark = m.remark?.trim() || null
      try {
        clawDb.updateMetric(Number(m.id), update as any)
        results.push(`  - [id:${m.id}] 已更新`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${m.id} 更新失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功更新 ${results.length} 个指标定义：`)
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
      error: `metric_batch_edit 失败: ${msg}`,
    }
  }
}

// ─── metric_batch_delete ─────────────────────────────────────────────

async function metricBatchDelete(args: { ids: number[] }): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.ids) || args.ids.length === 0) {
      return { success: false, output: '', error: 'ids 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const id of args.ids) {
      const m = clawDb.findMetricById(Number(id))
      if (!m) {
        errors.push(`找不到 id=${id} 的指标定义。`)
        continue
      }
      try {
        const deleted = clawDb.deleteMetric(Number(id))
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
      lines.push(`成功删除 ${results.length} 个指标定义：`)
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
      error: `metric_batch_delete 失败: ${msg}`,
    }
  }
}

// ─── metric_item_list ────────────────────────────────────────────────

async function metricItemList(args: {
  project_id: number
  name?: string
  start_day?: string
  end_day?: string
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
    const items = clawDb.findMetricItems(Number(args.project_id), {
      name: args.name,
      startDay: args.start_day,
      endDay: args.end_day,
    })
    if (items.length === 0) {
      return {
        success: true,
        output: `项目 "${p.title}" 在指定条件下没有指标数据。`,
      }
    }
    const header = '| day | name | value |'
    const sep = '|---|---|---|'
    const rows = items.map((i) => `| ${i.day} | ${i.name} | ${i.value} |`)
    return {
      success: true,
      output: [
        `项目 "${p.title}" 共找到 ${items.length} 条指标数据：`,
        '',
        header,
        sep,
        ...rows,
      ].join('\n'),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `metric_item_list 失败: ${msg}`,
    }
  }
}

// ─── metric_item_batch_add ──────────────────────────────────────────

async function metricItemBatchAdd(args: {
  project_id: number
  items: Array<{ day: string; name: string; value: number }>
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
      const item = args.items[i]
      if (!item.day?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        errors.push(`第 ${i + 1} 条：日期格式不正确，请使用 YYYY-MM-DD。`)
        continue
      }
      if (!item.name?.trim()) {
        errors.push(`第 ${i + 1} 条：name 不能为空。`)
        continue
      }
      try {
        const row = clawDb.upsertMetricItem({
          projectId: Number(args.project_id),
          day: item.day,
          name: item.name.trim(),
          value: Number(item.value),
        })
        results.push(`  - ${row.day} | ${row.name} = ${row.value}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条 (${item.day}/${item.name}) 失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功录入 ${results.length} 条指标数据（项目: ${p.title}）：`)
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
      error: `metric_item_batch_add 失败: ${msg}`,
    }
  }
}

// ─── metric_item_batch_delete ───────────────────────────────────────

async function metricItemBatchDelete(args: {
  items: Array<{ project_id: number; day?: string; name?: string }>
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.items) || args.items.length === 0) {
      return { success: false, output: '', error: 'items 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i]
      const p = clawDb.findProjectById(Number(item.project_id))
      if (!p) {
        errors.push(`第 ${i + 1} 条：找不到 id=${item.project_id} 的项目。`)
        continue
      }
      try {
        clawDb.deleteMetricItems({
          projectId: Number(item.project_id),
          day: item.day,
          name: item.name,
        })
        const desc = [
          item.day ? `日期: ${item.day}` : null,
          item.name ? `指标: ${item.name}` : null,
        ]
          .filter(Boolean)
          .join(', ')
        results.push(
          `  - 项目 "${p.title}" 指标数据已删除${desc ? `（${desc}）` : '（全部）'}`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功删除 ${results.length} 批指标数据：`)
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
      error: `metric_item_batch_delete 失败: ${msg}`,
    }
  }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

const metricDefSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'number',
      description: '[Required for update] Metric definition ID',
    },
    name: {
      type: 'string',
      description:
        '[Required for create] Metric name identifier, unique within project, e.g. income',
    },
    title: {
      type: 'string',
      description: '[Required for create] Metric display title, e.g. Revenue',
    },
    sort: {
      type: 'number',
      description: 'Sort order, smaller is higher (default 0)',
    },
    remark: {
      type: 'string',
      description: 'Remarks, e.g. calculation method (optional)',
    },
  },
}

const metricItemSchema = {
  type: 'object',
  properties: {
    day: {
      type: 'string',
      description:
        '[Required for item_add] Date YYYY-MM-DD; [item_delete] Filter by date (optional)',
    },
    name: {
      type: 'string',
      description:
        '[Required for item_add] Metric name identifier; [item_delete] Filter by metric name (optional)',
    },
    value: {
      type: 'number',
      description: '[Required for item_add] Metric value',
    },
    project_id: {
      type: 'number',
      description: '[Required for item_delete] Project ID',
    },
  },
}

export const metricListDefinition: ToolDefinition = {
  name: 'metric_list',
  description: 'List metric definitions for a project.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
    },
    required: ['project_id'],
  },
}

export const metricBatchAddDefinition: ToolDefinition = {
  name: 'metric_batch_add',
  description: 'Batch add metric definitions for a project.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      items: {
        type: 'array',
        description: 'List of metric definitions to create',
        items: metricDefSchema,
      },
    },
    required: ['project_id', 'items'],
  },
}

export const metricBatchEditDefinition: ToolDefinition = {
  name: 'metric_batch_edit',
  description: 'Batch edit metric definitions.',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'List of metric definitions to edit',
        items: metricDefSchema,
      },
    },
    required: ['items'],
  },
}

export const metricBatchDeleteDefinition: ToolDefinition = {
  name: 'metric_batch_delete',
  description: 'Batch delete metric definitions by ids.',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'List of metric definition IDs to delete',
      },
    },
    required: ['ids'],
  },
}

export const metricItemListDefinition: ToolDefinition = {
  name: 'metric_item_list',
  description: 'Search metric data for a project.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      name: {
        type: 'string',
        description: 'Filter by metric name identifier, e.g. income (optional)',
      },
      start_day: {
        type: 'string',
        description: 'Start date (inclusive) YYYY-MM-DD (optional)',
      },
      end_day: {
        type: 'string',
        description: 'End date (inclusive) YYYY-MM-DD (optional)',
      },
    },
    required: ['project_id'],
  },
}

export const metricItemBatchAddDefinition: ToolDefinition = {
  name: 'metric_item_batch_add',
  description: 'Batch insert/update metric data.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      items: {
        type: 'array',
        description: 'List of metric data',
        items: metricItemSchema,
      },
    },
    required: ['project_id', 'items'],
  },
}

export const metricItemBatchDeleteDefinition: ToolDefinition = {
  name: 'metric_item_batch_delete',
  description: 'Batch delete metric data by criteria.',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Criteria to delete metric data',
        items: metricItemSchema,
      },
    },
    required: ['items'],
  },
}

export {
  metricList,
  metricBatchAdd,
  metricBatchEdit,
  metricBatchDelete,
  metricItemList,
  metricItemBatchAdd,
  metricItemBatchDelete,
}
