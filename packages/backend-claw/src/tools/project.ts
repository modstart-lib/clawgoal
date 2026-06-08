/**
 * Project management tools.
 *
 *   project_list         — 列出所有项目（含全部字段及事件列表）
 *   project_batch_add    — 批量新建多个项目
 *   project_batch_edit   — 批量编辑多个项目（标题/描述/状态/颜色/日期）
 *   project_batch_delete — 批量删除项目（含其所有事件）
 *
 * 事件操作请使用 event 工具。
 * 需求（backlog）操作请使用 backlog 工具。
 * 指标（metric）操作请使用 metric 工具。
 */

import { getEmbeddingProvider } from '../../../backend/src/model/embedding/sqliteVecProvider.js'
import { clawDb } from '../storage/store/index.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
]

function randomProjectColor(): string {
  return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
}

const DEFAULT_PROJECT_METRIC = [
  { name: 'pv', title: 'PV', sort: 10 },
  { name: 'uv', title: 'UV', sort: 15 },
  { name: 'income', title: 'income收入', sort: 20 },
  { name: 'refund', title: 'refund退款', sort: 30 },
  { name: 'userCount', title: 'userCount用户数', sort: 40 },
  { name: 'dau', title: 'dau日活', sort: 50 },
]

const STATUS_LABELS: Record<string, string> = {
  planning: '规划中',
  active: '进行中',
  paused: '已暂停',
  done: '已完成',
}

// ─── project_list ─────────────────────────────────────────────────────────────

async function projectList(
  args: { status?: string },
  context: ToolContext
): Promise<ToolResult> {
  const { userId } = context.agentContext
  try {
    let projects = clawDb.findAllProjects(context.agentContext.tenantId, userId)
    if (args.status) {
      projects = projects.filter((p) => p.status === args.status)
    }
    if (projects.length === 0) {
      return {
        success: true,
        output: args.status
          ? `没有状态为"${args.status}"的项目。`
          : '还没有创建任何项目。',
      }
    }

    const cell = (v: string | null | undefined) =>
      (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'

    const projectHeader =
      '| id | title | status | description | color | start_at | due_at | created_at | events |'
    const projectSep = '|---|---|---|---|---|---|---|---|---|'
    const projectRows = projects.map((p) => {
      const events = clawDb.findEventsByProjectId(p.id)
      const statusLabel = STATUS_LABELS[p.status] ?? p.status
      return `| ${p.id} | ${cell(p.title)} | ${statusLabel} | ${cell(p.description)} | ${cell(p.color)} | ${cell(p.start_at)} | ${cell(p.due_at)} | ${cell(p.created_at)} | ${events.length} |`
    })

    const lines: string[] = [
      `共找到 ${projects.length} 个项目：`,
      '',
      projectHeader,
      projectSep,
      ...projectRows,
    ]

    for (const p of projects) {
      const events = clawDb.findEventsByProjectId(p.id)
      if (events.length === 0) continue
      lines.push('')
      lines.push(`**${p.title}** [id:${p.id}] 事件列表：`)
      lines.push('| id | title | day | description |')
      lines.push('|---|---|---|---|')
      for (const e of events) {
        lines.push(
          `| ${e.id} | ${cell(e.title)} | ${cell(e.day)} | ${cell(e.description)} |`
        )
      }
    }

    return { success: true, output: lines.join('\n') }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `project_list 失败: ${msg}` }
  }
}

// ─── project_batch_add ────────────────────────────────────────────────────────

async function projectBatchAdd(
  args: {
    projects: Array<{
      title: string
      description?: string
      status?: string
      color?: string
      start_at?: string
      due_at?: string
    }>
  },
  context: ToolContext
): Promise<ToolResult> {
  const { userId } = context.agentContext
  try {
    if (!Array.isArray(args.projects) || args.projects.length === 0) {
      return { success: false, output: '', error: 'projects 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.projects.length; i++) {
      const proj = args.projects[i]
      if (!proj.title?.trim()) {
        errors.push(`第 ${i + 1} 条：项目标题不能为空。`)
        continue
      }
      try {
        const row = clawDb.insertProject({
          tenantId: context.agentContext.tenantId,
          userId,
          title: proj.title.trim(),
          description: proj.description,
          status: (proj.status as any) ?? 'planning',
          color: proj.color?.trim() || randomProjectColor(),
          startAt: proj.start_at,
          dueAt: proj.due_at,
        })
        for (const metric of DEFAULT_PROJECT_METRIC) {
          clawDb.insertMetric({
            projectId: row.id,
            name: metric.name,
            title: metric.title,
            sort: metric.sort,
          })
        }
        results.push(
          `  - [id:${row.id}] **${row.title}**（状态: ${STATUS_LABELS[row.status] ?? row.status}）`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条 "${proj.title}" 失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功创建 ${results.length} 个项目：`)
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
      error: `project_batch_add 失败: ${msg}`,
    }
  }
}

// ─── project_batch_edit ───────────────────────────────────────────────────────

async function projectBatchEdit(args: {
  projects: Array<{
    id: number
    title?: string
    description?: string
    status?: string
    color?: string
    start_at?: string | null
    due_at?: string | null
  }>
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.projects) || args.projects.length === 0) {
      return { success: false, output: '', error: 'projects 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const proj of args.projects) {
      const p = clawDb.findProjectById(Number(proj.id))
      if (!p) {
        errors.push(`找不到 id=${proj.id} 的项目。`)
        continue
      }
      const update: Record<string, any> = {}
      if (proj.title?.trim()) update.title = proj.title.trim()
      if (proj.description?.trim()) update.description = proj.description.trim()
      if (proj.status?.trim()) update.status = proj.status.trim()
      if (proj.color?.trim()) update.color = proj.color.trim()
      if (proj.start_at?.trim()) update.startAt = proj.start_at.trim()
      if (proj.due_at?.trim()) update.dueAt = proj.due_at.trim()
      try {
        clawDb.updateProject(Number(proj.id), update as any)
        results.push(`  - [id:${proj.id}] 已更新`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${proj.id} 更新失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功更新 ${results.length} 个项目：`)
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
      error: `project_batch_edit 失败: ${msg}`,
    }
  }
}

// ─── project_batch_delete ─────────────────────────────────────────────────────

async function projectBatchDelete(args: {
  ids: number[]
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.ids) || args.ids.length === 0) {
      return { success: false, output: '', error: 'ids 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (const id of args.ids) {
      const p = clawDb.findProjectById(Number(id))
      if (!p) {
        errors.push(`找不到 id=${id} 的项目。`)
        continue
      }
      try {
        clawDb.deleteEventsByProjectId(Number(id))
        const deleted = clawDb.deleteProject(Number(id))
        if (deleted) {
          getEmbeddingProvider()
            .deleteAll('Wiki', String(id))
            .catch(() => {})
          results.push(`  - [id:${id}] "${p.title}" 已删除`)
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
      lines.push(`成功删除 ${results.length} 个项目：`)
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
      error: `project_batch_delete 失败: ${msg}`,
    }
  }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const projectItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', description: '[update required] project id' },
    title: { type: 'string', description: '[create required] project title' },
    description: { type: 'string', description: 'project description' },
    status: {
      type: 'string',
      description: 'status: planning (default) / active / paused / done',
    },
    color: { type: 'string', description: 'identifying color, e.g. #6366f1' },
    start_at: { type: 'string', description: 'start date YYYY-MM-DD' },
    due_at: {
      type: 'string',
      description: 'due date YYYY-MM-DD, pass null to clear',
    },
  },
}

export const projectListDefinition: ToolDefinition = {
  name: 'project_list',
  description: 'List projects. Filter by status.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'status filter: planning / active / paused / done',
      },
    },
    required: [],
  },
}

export const projectBatchAddDefinition: ToolDefinition = {
  name: 'project_batch_add',
  description: 'Batch create projects.',
  parameters: {
    type: 'object',
    properties: {
      projects: {
        type: 'array',
        description: 'list of projects to create',
        items: projectItemSchema,
      },
    },
    required: ['projects'],
  },
}

export const projectBatchEditDefinition: ToolDefinition = {
  name: 'project_batch_edit',
  description: 'Batch edit projects.',
  parameters: {
    type: 'object',
    properties: {
      projects: {
        type: 'array',
        description: 'list of projects to edit',
        items: projectItemSchema,
      },
    },
    required: ['projects'],
  },
}

export const projectBatchDeleteDefinition: ToolDefinition = {
  name: 'project_batch_delete',
  description: 'Batch delete projects by ids.',
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

export { projectList, projectBatchAdd, projectBatchEdit, projectBatchDelete }
