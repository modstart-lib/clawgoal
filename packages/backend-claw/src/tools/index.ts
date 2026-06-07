/**
 * Tool registry: central registry for all available tools.
 * Handles tool registration, permission checking, and execution dispatch.
 */

import { config } from '../../../backend/src/config/index.js'
import { createLogger } from '../kernel/logger.js'
import { mcpManager } from '../mcp/manager.js'
import type {
  Permissions,
  ToolContext,
  ToolDefinition,
  ToolResult,
} from '../types/index.js'

import { asksDefinition, asksTool } from './asks.js'
import {
  auditCodespaceAcceptDefinition,
  auditCodespaceAcceptTool,
  auditCodespaceChangeDefinition,
  auditCodespaceChangeTool,
  auditCodespaceCancelDefinition,
  auditCodespaceCancelTool,
} from './audit.js'
import { contextSetDefinition, contextSet } from './context.js'
import {
  agentListDefinition,
  agentList,
  agentCallDefinition,
  agentCall,
} from './agent.js'
import {
  fileReadDefinition,
  fileRead,
  fileWriteDefinition,
  fileWrite,
  grepDefinition,
  grepTool,
} from './file.js'
import { shellExecDefinition, shellExec } from './shell.js'
import { pythonExecDefinition, pythonExec } from './python.js'
import {
  webBatchSearchDefinition,
  webBatchSearch,
  webBatchFetchDefinition,
  webBatchFetch,
} from './web.js'
import { skillsSearchDefinition, skillsSearchTool } from './skills.js'
import {
  memoryGetDefinition,
  memoryGet,
  memoryUpdateDefinition,
  memoryUpdate,
  memoryGlobalGetDefinition,
  memoryGlobalGet,
  memoryGlobalUpdateDefinition,
  memoryGlobalUpdate,
  userGetDefinition,
  userGet,
  userUpdateDefinition,
  userUpdate,
  soulGetDefinition,
  soulGet,
  soulUpdateDefinition,
  soulUpdate,
} from './memory.js'
import {
  cronListDefinition,
  cronList,
  cronGetDefinition,
  cronGet,
  cronBatchAddDefinition,
  cronBatchAdd,
  cronBatchDeleteDefinition,
  cronBatchDelete,
  cronTaskUpdateDefinition,
  cronTaskUpdate,
  cronRunDefinition,
  cronRun,
} from './cron.js'
import {
  objectiveListDefinition,
  objectiveList,
  objectiveGetDefinition,
  objectiveGet,
  objectiveBatchAddDefinition,
  objectiveBatchAdd,
  objectiveBatchEditDefinition,
  objectiveBatchEdit,
  objectiveBatchDeleteDefinition,
  objectiveBatchDelete,
  objectiveKeyResultBatchAddDefinition,
  objectiveKeyResultBatchAdd,
  objectiveKeyResultBatchEditDefinition,
  objectiveKeyResultBatchEdit,
  objectiveKeyResultBatchDeleteDefinition,
  objectiveKeyResultBatchDelete,
} from './objective.js'
import {
  taskListDefinition,
  taskList,
  taskBatchAddDefinition,
  taskBatchAdd,
  taskBatchEditDefinition,
  taskBatchEdit,
  taskBatchDeleteDefinition,
  taskBatchDelete,
  sharedContentGetDefinition,
  sharedContentGet,
  sharedContentSetDefinition,
  sharedContentSet,
} from './task.js'
import {
  taskJobDispatchDefinition,
  taskJobDispatch,
  taskJobSuccessDefinition,
  taskJobSuccess,
  taskJobFailDefinition,
  taskJobFail,
} from './task_job.js'
import {
  projectListDefinition,
  projectList,
  projectBatchAddDefinition,
  projectBatchAdd,
  projectBatchEditDefinition,
  projectBatchEdit,
  projectBatchDeleteDefinition,
  projectBatchDelete,
} from './project.js'
import {
  eventBatchAddDefinition,
  eventBatchAdd,
  eventBatchEditDefinition,
  eventBatchEdit,
  eventBatchDeleteDefinition,
  eventBatchDelete,
} from './event.js'
import {
  backlogListDefinition,
  backlogList,
  backlogBatchAddDefinition,
  backlogBatchAdd,
  backlogBatchEditDefinition,
  backlogBatchEdit,
  backlogBatchDeleteDefinition,
  backlogBatchDelete,
} from './backlog.js'
import {
  metricListDefinition,
  metricList,
  metricBatchAddDefinition,
  metricBatchAdd,
  metricBatchEditDefinition,
  metricBatchEdit,
  metricBatchDeleteDefinition,
  metricBatchDelete,
  metricItemListDefinition,
  metricItemList,
  metricItemBatchAddDefinition,
  metricItemBatchAdd,
  metricItemBatchDeleteDefinition,
  metricItemBatchDelete,
} from './metric.js'
import {
  noteListDefinition,
  noteList,
  noteGetDefinition,
  noteGet,
  noteSearchDefinition,
  noteSearch,
  noteBatchAddDefinition,
  noteBatchAdd,
  noteBatchEditDefinition,
  noteBatchEdit,
  noteBatchDeleteDefinition,
  noteBatchDelete,
} from './note.js'
import {
  wikiListDefinition,
  wikiList,
  wikiGetDefinition,
  wikiGet,
  wikiSearchDefinition,
  wikiSearch,
  wikiBatchAddDefinition,
  wikiBatchAdd,
  wikiBatchEditDefinition,
  wikiBatchEdit,
  wikiBatchDeleteDefinition,
  wikiBatchDelete,
} from './wiki.js'
import {
  runtimeListDefinition,
  runtimeList,
  runtimeExecuteDefinition,
  runtimeExecute,
  runtimeSystemInfoDefinition,
  runtimeSystemInfo,
  runtimeShellDefinition,
  runtimeShell,
  runtimeFileReadDefinition,
  runtimeFileRead,
  runtimeFileWriteDefinition,
  runtimeFileWrite,
  runtimeGrepDefinition,
  runtimeGrep,
} from './runtime.js'

const logger = createLogger('tools')

/**
 * Tools always given to every agent — no manual config needed in role YAML.
 * Do NOT list these in capabilities.tools.
 */
export const AGENT_DEFAULT_TOOLS = [
  'asks',
  'context_set',
  'soul_get',
  'soul_update',
  'memory_get',
  'memory_update',
  'user_get',
  'user_update',
  'cron_list',
  'cron_get',
  'cron_batch_add',
  'cron_batch_delete',
  'cron_batch_update',
  'cron_run',
] as const

type ToolHandler = (
  args: Record<string, any>,
  context: ToolContext
) => Promise<ToolResult>

interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

/** Central tool registry */
export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()

  constructor() {
    this.registerBuiltins()
  }

  /** Register all builtin tools */
  private registerBuiltins(): void {
    const tools: [ToolDefinition, ToolHandler][] = [
      // Interaction
      [asksDefinition, asksTool as unknown as ToolHandler],
      [
        auditCodespaceAcceptDefinition,
        auditCodespaceAcceptTool as unknown as ToolHandler,
      ],
      [
        auditCodespaceChangeDefinition,
        auditCodespaceChangeTool as unknown as ToolHandler,
      ],
      [
        auditCodespaceCancelDefinition,
        auditCodespaceCancelTool as unknown as ToolHandler,
      ],
      [contextSetDefinition, contextSet as unknown as ToolHandler],
      // Agent
      [agentListDefinition, agentList as unknown as ToolHandler],
      [agentCallDefinition, agentCall as unknown as ToolHandler],
      // File system
      [fileReadDefinition, fileRead as unknown as ToolHandler],
      [fileWriteDefinition, fileWrite as unknown as ToolHandler],
      [grepDefinition, grepTool as unknown as ToolHandler],
      // Execution
      [shellExecDefinition, shellExec as unknown as ToolHandler],
      [pythonExecDefinition, pythonExec as unknown as ToolHandler],
      // Web
      [webBatchSearchDefinition, webBatchSearch as unknown as ToolHandler],
      [webBatchFetchDefinition, webBatchFetch as unknown as ToolHandler],
      // Skills
      [skillsSearchDefinition, skillsSearchTool as unknown as ToolHandler],
      // Memory
      [memoryGetDefinition, memoryGet as unknown as ToolHandler],
      [memoryUpdateDefinition, memoryUpdate as unknown as ToolHandler],
      [memoryGlobalGetDefinition, memoryGlobalGet as unknown as ToolHandler],
      [
        memoryGlobalUpdateDefinition,
        memoryGlobalUpdate as unknown as ToolHandler,
      ],
      [userGetDefinition, userGet as unknown as ToolHandler],
      [userUpdateDefinition, userUpdate as unknown as ToolHandler],
      [soulGetDefinition, soulGet as unknown as ToolHandler],
      [soulUpdateDefinition, soulUpdate as unknown as ToolHandler],
      // Cron
      [cronListDefinition, cronList as unknown as ToolHandler],
      [cronGetDefinition, cronGet as unknown as ToolHandler],
      [cronBatchAddDefinition, cronBatchAdd as unknown as ToolHandler],
      [cronBatchDeleteDefinition, cronBatchDelete as unknown as ToolHandler],
      [cronTaskUpdateDefinition, cronTaskUpdate as unknown as ToolHandler],
      [cronRunDefinition, cronRun as unknown as ToolHandler],
      // Objective
      [objectiveListDefinition, objectiveList as unknown as ToolHandler],
      [objectiveGetDefinition, objectiveGet as unknown as ToolHandler],
      [
        objectiveBatchAddDefinition,
        objectiveBatchAdd as unknown as ToolHandler,
      ],
      [
        objectiveBatchEditDefinition,
        objectiveBatchEdit as unknown as ToolHandler,
      ],
      [
        objectiveBatchDeleteDefinition,
        objectiveBatchDelete as unknown as ToolHandler,
      ],
      [
        objectiveKeyResultBatchAddDefinition,
        objectiveKeyResultBatchAdd as unknown as ToolHandler,
      ],
      [
        objectiveKeyResultBatchEditDefinition,
        objectiveKeyResultBatchEdit as unknown as ToolHandler,
      ],
      [
        objectiveKeyResultBatchDeleteDefinition,
        objectiveKeyResultBatchDelete as unknown as ToolHandler,
      ],
      // Task
      [taskListDefinition, taskList as unknown as ToolHandler],
      [taskBatchAddDefinition, taskBatchAdd as unknown as ToolHandler],
      [taskBatchEditDefinition, taskBatchEdit as unknown as ToolHandler],
      [taskBatchDeleteDefinition, taskBatchDelete as unknown as ToolHandler],
      [sharedContentGetDefinition, sharedContentGet as unknown as ToolHandler],
      [sharedContentSetDefinition, sharedContentSet as unknown as ToolHandler],
      // Task Job
      [taskJobDispatchDefinition, taskJobDispatch as unknown as ToolHandler],
      [taskJobSuccessDefinition, taskJobSuccess as unknown as ToolHandler],
      [taskJobFailDefinition, taskJobFail as unknown as ToolHandler],
      // Project
      [projectListDefinition, projectList as unknown as ToolHandler],
      [projectBatchAddDefinition, projectBatchAdd as unknown as ToolHandler],
      [projectBatchEditDefinition, projectBatchEdit as unknown as ToolHandler],
      [
        projectBatchDeleteDefinition,
        projectBatchDelete as unknown as ToolHandler,
      ],
      // Event
      [eventBatchAddDefinition, eventBatchAdd as unknown as ToolHandler],
      [eventBatchEditDefinition, eventBatchEdit as unknown as ToolHandler],
      [eventBatchDeleteDefinition, eventBatchDelete as unknown as ToolHandler],
      // Project Backlog
      [backlogListDefinition, backlogList as unknown as ToolHandler],
      [backlogBatchAddDefinition, backlogBatchAdd as unknown as ToolHandler],
      [backlogBatchEditDefinition, backlogBatchEdit as unknown as ToolHandler],
      [
        backlogBatchDeleteDefinition,
        backlogBatchDelete as unknown as ToolHandler,
      ],
      // Project Metric
      [metricListDefinition, metricList as unknown as ToolHandler],
      [metricBatchAddDefinition, metricBatchAdd as unknown as ToolHandler],
      [metricBatchEditDefinition, metricBatchEdit as unknown as ToolHandler],
      [
        metricBatchDeleteDefinition,
        metricBatchDelete as unknown as ToolHandler,
      ],
      [metricItemListDefinition, metricItemList as unknown as ToolHandler],
      [
        metricItemBatchAddDefinition,
        metricItemBatchAdd as unknown as ToolHandler,
      ],
      [
        metricItemBatchDeleteDefinition,
        metricItemBatchDelete as unknown as ToolHandler,
      ],
      // Project Note
      [noteListDefinition, noteList as unknown as ToolHandler],
      [noteGetDefinition, noteGet as unknown as ToolHandler],
      [noteSearchDefinition, noteSearch as unknown as ToolHandler],
      [noteBatchAddDefinition, noteBatchAdd as unknown as ToolHandler],
      [noteBatchEditDefinition, noteBatchEdit as unknown as ToolHandler],
      [noteBatchDeleteDefinition, noteBatchDelete as unknown as ToolHandler],
      // Project Wiki
      [wikiListDefinition, wikiList as unknown as ToolHandler],
      [wikiGetDefinition, wikiGet as unknown as ToolHandler],
      [wikiSearchDefinition, wikiSearch as unknown as ToolHandler],
      [wikiBatchAddDefinition, wikiBatchAdd as unknown as ToolHandler],
      [wikiBatchEditDefinition, wikiBatchEdit as unknown as ToolHandler],
      [wikiBatchDeleteDefinition, wikiBatchDelete as unknown as ToolHandler],
      // Runtime
      [runtimeListDefinition, runtimeList as unknown as ToolHandler],
      [runtimeExecuteDefinition, runtimeExecute as unknown as ToolHandler],
      [
        runtimeSystemInfoDefinition,
        runtimeSystemInfo as unknown as ToolHandler,
      ],
      [runtimeShellDefinition, runtimeShell as unknown as ToolHandler],
      [runtimeFileReadDefinition, runtimeFileRead as unknown as ToolHandler],
      [runtimeFileWriteDefinition, runtimeFileWrite as unknown as ToolHandler],
      [runtimeGrepDefinition, runtimeGrep as unknown as ToolHandler],
    ]
    for (const [def, handler] of tools) {
      this.register(def, handler)
    }
    logger.debug(
      `Registered ${this.tools.size} builtin tools: ${Array.from(this.tools.keys()).join(', ')}`
    )
  }

  /** Register a custom tool */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler })
  }

  /** Get OpenAI-compatible tool definitions for a set of allowed tool names */
  getDefinitionsForRole(allowedTools: string[]): ToolDefinition[] {
    const results: ToolDefinition[] = []
    for (const { definition } of this.tools.values()) {
      if (allowedTools.includes(definition.name)) {
        results.push(definition)
      }
    }
    return results
  }

  /**
   * Get tool definitions including MCP tools for the given allowed lists.
   * Used in processMessage to expose both built-in and MCP tools to the model.
   */
  getDefinitionsWithMcp(
    allowedTools: string[],
    allowedMcps: string[]
  ): ToolDefinition[] {
    const builtins = this.getDefinitionsForRole(allowedTools)
    const mcpDefs = mcpManager.getToolsForAgent(allowedMcps).map(
      (t) =>
        ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }) as unknown as ToolDefinition
    )
    return [...builtins, ...mcpDefs]
  }

  /** Check if the tool itself is accessible */
  isAllowed(toolName: string, allowedTools: string[]): boolean {
    return allowedTools.includes(toolName)
  }

  /** Execute a tool by name, checking permissions first */
  async execute(
    toolName: string,

    args: Record<string, any>,
    allowedTools: string[],
    context: ToolContext,
    allowedMcps: string[] = []
  ): Promise<ToolResult> {
    // Route MCP tool calls (name format: mcp_{serverName}_{toolName})
    if (toolName.startsWith('mcp_')) {
      const withoutPrefix = toolName.slice(4) // strip 'mcp_'
      const sepIdx = withoutPrefix.indexOf('_')
      if (sepIdx !== -1) {
        const mcpServerName = withoutPrefix.slice(0, sepIdx)
        const mcpToolName = withoutPrefix.slice(sepIdx + 1)
        const allowed = allowedMcps.includes(mcpServerName)
        if (!allowed) {
          context.agentContext.logger.warn(
            `MCP tool access denied: ${toolName}`
          )
          return {
            success: false,
            output: '',
            error: `MCP server "${mcpServerName}" is not allowed for this agent.`,
          }
        }
        try {
          const output = await mcpManager.callTool(
            mcpServerName,
            mcpToolName,
            args
          )
          return { success: true, output }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          context.agentContext.logger.error(
            `MCP tool exception: ${toolName} — ${msg}`
          )
          return { success: false, output: '', error: msg }
        }
      }
    }

    if (!this.isAllowed(toolName, allowedTools)) {
      context.agentContext.logger.warn(`Tool access denied: ${toolName}`)
      return {
        success: false,
        output: '',
        error: `Tool "${toolName}" is not allowed for this member's role.`,
      }
    }

    const tool = this.tools.get(toolName)
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool "${toolName}" not found in registry.`,
      }
    }

    context.agentContext.logger.debug({ toolName, args }, 'Executing tool')
    try {
      const result = await tool.handler(args, context)
      if (result.success) {
        context.agentContext.logger.debug(`Tool success: ${toolName}`)
      } else {
        context.agentContext.logger.warn(
          `Tool failed: ${toolName} — ${result.error}`
        )
      }
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      context.agentContext.logger.error(`Tool exception: ${toolName} — ${msg}`)
      return { success: false, output: '', error: msg }
    }
  }

  /** List all registered tool names */
  listTools(): string[] {
    return Array.from(this.tools.keys())
  }

  /** Returns empty — all tools are now flat single-purpose tools with no sub-actions */
  listToolActions(): string[] {
    return []
  }

  /**
   * Apply role permissions to inject memory tools.
   * - AGENT_DEFAULT_TOOLS are always injected for every agent (no config needed).
   * - memory_global_get / memory_global_update are controlled by the permissions block.
   */
  getEffectiveAllowedTools(
    allowedTools: string[],
    permissions: Permissions
  ): string[] {
    const GLOBAL_MEMORY_TOOLS = ['memory_global_get', 'memory_global_update']
    const ALWAYS_TOOLS = AGENT_DEFAULT_TOOLS as unknown as string[]

    // Compute permitted global memory tools from permissions
    const permitted: string[] = []
    if (permissions.globalMemoryRead) permitted.push('memory_global_get')
    if (permissions.globalMemoryUpdate) permitted.push('memory_global_update')

    // Explicit list: strip global memory entries, inject always-on tools + permitted global memory tools
    const base = allowedTools.filter((t) => !GLOBAL_MEMORY_TOOLS.includes(t))
    const extra = ALWAYS_TOOLS.filter((t) => !base.includes(t))
    return [...new Set([...base, ...extra, ...permitted])]
  }
}

/** Singleton tool registry shared across the bot system (lazy init) */
let _toolRegistry: ToolRegistry | null = null

export function getToolRegistry(): ToolRegistry {
  if (!_toolRegistry) {
    _toolRegistry = new ToolRegistry()
  }
  return _toolRegistry
}

export const toolRegistry = new Proxy({} as ToolRegistry, {
  get(_target, prop: string | symbol) {
    const registry = getToolRegistry() as unknown as Record<
      string | symbol,
      unknown
    >
    const value = registry[prop]
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(getToolRegistry())
      : value
  },
})
