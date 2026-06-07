/**
 * Core type definitions for the ClawGoal system.
 * Inspired by OpenFang's agent/channel architecture.
 */

// ─── Role / Agent configuration types ───────────────────────────────────────

/**
 * Event type enum
 */
export enum EventItemType {
  Error = 'Error',
  ToolCallStart = 'ToolCallStart',
  ToolCallEnd = 'ToolCallEnd',
  ModelCallStart = 'ModelCallStart',
  ModelCallEnd = 'ModelCallEnd',
}

/**
 * Event item
 */
export interface EventItem {
  /** Unique event ID: timestamp + random */
  id: string
  /** Associated task ID */
  taskId: number
  /** Event type */
  event: EventItemType
  /** Event data */
  data: Record<string, any>
  /** Timestamp */
  timestamp: number
}

/** Tool permission: specific tool names or "*" for all tools */
export type ToolPermission = string | '*'

/**
 * A reference to a specific model within a named provider.
 * `name` format: 'providerName|modelName'  (e.g. 'dashscope|qwen3.5-plus')
 * When `name` is an array, each entry is tried in order — the first successful
 * call wins, subsequent entries serve as fallbacks.
 * Each slot carries its own inference params and system prompt,
 * so different tasks can use completely different models AND prompts.
 */
export interface ModelRef {
  /**
   * Model reference(s) in 'providerName|modelName' format.
   * Supports a single string or an ordered array for fallback chaining:
   *   - "default|gpt-4o"           → single model
   *   - ["default|gpt-4o", "fallback|gpt-3.5-turbo"]  → try first, fall back on error
   */
  name: string | string[]
  temperature?: number
  maxTokens?: number
  /** Per-slot system prompt. Overrides nothing globally — each slot is self-contained. */
  systemPrompt?: string
}

/**
 * Named model slots for a role or agent instance.
 * Keys are slot names: 'default' | 'router' | 'coder' | 'creative' | ...
 * Values are either a ModelRef object or a shorthand string 'providerName|modelName'.
 *
 * Resolution order for any slot:
 *   1. Agent instance override (DB / AddAgentOptions.overrides.models)
 *   2. Role config default (config.yaml models section)
 *   3. System global default model (BotSystemOptions.defaultModelRef)
 */
export type ModelSlots = Record<string, ModelRef | string>

/** Model behavior params (model selection and prompts are in ModelSlots) */
export interface ModelBehaviorConfig {
  temperature: number
  maxTokens: number
  /**
   * Maximum tool call rounds per user message to prevent infinite loops.
   * Defaults to 20 when not set. Complex tasks (multi-file coding, research)
   * may need higher values; simple Q&A agents can use lower values.
   */
  maxToolRounds?: number
}

/** Capability flags for a role */
export interface Capabilities {
  /** Allowed tool names (explicit list only, "*" is not permitted) */
  tools: ToolPermission[]
  /** Allowed skill names (explicit list only, "*" is not permitted) */
  skills: ToolPermission[]
  /** Enabled MCP server names; maps to claw_mcp.name (explicit list only, "*" is not permitted) */
  mcps: string[]
}

export interface Permissions {
  /** Whether this role can read global (cross-agent) memory (memory_global_get) */
  globalMemoryRead: boolean
  /** Whether this role can update global (cross-agent) memory (memory_global_update) */
  globalMemoryUpdate: boolean
}

// ─── Chat tool-action types ──────────────────────────────────────────────────

/** A plain text input field for a tool-action form */
export interface ToolActionTextField {
  type: 'text'
  name: string
  title: string
  defaultValue?: string
  required?: boolean
}

/** A radio (single-select) field for a tool-action form */
export interface ToolActionRadioField {
  type: 'radio'
  name: string
  title: string
  options: string[]
  defaultValue?: string
  required?: boolean
}

/** A multi-line textarea input field for a tool-action form */
export interface ToolActionTextareaField {
  type: 'textarea'
  name: string
  title: string
  defaultValue?: string
  required?: boolean
  /** Minimum number of visible rows */
  minRows?: number
  /** Maximum number of visible rows */
  maxRows?: number
}

/** Union of all supported field types */
export type ToolActionField =
  | ToolActionTextField
  | ToolActionRadioField
  | ToolActionTextareaField

/** Config for a `type: 'form'` tool action */
export interface ToolActionFormConfig {
  /** Field definitions */
  fields: ToolActionField[]
  /**
   * Mustache-style template rendered with field values before sending.
   * Use {{fieldName}} placeholders.
   */
  template: string
}

/** A single toolbar action entry in chat config */
export interface ToolAction {
  type: 'form'
  /** Lucide icon name (e.g. "FileText", "Search") */
  icon?: string
  /** Display label */
  title: string
  config: ToolActionFormConfig
}

/** Chat-related configuration for a role */
export interface ChatConfig {
  /** Custom toolbar actions shown in the input area */
  toolActions?: ToolAction[]
}

// ─── Agent Graph config types ────────────────────────────────────────────────

/**
 * Condition branch in a conditional edge.
 * If `equals` matches the router output, the flow goes to `next`.
 * A branch with no `equals` acts as the default/fallback.
 */
export interface AgentGraphEdgeBranch {
  /** Value to match against the router node's return value */
  equals?: string
  /** Target node name to route to (use '__end__' to terminate the graph) */
  next: string
  /** When true, this edge is a back-edge (loop). The workflow engine will reset the loop body. */
  loop?: boolean
}

/**
 * Edge definition connecting two graph nodes.
 *
 * Simple edge:   `{ from: 'a', to: 'b' }`
 * Conditional:   `{ from: 'router', condition: 'routerNode', branches: [...] }`
 */
export interface AgentGraphEdge {
  /** Source node name */
  from: string
  /** Destination node name (for simple non-conditional edges) */
  to?: string
  /** When true, this simple edge is a back-edge (loop). Excluded from blocking checks. */
  loop?: boolean
  /**
   * Name of the node whose string return value is used as the routing key.
   * When set, `branches` must also be provided.
   */
  condition?: string
  /** Conditional branches evaluated against the condition node output */
  branches?: AgentGraphEdgeBranch[]
}

/**
 * A single node in the agent graph.
 *
 * `type` determines execution behaviour:
 *   - `model`      — calls a model slot, optionally with tools
 *   - `tool`     — executes a named internal tool directly (no Model)
 *   - `router`   — lightweight Model call that returns a routing key string
 *   - `parallel` — fans out to multiple sub-nodes concurrently
 *   - `subgraph` — embeds another agent graph (referenced by roleName)
 */
export interface AgentGraphNode {
  /** Unique node identifier within this graph */
  name: string
  /** Node execution type */
  type:
    | 'model'
    | 'tool'
    | 'router'
    | 'context_router'
    | 'parallel'
    | 'subgraph'
    | 'code'
  /**
   * Model slot name to use for this node (for 'model' and 'router' types).
   * Resolved from RoleConfig.models; defaults to 'default' when absent.
   */
  modelSlot?: string
  /**
   * Whether this Model node may call tools.
   * Defaults to true for 'model' nodes, false for 'router' nodes.
   */
  useTools?: boolean
  /** Additional prompt prepended to this node's system prompt */
  systemPromptExtra?: string
  /** For 'tool' nodes — name of the registered tool to invoke */
  toolName?: string
  /** Static input overrides passed to the tool or Model for this node */
  input?: Record<string, unknown>
  /**
   * For 'parallel' nodes — list of child node names to execute concurrently.
   * Results are merged into the shared state.
   */
  parallel?: string[]
  /**
   * For 'subgraph' nodes — role name whose `agent.graph` is used as a sub-graph.
   */
  subgraphRole?: string
  /**
   * For 'context_router' nodes — key in state.context to check.
   */
  contextKey?: string
  /**
   * For 'context_router' nodes — routing key when contextKey is set (truthy).
   */
  whenSet?: string
  /**
   * For 'context_router' nodes — routing key when contextKey is unset/falsy.
   */
  whenNotSet?: string
  /**
   * For 'context_router' nodes — when contextKey is not set, also test state.lastOutput
   * against this substring/pattern. If it matches, route to `whenSet` and auto-set the
   * context key to `outputContextValue` (or a default 'true').
   */
  outputPattern?: string
  /**
   * For 'context_router' nodes — value written to state.context[contextKey] when
   * outputPattern matches and the context key was previously unset.
   * Defaults to 'true' when omitted.
   */
  outputContextValue?: string
  /**
   * For 'model' nodes — override the agent-level tool list with this specific subset.
   * When set, only these tool names are made available to the model for this node.
   */
  allowTools?: string[]
  /**
   * For 'code' nodes — name of the exported WorkflowFactory function in the role's
   * workflow module (e.g. 'work'). The factory receives ClawgoalAPI and returns a
   * WorkflowDefinition whose nodes map contains the actual handler functions.
   * Required unless `code` (inline) is set.
   */
  codeWorkflow?: string
  /**
   * For 'code' nodes — key of the node handler inside WorkflowDefinition.nodes.
   * When omitted, defaults to the node's own name.
   */
  codeFn?: string
  /**
   * For 'code' nodes — inline code string defined directly in config.yaml.
   * Executed as an async function with `clawgoal` in scope.
   * Takes precedence over codeWorkflow/codeFn when set.
   */
  code?: string
  /**
   * For 'code' nodes — workflow module file name (without extension).
   * Defaults to 'workflow'. Resolved relative to the role's directory.
   */
  codeFile?: string
}

/**
 * Top-level LangGraph agent graph definition embedded in a role config.
 *
 * The graph is a directed graph with:
 *   - `entryPoint`: name of the first node to execute
 *   - `nodes`: array of node definitions
 *   - `edges`: array of edge connections
 *
 * Example (YAML):
 * ```yaml
 * agent:
 *   graph:
 *     entryPoint: router
 *     nodes:
 *       - name: router
 *         type: router
 *         modelSlot: router
 *       - name: coder
 *         type: model
 *         modelSlot: coder
 *         useTools: true
 *       - name: analyst
 *         type: model
 *         modelSlot: analyst
 *     edges:
 *       - from: router
 *         condition: router
 *         branches:
 *           - equals: coder
 *             next: coder
 *           - next: analyst
 *       - from: coder
 *         to: __end__
 *       - from: analyst
 *         to: __end__
 * ```
 */
export interface AgentGraphDefinition {
  /** First node to execute */
  entryPoint: string
  /** All nodes in the graph */
  nodes: AgentGraphNode[]
  /** All edges (simple and conditional) */
  edges: AgentGraphEdge[]
}

/**
 * A single named pipeline definition.
 * Each pipeline is an independent LangGraph that runs when the intent matches.
 */
export interface AgentPipelineDefinition {
  /** Human-readable description of what this pipeline handles (used as intent hint) */
  description?: string
  /** The LangGraph graph definition */
  graph: AgentGraphDefinition
}

/** Role configuration loaded from bundled YAML */
export interface RoleParamDef {
  /** 字段唯一标识，在 prompt 中通过 {{agent.param.<name>}} 引用 */
  name: string
  /** 字段中文显示名称 */
  title: string
  /** 字段说明，展示在输入框下方 */
  description?: string
  /** 字段类型 */
  type: 'text' | 'select' | 'textarea'
  /** 默认值 */
  defaultValue?: string
  /** select 类型的选项，逗号分隔 */
  option?: string
  /** 创建 Agent 时是否要求用户必须填写 */
  required?: boolean
}

export interface RoleConfig {
  /** Unique role identifier, matches bundled directory name */
  name: string
  /** Human-readable display name for UI */
  title: string
  description: string
  /** Default avatar for agents created from this role. Format: URL or `system:xxx` */
  avatar?: string
  /**
   * 角色的初始个性/风格定义（Soul）。
   * 当 Agent 实例的 paramDb 中尚无 AgentSoul 时，自动作为初始 soul 注入系统提示。
   */
  soul?: string
  model: ModelBehaviorConfig
  capabilities: Capabilities
  permissions: Permissions
  /**
   * Named model slots for this role/agent.
   * Standard slot names: 'default', 'router', 'coder', 'creative'.
   * Each slot maps to a ModelRef (or shorthand 'providerName|modelName' string).
   *
   * Resolution order when a agent runs:
   *   1. Agent instance overrides (from DB or AddAgentOptions)
   *   2. Role config defaults (defined in config.yaml)
   *   3. System global default (BotSystemOptions.defaultModelRef)
   */
  models: ModelSlots
  /** Chat UI configuration (toolbar actions, etc.) */
  chats?: ChatConfig
  /**
   * Optional: model slot used for intent classification across named pipelines.
   * Defaults to 'intent_router'. Omit when there is only one pipeline.
   */
  intentRouterSlot?: string
  /**
   * Named pipeline definitions.
   * Each key becomes a valid routing label for the intent router.
   * When only one pipeline is defined and `intentRouterSlot` is absent,
   * the intent router step is skipped and that pipeline always runs.
   *
   * YAML example:
   * ```yaml
   * agents:
   *   programmer:
   *     description: "Build, fix, refactor or review code"
   *     graph:
   *       entryPoint: studio_resolver
   *       nodes: [...]
   *       edges: [...]
   * ```
   */
  agents?: Record<string, AgentPipelineDefinition>
  /**
   * 角色自定义参数字段定义。
   * 用户可在 Agent 设置页面填写，通过 {{agent.param.<name>}} 在 systemPrompt 中引用。
   */
  param?: RoleParamDef[]
}

// ─── Agent (instance of a role) ────────────────────────────────────────────

/** A concrete bot instance created from a role template */
export interface Agent {
  /** Unique agent ID */
  id: number
  /** SaaS corp id this agent belongs to */
  tenantId: number
  /** SaaS user id this agent belongs to */
  userId: number
  /** 显示名称，对应 DB claw_agent.title */
  title: string
  /** 简介，对应 DB claw_agent.description */
  description: string | null
  /** Which role template this agent is based on */
  roleName: string
  /** Resolved role config (merged from template) */
  config: RoleConfig
  /** Whether this agent's bot is currently active */
  active: boolean
  /** Work status: idle = 空闲, working = 工作中 */
  workStatus: 'idle' | 'working'
  /** Avatar image URL, null means use system default */
  avatar: string | null
  /** 3D 角色配置（CharacterConfig），与 avatar 字段配合使用 */
  avatarConfig: Record<string, unknown> | null
  /** 该 Agent 需要接收消息的渠道 ID 列表（已去重）*/
  channelIds: number[]
  /** 是否开启 Webhook 推送 */
  webhookEnable: boolean
  /** Webhook 鉴权 Token，外部调用 /api/claw/agent/say 时使用 */
  webhookToken: string | null
  /**
   * 用户为该 Agent 填写的 param 值（JSON 对象）。
   * 结构由角色 config.yaml 中的 param 字段定义，通过 {{agent.param.<name>}} 在 prompt 中引用。
   */
  param: Record<string, unknown>
  /** 所属项目 ID（null 表示不属于任何项目，即全局 agent 或 supervisor） */
  projectId: number | null
  createdAt: Date
  /**
   * For built-in roles: the role's canonical name used to look up workflow modules
   * in the static workflowRegistry. Set during agent loading from bundled roles.
   */
  _builtinRoleName?: string
  /**
   * For user-defined roles loaded from an external directory: absolute path to the
   * role's directory (containing config.yaml and optionally workflow.mjs/.js).
   */
  _roleDir?: string
}

/** Configuration for creating a new agent */
export interface AddAgentOptions {
  name: string
  roleName: string
  /** SaaS tenant id */
  tenantId: number
  /** SaaS user id */
  userId: number
  /** Avatar image URL */
  avatar?: string
  /** 3D 角色配置（CharacterConfig） */
  avatarConfig?: Record<string, unknown>
  /** Whether to start this agent on boot. Defaults to true if omitted. */
  enable?: boolean
  /** Optional overrides on top of the role defaults */
  overrides?: {
    model?: Partial<ModelBehaviorConfig>
    capabilities?: Partial<Capabilities>
    /** Override model slots for this agent instance (merged over role defaults) */
    models?: ModelSlots
    /** Override display name */
    name?: string
    /** Override description */
    description?: string
    /** Override chat toolbar actions */
    chats?: ChatConfig
  }
  /** 用户在创建时为角色参数字段填写的值 */
  param?: Record<string, unknown>
  /** 所属项目 ID */
  projectId?: number
}

// ─── Unified channel-agnostic message types ──────────────────────────────────

/**
 * Discriminator for the content type of a ClawMessage.
 * 'text'     — plain text or Markdown
 * 'image'    — image with optional caption
 * 'audio'    — audio file / voice
 * 'video'    — video file
 * 'file'     — generic binary file
 * 'location' — geo coordinate
 */
export type MessageContentType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'file'
  | 'location'

/** Payload for an image message */
export interface ClawMessageImage {
  /** Publicly accessible URL (preferred when available) */
  url?: string
  /** Base64-encoded image bytes */
  data?: string
  /** MIME type, e.g. 'image/jpeg' */
  mimeType?: string
  /** Optional caption shown below the image */
  caption?: string
}

/**
 * Unified channel-agnostic message envelope.
 *
 * All channel adapters (Telegram, Feishu, …) MUST convert their native
 * message objects to this type before publishing on the event bus.
 * Gateway and Model layers consume ONLY this type — never channel-specific types.
 *
 * Usage:
 *   clawMessage.text('hello')
 *   clawMessage.image({ url: 'https://…' }, 'optional caption')
 */
export interface ClawMessage {
  /** Discriminator — always set */
  type: MessageContentType
  /** Populated when type === 'text' */
  text?: string
  /** Populated when type === 'image' */
  image?: ClawMessageImage
}

/** Convenience factory helpers — use these instead of inline object literals */
export const clawMessage = {
  text: (text: string): ClawMessage => ({ type: 'text', text }),
  image: (image: ClawMessageImage): ClawMessage => ({ type: 'image', image }),
} as const

// ─── Conversation / Message types ───────────────────────────────────────────

/** Who sent this message */
export type MessageRole = 'user' | 'assistant' | 'tool'

/** A single message in the conversation */
export interface ConversationMessage {
  role: MessageRole
  content: string
  /** ISO timestamp string */
  timestamp: string
  /** Populated when role === "tool" */
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
}

/** A full conversation session for one Telegram chat */
export interface ConversationSession {
  /** Telegram chat ID */
  chatId: number
  /** Which agent is handling this chat */
  agentId: number
  messages: ConversationMessage[]
  createdAt: Date
  updatedAt: Date
}

// ─── Tool system types ───────────────────────────────────────────────────────

/** JSON Schema for a single tool parameter property (supports primitives, arrays and nested objects) */
export interface ToolParameterProperty {
  type: string
  description: string
  enum?: string[]
  /** For type: 'array' — describes the array element schema */
  items?:
    | ToolParameterProperty
    | {
        type: string
        description?: string
        properties?: Record<string, ToolParameterProperty>
        required?: string[]
      }
  /** For type: 'object' — nested object schema */
  properties?: Record<string, ToolParameterProperty>
  required?: string[]
}

/** JSON Schema for tool parameter definitions */
export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, ToolParameterProperty>
  required?: string[]
}

/** Per-action metadata enabling fine-grained `tool.action` permission control */
export interface ToolActionDef {
  /** One-sentence description of what this action does */
  summary: string
  /**
   * Names of action-specific parameters to expose for this action.
   * - For tools with a nested `params` object: keys within `params.properties`.
   * - For flat-param tools (e.g. file): keys within top-level `parameters.properties`.
   * When omitted, parameter-level filtering is skipped for this action.
   */
  params?: string[]
}

/** A registered tool that can be called by the Model */
export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameterSchema
}

/** Result from executing a tool */
export interface ToolResult {
  success: boolean
  output: string
  error?: string
  /** Optional extracted title (e.g. from web_to_markdown tool) */
  title?: string
  /** Structured metadata for programmatic consumption by code nodes */
  meta?: Record<string, any>
  /**
   * When true, signals the caller to pause execution and wait for user input.
   * Set by the asks tool instead of returning a magic sentinel string.
   */
  pause?: boolean
}

export type {
  AgentContext,
  ToolContext,
} from '../../../backend/src/model/types.js'

// ─── Skill system types ──────────────────────────────────────────────────────

/** Skill manifest parsed from the YAML frontmatter of skills/{name}/SKILL.md */
export interface SkillManifest {
  name: string
  version: string
  description: string
  /** Markdown prompt context injected before the system prompt */
  promptContext?: string
  /** Tools this skill requires */
  requiredTools?: string[]
  /** Tags for categorization */
  tags?: string[]
}

/** An installed/loaded skill */
export interface InstalledSkill {
  manifest: SkillManifest
  /** Path to the skill directory */
  skillDir: string
  loadedAt: Date
}

// ─── Channel / Telegram types ────────────────────────────────────────────────

/** An incoming message from Telegram */
export interface IncomingTelegramMessage {
  chatId: number
  userId: number
  username?: string
  firstName?: string
  text: string
  messageId: number
  timestamp: Date
}

/** Adapter status for monitoring */
export interface AdapterStatus {
  agentId: number
  agentTitle: string
  botUsername?: string
  running: boolean
  lastActivity?: Date
  errorCount: number
}

// ─── Gateway / Kernel types ──────────────────────────────────────────────────

/** Overall bot system configuration (env-driven) */
export interface BotSystemConfig {
  openaiApiKey: string
  memoryBasePath: string
  /** Agents configuration JSON file path (optional; can be managed in-code) */
  agentsConfigPath?: string
}

/**
 * Gateway events are now defined in kernel/eventBus.ts as typed bus events.
 * Re-exported here for convenience.
 */
export type {
  AgentLifecycleEvent,
  BotErrorEvent,
  ChannelErrorEvent,
  ChannelLifecycleEvent,
  IncomingMessageEvent,
  OutgoingMessageEvent,
  ToolEndEvent,
  ToolStartEvent,
  TypingEvent,
} from '../kernel/eventBus.js'

export type {
  BaseChannelAdapter,
  ChannelAdapterStatus,
} from '../channel/base.js'
