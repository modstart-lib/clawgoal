/**
 * Project note management tools.
 *
 * Tools expose the claw_note table to agents:
 *
 *   note_list          — 查询项目笔记列表（支持按 type 过滤），只返回 id、标题
 *   note_get           — 获取单条笔记的完整内容
 *   note_search        — 根据关键词检索笔记（匹配标题和内容）
 *   note_batch_add     — 批量新增笔记
 *   note_batch_edit    — 批量编辑笔记（标题 / 类型 / 内容）
 *   note_batch_delete  — 批量删除笔记
 */

import { clawDb } from '../storage/store/index.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

// ─── note_list ────────────────────────────────────────────────────────

async function noteList(args: {
  project_id: number
  type?: string
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
    const notes = clawDb.findNotesByProjectId(Number(args.project_id), {
      type: args.type || undefined,
    })
    if (notes.length === 0) {
      return {
        success: true,
        output: args.type
          ? `项目 "${p.title}" 下没有类型为 "${args.type}" 的笔记。`
          : `项目 "${p.title}" 下还没有任何笔记。`,
      }
    }
    const cell = (v: string | null | undefined) =>
      (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
    const header = '| id | title |'
    const sep = '|---|---|'
    const rows = notes.map((n) => `| ${n.id} | ${cell(n.title)} |`)
    return {
      success: true,
      output: [
        `项目 "${p.title}" 共 ${notes.length} 条笔记：`,
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
      error: `note_list 失败: ${msg}`,
    }
  }
}

// ─── note_get ─────────────────────────────────────────────────────────

async function noteGet(args: { id: number }): Promise<ToolResult> {
  try {
    const note = clawDb.findNoteById(Number(args.id))
    if (!note) {
      return {
        success: false,
        output: '',
        error: `找不到 id=${args.id} 的笔记。`,
      }
    }
    const lines: string[] = [
      `id: ${note.id}`,
      `title: ${note.title ?? ''}`,
      `type: ${note.type ?? ''}`,
      `created_at: ${note.created_at ?? ''}`,
      ``,
      note.content ?? '',
    ]
    return { success: true, output: lines.join('\n') }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      output: '',
      error: `note_get 失败: ${msg}`,
    }
  }
}

// ─── note_batch_add ───────────────────────────────────────────────────

async function noteBatchAdd(args: {
  project_id: number
  notes: Array<{ title: string; biz?: string; type?: string; content?: string }>
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
    if (!Array.isArray(args.notes) || args.notes.length === 0) {
      return { success: false, output: '', error: 'notes 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.notes.length; i++) {
      const n = args.notes[i]
      if (!n.title?.trim()) {
        errors.push(`第 ${i + 1} 条：title 不能为空。`)
        continue
      }
      try {
        const row = clawDb.insertNote({
          projectId: Number(args.project_id),
          title: n.title.trim(),
          biz: n.biz?.trim() || undefined,
          type: n.type?.trim() || undefined,
          content: n.content !== undefined ? String(n.content) : undefined,
        })
        results.push(`  - [id:${row.id}] ${row.title}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`项目 "${p.title}" 成功新增 ${results.length} 条笔记：`)
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
      error: `note_batch_add 失败: ${msg}`,
    }
  }
}

// ─── note_batch_edit ──────────────────────────────────────────────────

async function noteBatchEdit(args: {
  notes: Array<{
    id: number
    title?: string
    biz?: string
    type?: string
    content?: string
  }>
}): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.notes) || args.notes.length === 0) {
      return { success: false, output: '', error: 'notes 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.notes.length; i++) {
      const n = args.notes[i]
      const row = clawDb.findNoteById(Number(n.id))
      if (!row) {
        errors.push(`第 ${i + 1} 条：找不到 id=${n.id} 的笔记。`)
        continue
      }
      try {
        clawDb.updateNote(Number(n.id), {
          title: n.title?.trim(),
          biz: n.biz !== undefined ? n.biz?.trim() || null : undefined,
          type: n.type !== undefined ? n.type?.trim() || null : undefined,
          content: n.content !== undefined ? n.content || null : undefined,
        })
        results.push(`  - [id:${n.id}] ${n.title ?? row.title} 更新成功`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`第 ${i + 1} 条失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功更新 ${results.length} 条笔记：`)
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
      error: `note_batch_edit 失败: ${msg}`,
    }
  }
}

// ─── note_batch_delete ────────────────────────────────────────────────

async function noteBatchDelete(args: { ids: number[] }): Promise<ToolResult> {
  try {
    if (!Array.isArray(args.ids) || args.ids.length === 0) {
      return { success: false, output: '', error: 'ids 不能为空数组。' }
    }
    const results: string[] = []
    const errors: string[] = []
    for (let i = 0; i < args.ids.length; i++) {
      const id = Number(args.ids[i])
      const row = clawDb.findNoteById(id)
      if (!row) {
        errors.push(`id=${id} 的笔记不存在。`)
        continue
      }
      try {
        clawDb.deleteNote(id)
        results.push(`  - [id:${id}] ${row.title} 已删除`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`id=${id} 删除失败：${msg}`)
      }
    }
    const lines: string[] = []
    if (results.length > 0) {
      lines.push(`成功删除 ${results.length} 条笔记：`)
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
      error: `note_batch_delete 失败: ${msg}`,
    }
  }
}

// ─── note_search ──────────────────────────────────────────────────────

async function noteSearch(args: {
  keyword: string
  project_id?: number
  limit?: number
}): Promise<ToolResult> {
  try {
    const keyword = args.keyword?.trim()
    if (!keyword) {
      return { success: false, output: '', error: 'keyword 不能为空。' }
    }
    const limit = Math.min(Math.max(Number(args.limit ?? 20), 1), 100)
    const projectId = args.project_id ? Number(args.project_id) : undefined

    // Validate project if specified
    if (projectId) {
      const p = clawDb.findProjectById(projectId)
      if (!p) {
        return {
          success: false,
          output: '',
          error: `找不到 id=${projectId} 的项目。`,
        }
      }
    }

    const notes = clawDb.searchNotes(keyword, { projectId, limit })
    if (notes.length === 0) {
      return {
        success: true,
        output: projectId
          ? `项目中未找到包含“${keyword}”的笔记。`
          : `未找到包含“${keyword}”的笔记。`,
      }
    }

    const cell = (v: string | null | undefined) =>
      (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
    const header = '| id | project_id | type | title | content | created_at |'
    const sep = '|---|---|---|---|---|---|'
    const rows = notes.map(
      (n) =>
        `| ${n.id} | ${n.project_id} | ${cell(n.type)} | ${cell(n.title)} | ${cell(n.content?.slice(0, 100))} | ${cell(n.created_at)} |`
    )
    return {
      success: true,
      output: [
        `关键词“${keyword}”匹配到 ${notes.length} 条笔记：`,
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
      error: `note_search 失败: ${msg}`,
    }
  }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

const noteItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', description: '[Required for update] Note ID' },
    title: { type: 'string', description: '[Required for create] Note title' },
    type: { type: 'string', description: 'Note type (optional)' },
    content: { type: 'string', description: 'Note full content (optional)' },
  },
}

export const noteListDefinition: ToolDefinition = {
  name: 'note_list',
  description: 'List notes for a project. Filter by type.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      type: { type: 'string', description: 'Filter notes by type (optional)' },
    },
    required: ['project_id'],
  },
}

export const noteGetDefinition: ToolDefinition = {
  name: 'note_get',
  description: 'Get note details by id.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Note ID' },
    },
    required: ['id'],
  },
}

export const noteSearchDefinition: ToolDefinition = {
  name: 'note_search',
  description: 'Search notes by keyword for a project.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      keyword: { type: 'string', description: 'Search keyword' },
    },
    required: ['project_id', 'keyword'],
  },
}

export const noteBatchAddDefinition: ToolDefinition = {
  name: 'note_batch_add',
  description: 'Batch create notes for a project.',
  parameters: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID it belongs to',
      },
      notes: {
        type: 'array',
        description: 'List of notes to create',
        items: noteItemSchema,
      },
    },
    required: ['project_id', 'notes'],
  },
}

export const noteBatchEditDefinition: ToolDefinition = {
  name: 'note_batch_edit',
  description: 'Batch edit notes.',
  parameters: {
    type: 'object',
    properties: {
      notes: {
        type: 'array',
        description: 'List of notes to edit',
        items: noteItemSchema,
      },
    },
    required: ['notes'],
  },
}

export const noteBatchDeleteDefinition: ToolDefinition = {
  name: 'note_batch_delete',
  description: 'Batch delete notes by ids.',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'List of note IDs to delete',
      },
    },
    required: ['ids'],
  },
}

export {
  noteList,
  noteGet,
  noteSearch,
  noteBatchAdd,
  noteBatchEdit,
  noteBatchDelete,
}
