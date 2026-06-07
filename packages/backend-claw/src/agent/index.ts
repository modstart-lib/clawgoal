/**
 * Agent manager for the claw bot system.
 * Manages the lifecycle of agents (instances of roles).
 *
 * Roles are "classes" defined in:
 *   - bundled: src/claw/agent/role/{roleName}/config.yaml  (随代码发布的内置角色)
 *   - user:    data/agentRoles/{roleName}/config.yaml       (用户自定义角色，优先级更高)
 *
 * Agents are "instances" persisted in the SQLite database (claw_agent table).
 * On first boot, a default supervisor agent is auto-seeded.
 */

import yaml from 'js-yaml'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePath } from '../../../backend/src/config/env.js'
import { config as appConfig } from '../../../backend/src/config/index.js'
import { generateSystemAvatar, resolveAvatar } from '../assets/avatar.js'
import { BUNDLED_ROLES } from '../generated/bundledRoles.js'
import { createLogger } from '../kernel/logger.js'
import { AGENT_DEFAULT_TOOLS } from '../tools/index.js'
import { clawDb as agentDb } from '../storage/store/index.js'
import { clawEventBus } from '../kernel/eventBus.js'
import type {
  AddAgentOptions,
  Agent,
  AgentConfig,
  AgentPipelineDefinition,
  ChatConfig,
  ModelBehaviorConfig,
  ModelRef,
  ModelSlots,
  RoleConfig,
  RoleParamDef,
  ToolAction,
  ToolActionField,
} from '../types/index.js'

const logger = createLogger('agent')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** 随代码发布的内置角色目录 */
const BUNDLED_ROLES_DIR = path.join(__dirname, 'roles')
/** 用户自定义角色目录（项目 data/ 下，优先级高于内置） */

const USER_ROLES_DIR = resolvePath('data/agentRoles')

// ─── Role loader ─────────────────────────────────────────────────────────────

/**
 * 将 ModelSlots 中的字符串简写统一转为 ModelRef 对象。
 * YAML 中可写 `default: "provider|model"` 或完整对象 `default: { name: "provider|model" }`。
 */
function normalizeModelSlots(raw: Record<string, unknown>): ModelSlots {
  const result: ModelSlots = {}
  for (const [slot, val] of Object.entries(raw)) {
    if (typeof val === 'string') {
      // Shorthand: "providerName|modelName"
      result[slot] = { name: val } satisfies ModelRef
    } else if (Array.isArray(val) && val.every((v) => typeof v === 'string')) {
      // Shorthand array: ["providerName|modelName", "fallback|modelName"]
      result[slot] = { name: val as string[] } satisfies ModelRef
    } else if (typeof val === 'object' && val !== null && 'name' in val) {
      const v = val as Record<string, unknown>
      // name can be a string or an array of strings
      const rawName = v['name']
      const name: string | string[] = Array.isArray(rawName)
        ? (rawName as string[])
        : (rawName as string)
      const ref: ModelRef = { name }
      if (typeof v['temperature'] === 'number')
        ref.temperature = v['temperature']
      if (typeof v['maxTokens'] === 'number') ref.maxTokens = v['maxTokens']
      if (typeof v['systemPrompt'] === 'string')
        ref.systemPrompt = v['systemPrompt']
      if (typeof v['title'] === 'string') ref.title = v['title']
      result[slot] = ref
    }
  }
  return result
}

/** Parse a raw YAML object into a typed RoleConfig */
function parseRoleConfig(raw: unknown, roleName: string): RoleConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid role config for "${roleName}"`)
  }
  const obj = raw as Record<string, unknown>

  const modelRaw = (obj['model'] ?? obj['llm'] ?? {}) as Record<string, unknown>
  const capsRaw = (obj['capabilities'] ?? {}) as Record<string, unknown>
  const permRaw = (obj['permissions'] ?? {}) as Record<string, unknown>
  const modelsRaw = (obj['models'] ?? {}) as Record<string, unknown>

  const model: ModelBehaviorConfig = {
    temperature:
      typeof modelRaw['temperature'] === 'number'
        ? modelRaw['temperature']
        : 0.3,
    maxTokens:
      typeof modelRaw['maxTokens'] === 'number' ? modelRaw['maxTokens'] : 4096,
  }

  // 向后兼容：旧格式 model.model 仍然支持，作为 models.default 的来源
  if (typeof modelRaw['model'] === 'string' && !modelsRaw['default']) {
    modelsRaw['default'] = modelRaw['model']
  }

  const config: RoleConfig = {
    name: typeof obj['name'] === 'string' ? obj['name'] : roleName,
    title:
      typeof obj['title'] === 'string'
        ? obj['title']
        : typeof obj['name'] === 'string'
          ? obj['name']
          : roleName,
    description:
      typeof obj['description'] === 'string' ? obj['description'] : '',
    avatar: typeof obj['avatar'] === 'string' ? obj['avatar'] : undefined,
    soul: typeof obj['soul'] === 'string' ? obj['soul'] : undefined,
    model,
    capabilities: {
      tools: (() => {
        const rawTools = Array.isArray(capsRaw['tools'])
          ? (capsRaw['tools'] as string[])
          : []
        const forbidden = rawTools.filter((t) =>
          (AGENT_DEFAULT_TOOLS as readonly string[]).includes(t)
        )
        if (forbidden.length > 0) {
          logger.warn(
            `[role=${roleName}] capabilities.tools 中包含默认工具 [${forbidden.join(', ')}]，这些工具无需手动配置，已自动忽略。`
          )
        }
        if (rawTools.includes('*')) {
          logger.warn(
            `[role=${roleName}] capabilities.tools 中包含 "*"，不允许使用通配符，请明确列出所需工具，已自动忽略。`
          )
        }
        return rawTools.filter(
          (t) =>
            t !== '*' && !(AGENT_DEFAULT_TOOLS as readonly string[]).includes(t)
        )
      })(),
      skills: (() => {
        const rawSkills = Array.isArray(capsRaw['skills'])
          ? (capsRaw['skills'] as string[])
          : []
        if (rawSkills.includes('*')) {
          logger.warn(
            `[role=${roleName}] capabilities.skills 中包含 "*"，不允许使用通配符，请明确列出所需技能，已自动忽略。`
          )
        }
        return rawSkills.filter((t) => t !== '*')
      })(),
      mcps: (() => {
        const rawMcps = Array.isArray(capsRaw['mcps'])
          ? (capsRaw['mcps'] as string[])
          : []
        if (rawMcps.includes('*')) {
          logger.warn(
            `[role=${roleName}] capabilities.mcps 中包含 "*"，不允许使用通配符，请明确列出所需 MCP 服务，已自动忽略。`
          )
        }
        return rawMcps.filter((t) => t !== '*')
      })(),
    },
    permissions: {
      globalMemoryRead: permRaw['globalMemoryRead'] === true,
      globalMemoryUpdate: permRaw['globalMemoryUpdate'] === true,
    },
    models: normalizeModelSlots(modelsRaw),
    chats: parseChatsConfig(obj['chats']),
    agent: parseAgentConfig(obj['agent']),
    intentRouterSlot:
      typeof obj['intentRouterSlot'] === 'string'
        ? obj['intentRouterSlot']
        : undefined,
  }

  // Parse `agents` (plural) — named multi-pipeline definitions
  const agentsRaw = obj['agents']
  if (typeof agentsRaw === 'object' && agentsRaw !== null) {
    const agentsObj = agentsRaw as Record<string, unknown>
    const parsedAgents: Record<string, AgentPipelineDefinition> = {}
    for (const [key, pipelineRaw] of Object.entries(agentsObj)) {
      const inner = parseAgentConfig(pipelineRaw)
      if (inner) {
        const pObj = pipelineRaw as Record<string, unknown>
        parsedAgents[key] = {
          description:
            typeof pObj['description'] === 'string'
              ? pObj['description']
              : undefined,
          graph: inner.graph,
        }
      }
    }
    if (Object.keys(parsedAgents).length > 0) config.agents = parsedAgents
  }

  // Parse `param` — role custom parameter field definitions
  const paramRaw = obj['param']
  if (Array.isArray(paramRaw) && paramRaw.length > 0) {
    const parsedParams: RoleParamDef[] = []
    for (const item of paramRaw) {
      if (typeof item !== 'object' || item === null) continue
      const p = item as Record<string, unknown>
      if (typeof p['name'] !== 'string' || typeof p['title'] !== 'string')
        continue
      const paramType = p['type']
      if (
        paramType !== 'text' &&
        paramType !== 'select' &&
        paramType !== 'textarea'
      )
        continue
      const def: RoleParamDef = {
        name: p['name'],
        title: p['title'],
        type: paramType,
      }
      if (typeof p['defaultValue'] === 'string')
        def.defaultValue = p['defaultValue']
      if (typeof p['description'] === 'string')
        def.description = p['description']
      if (typeof p['option'] === 'string') def.option = p['option']
      if (typeof p['required'] === 'boolean') def.required = p['required']
      parsedParams.push(def)
    }
    if (parsedParams.length > 0) config.param = parsedParams
  }

  return config
}

/** Parse `chats` section from raw YAML */
function parseChatsConfig(raw: unknown): ChatConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const obj = raw as Record<string, unknown>
  const rawActions = obj['toolActions']
  if (!Array.isArray(rawActions) || rawActions.length === 0)
    return { toolActions: [] }

  const toolActions: ToolAction[] = []
  for (const item of rawActions) {
    if (typeof item !== 'object' || item === null) continue
    const a = item as Record<string, unknown>
    if (a['type'] !== 'form') continue
    const cfgRaw = (a['config'] ?? {}) as Record<string, unknown>
    const fieldsRaw = Array.isArray(cfgRaw['fields']) ? cfgRaw['fields'] : []
    const fields: ToolActionField[] = []
    for (const f of fieldsRaw) {
      if (typeof f !== 'object' || f === null) continue
      const fobj = f as Record<string, unknown>
      if (fobj['type'] === 'text') {
        fields.push({
          type: 'text',
          name: String(fobj['name'] ?? ''),
          title: String(fobj['title'] ?? ''),
          defaultValue:
            typeof fobj['defaultValue'] === 'string'
              ? fobj['defaultValue']
              : undefined,
          required: fobj['required'] === true,
        })
      } else if (fobj['type'] === 'radio') {
        fields.push({
          type: 'radio',
          name: String(fobj['name'] ?? ''),
          title: String(fobj['title'] ?? ''),
          options: Array.isArray(fobj['options'])
            ? (fobj['options'] as string[]).map(String)
            : [],
          defaultValue:
            typeof fobj['defaultValue'] === 'string'
              ? fobj['defaultValue']
              : undefined,
          required: fobj['required'] === true,
        })
      }
    }
    toolActions.push({
      type: 'form',
      icon: typeof a['icon'] === 'string' ? a['icon'] : undefined,
      title: String(a['title'] ?? ''),
      config: {
        fields,
        template:
          typeof cfgRaw['template'] === 'string' ? cfgRaw['template'] : '',
      },
    })
  }
  return { toolActions }
}

/**
 * Parse the `agent` section from a raw YAML object into a typed AgentConfig.
 * Returns undefined if the section is absent or malformed.
 */
function parseAgentConfig(raw: unknown): AgentConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const obj = raw as Record<string, unknown>

  const graphRaw = obj['graph']
  if (typeof graphRaw !== 'object' || graphRaw === null) return undefined
  const graph = graphRaw as Record<string, unknown>

  const entryPoint =
    typeof graph['entryPoint'] === 'string' ? graph['entryPoint'] : undefined
  if (!entryPoint) return undefined

  // Parse nodes
  const nodesRaw = Array.isArray(graph['nodes']) ? graph['nodes'] : []
  const nodes = nodesRaw
    .filter(
      (n): n is Record<string, unknown> => typeof n === 'object' && n !== null
    )
    .map((n) => {
      const nodeType = String(n['type'] ?? 'model') as
        | 'model'
        | 'tool'
        | 'router'
        | 'parallel'
        | 'subgraph'
        | 'context_router'
        | 'code'
      return {
        name: String(n['name'] ?? ''),
        type: nodeType,
        modelSlot:
          typeof n['modelSlot'] === 'string' ? n['modelSlot'] : undefined,
        useTools:
          typeof n['useTools'] === 'boolean' ? n['useTools'] : undefined,
        systemPromptExtra:
          typeof n['systemPromptExtra'] === 'string'
            ? n['systemPromptExtra']
            : undefined,
        toolName: typeof n['toolName'] === 'string' ? n['toolName'] : undefined,
        input:
          typeof n['input'] === 'object' && n['input'] !== null
            ? (n['input'] as Record<string, unknown>)
            : undefined,
        parallel: Array.isArray(n['parallel'])
          ? (n['parallel'] as unknown[]).map(String)
          : undefined,
        subgraphRole:
          typeof n['subgraphRole'] === 'string' ? n['subgraphRole'] : undefined,
        contextKey:
          typeof n['contextKey'] === 'string' ? n['contextKey'] : undefined,
        whenSet: typeof n['whenSet'] === 'string' ? n['whenSet'] : undefined,
        whenNotSet:
          typeof n['whenNotSet'] === 'string' ? n['whenNotSet'] : undefined,
        allowTools: Array.isArray(n['allowTools'])
          ? (n['allowTools'] as unknown[]).map(String)
          : undefined,
        codeWorkflow:
          typeof n['codeWorkflow'] === 'string' ? n['codeWorkflow'] : undefined,
        codeFn: typeof n['codeFn'] === 'string' ? n['codeFn'] : undefined,
        code: typeof n['code'] === 'string' ? n['code'] : undefined,
        codeFile: typeof n['codeFile'] === 'string' ? n['codeFile'] : undefined,
      }
    })
    .filter((n) => n.name !== '')

  // Parse edges
  const edgesRaw = Array.isArray(graph['edges']) ? graph['edges'] : []
  const edges = edgesRaw
    .filter(
      (e): e is Record<string, unknown> => typeof e === 'object' && e !== null
    )
    .map((e) => {
      const branchesRaw = Array.isArray(e['branches']) ? e['branches'] : []
      const branches = branchesRaw
        .filter(
          (b): b is Record<string, unknown> =>
            typeof b === 'object' && b !== null
        )
        .map((b) => ({
          equals: typeof b['equals'] === 'string' ? b['equals'] : undefined,
          next: String(b['next'] ?? '__end__'),
          loop: b['loop'] === true ? true : undefined,
        }))

      return {
        from: String(e['from'] ?? ''),
        to: typeof e['to'] === 'string' ? e['to'] : undefined,
        loop: e['loop'] === true ? true : undefined,
        condition:
          typeof e['condition'] === 'string' ? e['condition'] : undefined,
        branches: branches.length > 0 ? branches : undefined,
      }
    })
    .filter((e) => e.from !== '')

  return {
    graph: { entryPoint, nodes, edges },
  }
}

/** 从指定目录加载所有角色配置 */
async function loadRolesFromDir(dir: string): Promise<Map<string, RoleConfig>> {
  const roles = new Map<string, RoleConfig>()
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const configPath = path.join(dir, entry.name, 'config.yaml')
      try {
        const raw = await fs.readFile(configPath, 'utf8')
        const parsed = yaml.load(raw)
        const config = parseRoleConfig(parsed, entry.name)
        roles.set(entry.name, config)
      } catch (err) {
        logger.warn({ err }, `Failed to load role "${entry.name}" from ${dir}`)
      }
    }
    if (roles.size > 0) {
      logger.debug(
        `Loaded ${roles.size} roles from ${dir}: [${[...roles.keys()].join(', ')}]`
      )
    }
  } catch {
    // 目录不存在时静默跳过
  }
  return roles
}

/** 从嵌入的编译时数据加载内置角色（用于打包二进制时 roles 目录不可访问的情况） */
function loadBundledRolesFromEmbedded(): Map<string, RoleConfig> {
  const roles = new Map<string, RoleConfig>()
  for (const { name, content } of BUNDLED_ROLES) {
    try {
      const parsed = yaml.load(content)
      const config = parseRoleConfig(parsed, name)
      roles.set(name, config)
    } catch (err) {
      logger.warn({ err }, `Failed to parse embedded role "${name}"`)
    }
  }
  logger.debug(
    `Loaded ${roles.size} bundled roles (embedded): [${[...roles.keys()].join(', ')}]`
  )
  return roles
}

/**
 * 加载所有角色：先加载内置角色，再加载用户角色（用户角色可覆盖同名内置角色）。
 * 内置角色优先从文件系统加载（开发模式）；若目录不可访问则降级到编译时嵌入数据（二进制模式）。
 * 返回合并角色 Map 以及内置角色名称集合（用于设置 _builtinRoleName）。
 */
async function loadAllRoles(): Promise<{
  roles: Map<string, RoleConfig>
  bundledNames: Set<string>
}> {
  let bundled = await loadRolesFromDir(BUNDLED_ROLES_DIR)
  if (bundled.size === 0) {
    // 二进制打包后 roles 目录不存在，降级到嵌入数据
    bundled = loadBundledRolesFromEmbedded()
    logger.info(
      `Bundled roles dir not found, using embedded data (${bundled.size} roles)`
    )
  }
  const user = await loadRolesFromDir(USER_ROLES_DIR)
  // 合并：user 角色优先
  const merged = new Map([...bundled, ...user])
  logger.info(
    `Roles: ${bundled.size} bundled + ${user.size} user = ${merged.size} total (${[...merged.keys()].join(', ')})`
  )
  return { roles: merged, bundledNames: new Set(bundled.keys()) }
}

// ─── DB-backed Agent operations ─────────────────────────────────────────────

/** 从 Agent DB 加载所有激活的 Agent，合并角色默认配置后返回 Agent 列表 */
function loadAgentsFromDb(
  roles: Map<string, RoleConfig>,
  defaultModel: string,
  bundledNames: Set<string>
): Array<{ agent: Agent; rawConfig: Record<string, unknown> }> {
  const rows = agentDb.findAll(
    appConfig.supervisorTenantId,
    appConfig.supervisorUserId,
    true
  )
  const results: Array<{ agent: Agent; rawConfig: Record<string, unknown> }> =
    []

  for (const row of rows) {
    const baseConfig = roles.get(row.role_name)
    if (!baseConfig) {
      logger.warn(
        `Agent "${row.title}" references unknown role "${row.role_name}", skipping`
      )
      continue
    }

    // 解析 JSON 覆盖
    let rawConfig: Record<string, unknown> = {}
    if (row.config) {
      try {
        rawConfig = JSON.parse(row.config)
      } catch {
        logger.warn(`Agent "${row.title}" has invalid config JSON, ignoring`)
      }
    }
    const overrides = rawConfig as AddAgentOptions['overrides']

    const config = mergeConfig(baseConfig, overrides, defaultModel)
    results.push({
      agent: {
        id: row.id,
        tenantId: Number(row.tenant_id),
        userId: Number(row.user_id),
        title: row.title,
        description: row.description ?? null,
        roleName: row.role_name,
        config,
        active: row.enable === 1,
        workStatus: (row.status === 'working' ? 'working' : 'idle') as
          | 'idle'
          | 'working',
        avatar: row.avatar ?? null,
        avatarConfig: row.avatar_config
          ? (() => {
              try {
                return JSON.parse(row.avatar_config!)
              } catch {
                return null
              }
            })()
          : null,
        channelIds: row.channel_ids
          ? (() => {
              try {
                return JSON.parse(row.channel_ids!)
              } catch {
                return []
              }
            })()
          : [],
        webhookEnable: row.webhook_enable === 1,
        webhookToken: row.webhook_token ?? null,
        createdAt: new Date(row.created_at),
        projectId: row.project_id ?? null,
        param: row.param
          ? (() => {
              try {
                return JSON.parse(row.param!) as Record<string, unknown>
              } catch {
                return {}
              }
            })()
          : {},
        // Set workflow module loading hints
        _builtinRoleName: bundledNames.has(row.role_name)
          ? row.role_name
          : undefined,
        _roleDir: !bundledNames.has(row.role_name)
          ? path.join(USER_ROLES_DIR, row.role_name)
          : undefined,
      },
      rawConfig,
    })
  }

  return results
}

/** 深度合并 role 默认配置 + 用户覆盖 + 系统默认 model */
export function mergeConfig(
  base: RoleConfig,
  overrides: AddAgentOptions['overrides'] | undefined,
  defaultModel: string
): RoleConfig {
  // models 优先级: 用户覆盖 > 角色YAML默认 > 系统全局默认
  const baseModels: ModelSlots = {
    default: { name: defaultModel },
    ...base.models,
  }
  // 对每个 slot 做深度合并，确保 base 的 systemPrompt 等字段不被覆盖丢失
  const mergedModels: ModelSlots = overrides?.models
    ? Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(baseModels),
            ...Object.keys(overrides.models),
          ]),
        ].map((key) => [
          key,
          { ...(baseModels[key] ?? {}), ...(overrides.models![key] ?? {}) },
        ])
      )
    : baseModels

  return {
    ...base,
    name: overrides?.name ?? base.name,
    description: overrides?.description ?? base.description,
    model: { ...base.model, ...(overrides?.model ?? {}) },
    capabilities: { ...base.capabilities, ...(overrides?.capabilities ?? {}) },
    models: mergedModels,
    chats: overrides?.chats !== undefined ? overrides.chats : base.chats,
  }
}

/**
 * 检查是否已存在 supervisor agent，若不存在则自动插入。
 * 这是系统最高权限管理员，名称 "Supervisor"，不可被删除（is_system=1）。
 */
function seedDefaultSupervisor(): void {
  const existing = agentDb.findSystemAgent()
  if (existing) return

  agentDb.insert({
    id: 1,
    tenantId: appConfig.supervisorTenantId,
    userId: appConfig.supervisorUserId,
    title: '嬴政',
    roleName: 'supervisor',
    isSystem: true,
    enable: true,
    description:
      '秦始皇，统一六国，天下归一。以铁腕掌控全局，协调团队高效执行，拥有完整工具访问权限。',
    avatar: generateSystemAvatar('supervisor'),
  })
  logger.info('Seeded default system Supervisor agent')
}

// ─── AgentManager ───────────────────────────────────────────────────────────

function generateAgentId(): number {
  return Date.now()
}

export class AgentManager {
  private roles = new Map<string, RoleConfig>()
  private bundledNames = new Set<string>()
  private agents = new Map<number, Agent>()
  /** Raw config JSON per agent ID, 包含 overrides 及渠道状态字段 (_telegramToken, _ownerUserId, _chatId) */
  private rawConfigs = new Map<number, Record<string, unknown>>()
  private defaultModel = 'default'
  private initialized = false

  /** 初始化：打开 Agent DB → 加载角色库 → 自动 seed supervisor → 从 DB 加载 agents */
  async init(defaultModel?: string): Promise<void> {
    this.defaultModel = defaultModel ?? 'default'

    // 打开专属 SQLite DB
    try {
      agentDb.open()
    } catch (err) {
      logger.warn(
        { err },
        'Failed to open agent DB, agents will not be persisted'
      )
    }

    const { roles: loadedRoles, bundledNames } = await loadAllRoles()
    this.roles = loadedRoles
    this.bundledNames = bundledNames

    // 确保 DB 中存在默认 supervisor
    try {
      seedDefaultSupervisor()
    } catch (err) {
      logger.warn({ err }, 'Failed to seed default supervisor')
    }

    // 从 DB 加载所有 active agents
    try {
      const dbResults = loadAgentsFromDb(
        this.roles,
        this.defaultModel,
        this.bundledNames
      )
      for (const { agent: w, rawConfig } of dbResults) {
        this.agents.set(w.id, w)
        this.rawConfigs.set(w.id, rawConfig)
      }
      logger.info(`Loaded ${dbResults.length} agents from database`)
    } catch (err) {
      logger.warn({ err }, 'Failed to load agents from DB (starting empty)')
    }

    this.initialized = true
    logger.info(
      `AgentManager ready — roles: ${[...this.roles.keys()].join(', ')}`
    )
  }

  /**
   * 从 DB 重新加载所有 active agents 到内存。
   * 用于 seedSetup() 之后刷新内存状态，使新插入的 agents 立即生效。
   */
  reloadFromDb(): void {
    this.ensureInit()
    try {
      const dbResults = loadAgentsFromDb(
        this.roles,
        this.defaultModel,
        this.bundledNames
      )
      this.agents.clear()
      this.rawConfigs.clear()
      for (const { agent: w, rawConfig } of dbResults) {
        this.agents.set(w.id, w)
        this.rawConfigs.set(w.id, rawConfig)
      }
      logger.info(`Reloaded ${dbResults.length} agents from database`)
    } catch (err) {
      logger.warn({ err }, 'Failed to reload agents from DB')
    }
  }

  private ensureInit(): void {
    if (!this.initialized)
      throw new Error('AgentManager not initialized — call init() first')
  }

  /** 获取角色配置 */
  getRole(roleName: string): RoleConfig | undefined {
    return this.roles.get(roleName)
  }

  /** 列出所有可用角色（返回 name、title、avatar）。若 supervisor 已存在则从列表中排除。 */
  listRoles(): { name: string; title: string; avatar: string | null }[] {
    const supervisorExists = !!agentDb.findSystemAgent()
    return [...this.roles.entries()]
      .filter(([name]) => !(name === 'supervisor' && supervisorExists))
      .map(([name, cfg]) => ({
        name,
        title: cfg.title,
        avatar: resolveAvatar(cfg.avatar ?? null),
      }))
  }

  /**
   * 创建一个 Agent 实例（持久化到 DB + 加入运行时列表）。
   * 如果用户未指定某个 model slot，则使用角色 YAML 中的默认值；
   * 如果角色 YAML 也未指定，则 fallback 到 defaultModel。
   */
  async create(opts: AddAgentOptions): Promise<Agent> {
    this.ensureInit()

    const baseConfig = this.roles.get(opts.roleName)
    if (!baseConfig) {
      throw new Error(
        `Role "${opts.roleName}" not found. Available: ${this.listRoles()
          .map((r) => r.name)
          .join(', ')}`
      )
    }

    // supervisor 角色只能存在一个
    if (opts.roleName === 'supervisor') {
      const existing = agentDb.findSystemAgent()
      if (existing) {
        throw new Error('Supervisor already exists and cannot be duplicated.')
      }
    }

    const config = mergeConfig(baseConfig, opts.overrides, this.defaultModel)

    // rawConfig 仅保存 overrides；渠道状态（_telegramToken 等）由渠道层自行写入
    const rawConfig: Record<string, unknown> = {
      ...((opts.overrides as Record<string, unknown>) ?? {}),
    }

    // 解析头像：优先使用调用方传入的 avatar，否则使用角色默认 avatar，支持 system:xxx 格式
    const resolvedAvatar = resolveAvatar(opts.avatar ?? config.avatar ?? null)

    // 持久化到 Agent DB
    let dbId: number
    try {
      const row = agentDb.insert({
        tenantId: opts.tenantId,
        userId: opts.userId,
        title: opts.name,
        roleName: opts.roleName,
        enable: opts.enable !== false,
        avatar: resolvedAvatar ?? undefined,
        avatarConfig: opts.avatarConfig,
        config: rawConfig,
        param: opts.param ?? null,
        projectId: opts.projectId,
      })
      dbId = row.id
    } catch {
      // DB 不可用时降级为内存 ID
      dbId = generateAgentId()
    }

    const member: Agent = {
      id: dbId,
      tenantId: opts.tenantId,
      userId: opts.userId,
      title: opts.name,
      description: opts.overrides?.description ?? config.description ?? null,
      roleName: opts.roleName,
      config,
      active: opts.enable !== false,
      workStatus: 'idle',
      avatar: resolvedAvatar,
      avatarConfig: opts.avatarConfig ?? null,
      channelIds: [],
      webhookEnable: false,
      webhookToken: null,
      param: opts.param ?? {},
      createdAt: new Date(),
    }

    this.agents.set(member.id, member)
    this.rawConfigs.set(member.id, rawConfig)
    logger.info(
      `Created agent "${member.title}" (id=${member.id}, role=${opts.roleName})`
    )
    return member
  }

  /** 通过 ID 查找 agent */
  get(id: number): Agent | undefined {
    return this.agents.get(id)
  }

  /** 获取所有 agents。 */
  listAll(): Agent[] {
    return [...this.agents.values()]
  }

  /** 获取当前用户的所有 agents。 */
  getAllByUser(userId: number): Agent[] {
    return this.listAll().filter((agent) => agent.userId === userId)
  }

  /** 获取所有激活的 agents。 */
  listActive(): Agent[] {
    return this.listAll().filter((agent) => agent.active)
  }

  /** 获取当前用户的所有激活 agents。 */
  getActiveByUser(userId: number): Agent[] {
    return this.listActive().filter((agent) => agent.userId === userId)
  }

  /** 设置 agent 激活状态 */
  setActive(id: number, active: boolean): void {
    const agent = this.agents.get(id)
    if (agent) {
      agent.active = active
      logger.debug(`Agent ${agent.title} (${id}): active=${active}`)
    }
  }

  /** 移除 agent（同时从内存和 DB 中删除）。supervisor 不可删除。*/
  remove(id: number): boolean {
    const agent = this.agents.get(id)
    if (!agent) return false
    if (agent.roleName === 'supervisor') {
      throw new Error('SUPERVISOR_CANNOT_DELETE')
    }
    this.agents.delete(id)
    this.rawConfigs.delete(id)
    try {
      agentDb.delete(id)
    } catch (err) {
      logger.warn({ err }, `Failed to delete agent ${id} from DB`)
    }
    // 物理删除该 Agent 的所有会话和消息数据
    try {
      agentDb.deleteAgentMessagesByAgent(agent.tenantId, agent.userId, id)
      agentDb.deleteChatSessionsByAgent(agent.tenantId, agent.userId, id)
      agentDb.deleteAgentMessageRawByAgent(agent.tenantId, agent.userId, id)
    } catch (err) {
      logger.warn({ err }, `Failed to delete chat data for agent ${id}`)
    }
    logger.info(`Removed agent "${agent.title}" (${id}) from runtime and DB`)
    return true
  }

  /**
   * 持久化渠道层绑定的 Telegram ownerUserId。
   * 由 TelegramAdapter 调用，Agent 对象本身不保存此字段。
   */
  persistChannelOwnerUserId(agentId: number, userId: number): void {
    const agent = this.agents.get(agentId)
    if (!agent) return
    try {
      const existing = { ...(this.rawConfigs.get(agentId) ?? {}) }
      existing['_ownerUserId'] = userId
      this.rawConfigs.set(agentId, existing)
      agentDb.update(agentId, { config: existing })
      logger.info(
        `Agent "${agent.title}" (${agentId}): channel ownerUserId persisted to ${userId}`
      )
    } catch (err) {
      logger.warn({ err }, `Failed to persist ownerUserId for agent ${agentId}`)
    }
  }

  /**
   * 持久化渠道层绑定的 Telegram chatId。
   * 由 TelegramAdapter 调用，Agent 对象本身不保存此字段。
   */
  persistChannelChatId(agentId: number, chatId: number): void {
    const agent = this.agents.get(agentId)
    if (!agent) return
    try {
      const existing = { ...(this.rawConfigs.get(agentId) ?? {}) }
      existing['_chatId'] = chatId
      this.rawConfigs.set(agentId, existing)
      agentDb.update(agentId, { config: existing })
      logger.info(
        `Agent "${agent.title}" (${agentId}): channel chatId persisted to ${chatId}`
      )
    } catch (err) {
      logger.warn({ err }, `Failed to persist chatId for agent ${agentId}`)
    }
  }

  /**
   * 获取渠道层状态（telegramToken、ownerUserId、chatId）。
   * 这些字段属于渠道（TelegramAdapter）管理，通过 rawConfig 持久化。
   */
  getAgentChannelState(agentId: number): {
    telegramToken?: string
    ownerUserId?: number
    chatId?: number
  } {
    const rawConfig = this.rawConfigs.get(agentId) ?? {}
    return {
      telegramToken:
        typeof rawConfig['_telegramToken'] === 'string'
          ? rawConfig['_telegramToken']
          : undefined,
      ownerUserId:
        typeof rawConfig['_ownerUserId'] === 'number' ||
        typeof rawConfig['_ownerUserId'] === 'number'
          ? rawConfig['_ownerUserId']
          : undefined,
      chatId:
        typeof rawConfig['_chatId'] === 'number'
          ? rawConfig['_chatId']
          : undefined,
    }
  }

  /**
   * 更新 agent 的基础信息（title、description、avatar）。
   * 持久化到 DB 并刷新内存中的 agent 对象。
   */
  updateBasic(
    id: number,
    input: {
      title?: string
      description?: string
      avatar?: string | null
      avatarConfig?: Record<string, unknown> | null
      channelIds?: number[]
      webhookEnable?: boolean
      webhookToken?: string | null
      projectId?: number | null
    }
  ): Agent {
    this.ensureInit()
    const agent = this.agents.get(id)
    if (!agent) {
      throw new Error(`Agent "${id}" 不存在`)
    }

    if (input.title !== undefined) agent.title = input.title
    if (input.description !== undefined)
      agent.description = input.description ?? null
    if ('avatar' in input) agent.avatar = input.avatar ?? null
    if ('avatarConfig' in input) agent.avatarConfig = input.avatarConfig ?? null
    if (input.channelIds !== undefined)
      agent.channelIds = [...new Set(input.channelIds)]
    if (input.webhookEnable !== undefined)
      agent.webhookEnable = input.webhookEnable
    if ('webhookToken' in input) agent.webhookToken = input.webhookToken ?? null
    if ('projectId' in input) agent.projectId = input.projectId ?? null

    try {
      agentDb.update(id, {
        title: input.title,
        description: input.description,
        avatar: input.avatar ?? undefined,
        ...('avatarConfig' in input
          ? { avatarConfig: input.avatarConfig }
          : {}),
        channelIds: input.channelIds,
        webhookEnable: input.webhookEnable,
        ...('webhookToken' in input
          ? { webhookToken: input.webhookToken }
          : {}),
        ...('projectId' in input ? { projectId: input.projectId } : {}),
      })
      logger.info(`Agent "${agent.title}" (${id}): basic info updated`)
    } catch (err) {
      logger.warn(
        { err },
        `Failed to persist basic info update for agent ${id}`
      )
    }

    void clawEventBus.emit('agent:updated', { agentId: id })
    return agent
  }

  /**
   * 更新 agent 的配置覆盖（持久化到 DB 并刷新内存中的 config）。
   * 只保存用户传入的 overrides，不影响角色 YAML 本身。
   */
  updateConfig(id: number, overrides: AddAgentOptions['overrides']): Agent {
    this.ensureInit()
    const agent = this.agents.get(id)
    if (!agent) {
      throw new Error(`Agent "${id}" 不存在`)
    }
    const baseConfig = this.roles.get(agent.roleName)
    if (!baseConfig) {
      throw new Error(`Role "${agent.roleName}" not found`)
    }

    // 合并到已有 rawConfig（保留 _telegramToken、_ownerUserId、_chatId 等渠道状态字段）
    const existing = { ...(this.rawConfigs.get(id) ?? {}) }
    const merged = { ...existing, ...(overrides as Record<string, unknown>) }
    this.rawConfigs.set(id, merged)

    // 重新计算 config
    agent.config = mergeConfig(baseConfig, overrides, this.defaultModel)
    if (overrides?.name) agent.title = overrides.name
    if (overrides?.description !== undefined)
      agent.description = overrides.description ?? null

    // 持久化到 DB
    try {
      agentDb.update(id, {
        title: agent.title,
        description: agent.description ?? undefined,
        config: merged,
      })
      logger.info(`Agent "${agent.title}" (${id}): config updated`)
    } catch (err) {
      logger.warn({ err }, `Failed to persist config update for agent ${id}`)
    }

    return agent
  }

  /** 更新 Agent 的 param（用户填写的角色参数值），不影响 config 覆盖 */
  updateParam(id: number, param: Record<string, unknown>): Agent {
    this.ensureInit()
    const agent = this.agents.get(id)
    if (!agent) {
      throw new Error(`Agent "${id}" 不存在`)
    }
    agent.param = param
    try {
      agentDb.update(id, { param })
      logger.info(`Agent "${agent.title}" (${id}): param updated`)
    } catch (err) {
      logger.warn({ err }, `Failed to persist param update for agent ${id}`)
    }
    return agent
  }

  /** 团队状态摘要（多行，用于 API 响应） */
  status(): string {
    const agents = this.listAll()
    const lines = agents.map(
      (m) =>
        `  - ${m.title} [${m.roleName}] — ${m.active ? '🟢 active' : '🔴 inactive'}`
    )
    return `Agents (${agents.length} total):\n${lines.join('\n')}`
  }

  /** 单行紧凑摘要，用于日志输出 */
  statusLine(): string {
    const agents = this.listAll()
    const parts = agents.map(
      (m) => `${m.title}[${m.roleName}]${m.active ? '🟢' : '🔴'}`
    )
    return `Agents (${agents.length}): ${parts.join(' · ')}`
  }
}

/** Singleton agent manager */
export const agentManager = new AgentManager()
