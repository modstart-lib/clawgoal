/**
 * Cron task management tools.
 *
 * Five tools expose the cron scheduler to agents:
 *
 *   cron_list    — list all cron tasks with their schedule and status
 *   cron_get     — get full details of a specific task
 *   cron_batch_add    — create a new scheduled task
 *   cron_batch_delete — delete a scheduled task
 *   cron_batch_edit   — pause or resume a task
 *   cron_run          — trigger a task to run immediately
 */

import { config } from '../../../backend/src/config/index.js'
import { agentManager } from '../agent/index.js'
import { cronManager, type CronConfig } from '../cron/index.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

/** Convert a UTC ISO string to a local time string (YYYY-MM-DD HH:mm) based on config.timezone. */
function utcToLocal(utcIso: string | null | undefined): string {
  if (!utcIso) return 'not scheduled'
  const utcMs = new Date(utcIso).getTime()
  const localMs = utcMs + config.timezone * 60 * 60 * 1000
  const d = new Date(localMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` +
    ` (UTC${config.timezone >= 0 ? '+' : ''}${config.timezone})`
  )
}

// ─── cron_list ────────────────────────────────────────────────────────────────

async function cronList(
  args: { enabled_only?: string },
  context: ToolContext
): Promise<ToolResult> {
  const { userId } = context.agentContext
  const tasks = cronManager.listTasks(context.agentContext.tenantId, userId)
  const filter = args.enabled_only
  const filtered =
    filter === 'true'
      ? tasks.filter((t) => t.enable)
      : filter === 'false'
        ? tasks.filter((t) => !t.enable)
        : tasks

  if (filtered.length === 0) {
    return {
      success: true,
      output:
        filter === 'true'
          ? 'No enabled cron tasks.'
          : filter === 'false'
            ? 'No disabled cron tasks.'
            : 'No cron tasks configured yet. Use cron_batch_add to add one.',
    }
  }

  const cell = (v: string | null | undefined) =>
    (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
  const header =
    '| id | title | cron | enabled | agent_id | last_run | next_run |'
  const sep = '|---|---|---|---|---|---|---|'
  const rows = filtered.map((t) => {
    const status = t.enable ? '✅' : '⏸️'
    const lastRun = t.lastRunAt ? utcToLocal(t.lastRunAt) : '-'
    const nextRun = t.nextRunAt ? utcToLocal(t.nextRunAt) : '-'
    return `| ${t.id} | ${cell(t.title)} | \`${t.cron}\` | ${status} | ${t.agentId} | ${lastRun} | ${nextRun} |`
  })

  return {
    success: true,
    output: [`Cron tasks (${filtered.length}):`, '', header, sep, ...rows].join(
      '\n'
    ),
  }
}

// ─── cron_get ─────────────────────────────────────────────────────────────────

async function cronGet(args: { id: string }): Promise<ToolResult> {
  const task = cronManager.getTask(Number(args.id))
  if (!task) {
    return {
      success: false,
      output: '',
      error: `Cron task "${args.id}" not found. Use cron_list to see available tasks.`,
    }
  }
  const detail = [
    `id: ${task.id}`,
    `title: ${task.title}`,
    `description: ${task.description ?? '(none)'}`,
    `cron: ${task.cron}`,
    `agentId: ${task.agentId}`,
    `enable: ${task.enable}`,
    `runOnce: ${task.runOnce}`,
    `shouldRun: ${task.shouldRun}`,
    `nextRunAt: ${task.nextRunAt ?? 'not scheduled'} (local: ${utcToLocal(task.nextRunAt)})`,
    `lastRunAt: ${task.lastRunAt ? `${task.lastRunAt} (local: ${utcToLocal(task.lastRunAt)})` : 'never'}`,
    `currentLocalTime: ${utcToLocal(new Date().toISOString())}`,
    `timezone: UTC${config.timezone >= 0 ? '+' : ''}${config.timezone}`,
    `cronExpression help: cron fields = min(0-59) hour(0-23) dom(1-31) month(1-12) dow(0-6,Sun=0)`,
    `createdAt: ${task.createdAt}`,
    `prompt:\n${task.prompt}`,
  ].join('\n')
  return { success: true, output: detail }
}

// ─── cron_batch_add ──────────────────────────────────────────────────────────

async function cronBatchAdd(
  args: {
    name: string
    description?: string
    schedule: string
    agent_id: string
    shell_command?: string
    workdir?: string
    prompt?: string
    run_once?: string
  },
  context: ToolContext
): Promise<ToolResult> {
  const { userId } = context.agentContext
  const isShellMode = !!args.shell_command

  // Validate agent_id (required for all modes)
  if (!args.agent_id) {
    return {
      success: false,
      output: '',
      error:
        'agent_id is required. Use cron_list or agent_list to get available agent IDs.',
    }
  }
  const agentId = parseInt(args.agent_id, 10)
  if (isNaN(agentId)) {
    return {
      success: false,
      output: '',
      error: `agent_id must be a numeric agent ID, got "${args.agent_id}".`,
    }
  }
  const agent = agentManager.get(agentId)
  if (!agent) {
    const agents = agentManager.listAll()
    const ids = agents.map((m) => `${m.id} (${m.title})`).join(', ')
    return {
      success: false,
      output: '',
      error: `Agent ${agentId} not found. Available agent IDs: ${ids || '(none)'}`,
    }
  }

  // For agent mode, prompt is required
  if (!isShellMode && !args.prompt) {
    return {
      success: false,
      output: '',
      error:
        'For agent mode, prompt is required. To run a shell command, provide shell_command instead.',
    }
  }

  // Validate schedule has 5 parts
  const parts = args.schedule.trim().split(/\s+/)
  if (parts.length !== 5) {
    return {
      success: false,
      output: '',
      error: `Invalid cron schedule "${args.schedule}": must have exactly 5 parts (min hour dom month dow).`,
    }
  }

  const config: CronConfig = isShellMode
    ? {
        type: 'shell',
        shell: args.shell_command!,
        workdir: args.workdir ?? undefined,
      }
    : { type: 'agent', agent: args.prompt! }

  const task = await cronManager.addTask(
    context.agentContext.tenantId,
    userId,
    {
      title: args.name,
      description: args.description ?? null,
      cron: args.schedule,
      agentId: agentId!,
      prompt: args.prompt ?? '',
      config,
      runOnce: args.run_once === 'true',
      enable: true,
    }
  )

  const modeTag = isShellMode
    ? `  type: shell\n  shell_command: ${args.shell_command!}\n` +
      (args.workdir ? `  workdir: ${args.workdir}\n` : '')
    : `  type: agent\n  agent: ${args.agent_id}\n`

  return {
    success: true,
    output:
      `✅ Cron task created:\n` +
      `  id: ${task.id}\n` +
      `  title: ${task.title}\n` +
      `  cron: ${task.cron}\n` +
      modeTag +
      `  runOnce: ${task.runOnce}\n` +
      `  nextRunAt (UTC): ${task.nextRunAt}\n` +
      `  nextRunAt (local): ${utcToLocal(task.nextRunAt)}\n` +
      `  enable: true`,
  }
}

// ─── cron_batch_delete ───────────────────────────────────────────────────────

async function cronBatchDelete(args: { id: string }): Promise<ToolResult> {
  const deleted = await cronManager.deleteTask(Number(args.id))
  if (!deleted) {
    return {
      success: false,
      output: '',
      error: `Cron task "${args.id}" not found.`,
    }
  }
  return { success: true, output: `✅ Cron task "${args.id}" deleted.` }
}

// ─── cron_batch_edit ─────────────────────────────────────────────────────────

async function cronBatchEdit(args: {
  id: string
  action: string
}): Promise<ToolResult> {
  if (args.action !== 'pause' && args.action !== 'resume') {
    return {
      success: false,
      output: '',
      error: `Invalid action "${args.action}". Must be "pause" or "resume".`,
    }
  }
  const enable = args.action === 'resume'
  const task = await cronManager.updateTask(Number(args.id), { enable })
  if (!task) {
    return {
      success: false,
      output: '',
      error: `Cron task "${args.id}" not found.`,
    }
  }
  return {
    success: true,
    output: enable
      ? `▶️ Cron task "${task.title}" (${args.id}) resumed.`
      : `⏸ Cron task "${task.title}" (${args.id}) paused.`,
  }
}

// ─── cron_run ─────────────────────────────────────────────────────────────────

async function cronRun(args: { id: string }): Promise<ToolResult> {
  const ok = await cronManager.runTaskNow(Number(args.id))
  if (!ok) {
    return {
      success: false,
      output: '',
      error: `Cron task "${args.id}" not found.`,
    }
  }
  return {
    success: true,
    output: `🚀 Cron task "${args.id}" triggered. Check logs for execution details.`,
  }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

export const cronListDefinition: ToolDefinition = {
  name: 'cron_list',
  description:
    "List all cron tasks. Filter by enabled_only: 'true'=enabled only, 'false'=disabled only, omit=all.",
  parameters: {
    type: 'object',
    properties: {
      enabled_only: {
        type: 'string',
        description: "'true'=enabled only, 'false'=disabled only, omit=all",
      },
    },
    required: [],
  },
}

export const cronGetDefinition: ToolDefinition = {
  name: 'cron_get',
  description: 'Get full details of a specific cron task by id.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task id' },
    },
    required: ['id'],
  },
}

export const cronBatchAddDefinition: ToolDefinition = {
  name: 'cron_batch_add',
  description:
    'Create a new cron task. Shell mode: provide shell_command. Agent mode: provide agent_id + prompt.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Task name' },
      description: { type: 'string', description: 'Description' },
      schedule: {
        type: 'string',
        description: "Cron expression, e.g. '0 9 * * *'",
      },
      shell_command: {
        type: 'string',
        description: 'Shell command (takes priority over agent mode)',
      },
      workdir: {
        type: 'string',
        description: 'Working directory for shell_command',
      },
      agent_id: {
        type: 'string',
        description: 'Agent id (required for all tasks)',
      },
      prompt: { type: 'string', description: 'Agent instruction (agent mode)' },
      run_once: {
        type: 'string',
        description: "'true' to auto-disable after first run",
      },
    },
    required: ['name', 'schedule', 'agent_id'],
  },
}

export const cronBatchDeleteDefinition: ToolDefinition = {
  name: 'cron_batch_delete',
  description: 'Delete a cron task by id.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task id' },
    },
    required: ['id'],
  },
}

export const cronTaskUpdateDefinition: ToolDefinition = {
  name: 'cron_batch_update',
  description: 'Pause or resume one or multiple cron tasks.',
  parameters: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: 'List of tasks to update',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Task id' },
            status: {
              type: 'string',
              enum: ['pause', 'resume'],
              description: 'pause or resume',
            },
          },
          required: ['id', 'status'],
        },
      },
    },
    required: ['tasks'],
  },
}

export const cronRunDefinition: ToolDefinition = {
  name: 'cron_run',
  description: 'Trigger a cron task to run immediately.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task id' },
    },
    required: ['id'],
  },
}

export async function cronTaskUpdate(
  args: { tasks: { id: string; status: string }[] },
  _context?: ToolContext
): Promise<ToolResult> {
  const results: string[] = []
  for (const item of args.tasks) {
    const result = await cronBatchEdit({ id: item.id, action: item.status })
    if (!result.success) return result
    results.push(result.output)
  }
  return { success: true, output: results.join('\n') }
}

export { cronList, cronGet, cronBatchAdd, cronBatchDelete, cronRun }
