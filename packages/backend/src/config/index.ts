import crypto from 'crypto'
import fs from 'fs'
import yaml from 'js-yaml'
import path from 'path'
import { AppConfig } from '../config.js'
import configExampleContent from './config.example.yaml'
import { expandTilde, resolvePath } from './env.js'
import { LocaleKey } from '../locale/index.js'
import { jsonParse } from '../utils/json.js'

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production'
}

const entry = process.argv[1] ?? ''
export const isSourceRuntime = /[/\\]src[/\\].+\.(ts|tsx|js|mjs|cjs)$/.test(
  entry
)

function pickNonEmptyString(
  value: string | undefined,
  fallback: string
): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }
  return fallback
}

// Bun runtime may provide NODE_ENV=development implicitly.
// For non-source execution (dist/binary), default to production unless explicitly opted into dev mode.
if (
  !isSourceRuntime &&
  process.env.NODE_ENV === 'development' &&
  process.env.ALLOW_DEV_BINARY !== '1'
) {
  process.env.NODE_ENV = 'production'
}

interface LLMRawSingleConfig {
  name?: string
}

/** A single model entry inside a provider's models list */
export interface ModelProviderModel {
  name: string
  /** Supported image input formats. Empty / undefined = ['url','base64'] (all). ['base64'] = remote URLs are auto-converted. */
  imageInputs?: string[]
  /** Default temperature for this model (0=precise, 1=creative) */
  temperature?: number
  /** Max tokens to generate per call */
  maxTokens?: number
  /** Context window size. 0 = use built-in default. */
  contextWindow?: number
}

/** Named model provider configuration */
interface ModelProviderRawConfig {
  /** Unique provider name, used as the prefix in 'providerName|modelName' references */
  name: string
  /**
   * Provider/driver type. Supported values:
   * - 'openai'   — Official OpenAI API
   * - 'custom'   — Any custom endpoint (format field selects the API protocol)
   * - 'gemini'   — Google Gemini (native)
   * - 'claude'   — Anthropic Claude (native)
   * Legacy aliases: 'anthropic' → 'claude', 'google' → 'gemini',
   *   'openai-compatible'/'custom'/'deepseek'/'ollama'/'azureopenai' → 'custom'
   */
  provider?: string
  /**
   * Interface format / sub-protocol for 'custom' providers.
   * Supported values: 'openai' (default), 'gemini', 'anthropic', 'ollama'.
   * 'ollama' uses GET /api/tags for health checks instead of GET /models.
   * 'anthropic' routes through the Anthropic Messages API (ClaudeDriver).
   */
  format?: string
  apiBase?: string
  apiKey?: string
  /** Mark this provider as the default provider */
  isDefault?: boolean
  /** Optional proxy name to route requests through (must match a name in proxy list) */
  proxyName?: string
  /** Models this provider exposes */
  models?: ModelProviderModel[]
}

/** Parsed, validated model provider config */
export interface ModelProviderConfig {
  name: string
  /**
   * Normalized provider type: 'openai' | 'custom' | 'gemini' | 'claude'
   * Used by both the claw driver router and utils/model.ts to select the correct SDK.
   */
  provider: string
  /**
   * Interface format / sub-protocol for this provider.
   * For 'custom' type: 'openai' (default) | 'gemini' | 'anthropic' | 'ollama'.
   * 'ollama' changes health-check to GET /api/tags instead of GET /models.
   * 'anthropic' routes to the Anthropic Messages API.
   */
  format: string
  apiBase: string
  apiKey: string
  /** Whether this provider is the default provider */
  isDefault?: boolean
  /** Optional proxy name to route requests through */
  proxyName?: string
  models: ModelProviderModel[]
}

interface RawConfig {
  port?: number
  /** Public access URL of the service. Used by frontend for generating absolute links. */
  url?: string
  database?: { provider?: string }
  auth?: {
    type?: string
    userId?: number
    tenantId?: number
    username?: string
    password?: string
  }
  jwt?: { secret?: string }
  log?: { path?: string }
  upload?: {
    type?: string
    url?: string
    limitExt?: string
    limitSize?: number
    local?: { path?: string }
    aliyunOss?: {
      accessKeyId?: string
      accessKeySecret?: string
      bucket?: string
      region?: string
      endpoint?: string
    }
    tencentCos?: {
      secretId?: string
      secretKey?: string
      bucket?: string
      region?: string
    }
    qiniu?: {
      accessKey?: string
      secretKey?: string
      bucket?: string
      region?: string
    }
    awsS3?: {
      accessKeyId?: string
      secretAccessKey?: string
      bucket?: string
      region?: string
      endpoint?: string
    }
    azureBlob?: {
      accountName?: string
      accountKey?: string
      containerName?: string
      endpoint?: string
    }
    modstart?: {
      baseUrl?: string
      apiMemberSecret?: string
    }
  }
  /** model is a named config map; keys are config names (e.g. "default", "router") and values are arrays of Model configs */
  model?: Record<string, LLMRawSingleConfig[]>
  agent?: { taskPath?: string; maxConcurrent?: number }
  /**
   * Base directory for data storage. All relative data sub-paths (logs, uploads, database, etc.)
   * are derived from this path. Defaults to '~/.clawgoal/data'. Supports ~ home-directory alias.
   * Can also be overridden before loading config via the DATA_PATH environment variable.
   */
  dataPath?: string
  /**
   * UTC offset in hours for the cron scheduler and Model time injection.
   * e.g. 8 for UTC+8 (Asia/Shanghai). Defaults to 8.
   */
  timezone?: number
  /**
   * Default system language.
   * Used as the last-resort fallback when no Accept-Language header is present
   * and the user has no personalised language configured.
   * Supported values: 'zh-CN' | 'en-US'
   */
  lang?: string
  /**
   * Named model providers. Each provider defines a driver (apiBase/apiKey) and a list of
   * models it exposes. Bot team members reference models as 'providerName|modelName'.
   */
  modelProviders?: ModelProviderRawConfig[]
  /**
   * Embedding model for the knowledge memory / vector search system.
   * Set type='default' to use built-in sqlite-vec (no external model/API needed).
   * Set type='openai' to use an OpenAI-compatible embedding API (requires apiKey).
   */
  embeddingModel?: {
    type?: 'openai' | 'default'
    apiKey?: string
    apiBase?: string
    model?: string
  }
  /** Named proxy server configurations */
  proxy?: ProxyRawConfig[]
  /**
   * Extra environment variables injected into shell / python calls.
   * Values may reference existing process env vars using $VAR or ${VAR} syntax,
   * e.g. PATH: "/opt/homebrew/bin:$PATH"
   */
  env?: Record<string, string> /**
   * Default user ID for system-level operations (setup.yaml seeding, API token auth, etc.).
   * Defaults to 1.
   */
  supervisorUserId?: number
  /**
   * Default corp ID for system-level operations. Defaults to 1.
   */
  supervisorTenantId?: number
  /**
   * Optional URL to report system-level errors to via a GET request.
   * When set, uncaught exceptions and unhandled rejections send:
   *   GET <reportUrl>?data=<url-encoded JSON>
   */
  reportUrl?: string
  /**
   * View mode: 'webComponent' for web-component embedded mode, 'client' for Electron client mode, '' for standalone web app.
   * When 'webComponent', API endpoints for security, API tokens, proxy, and upload settings will be disabled.
   */
  viewMode: '' | 'webComponent' | 'client'
  /** When true, logger level is set to debug for all transports. Defaults to false. */
  debug?: boolean
  /** Automatic database backup configuration */
  backup?: {
    /** Enable scheduled backups */
    enable?: boolean
    /** 5-part cron expression, e.g. "0 2 * * *" */
    cron?: string
    /** Days to retain backup snapshots; 0 = keep forever */
    keepDays?: number
  }
  claw?: {
    /**
     * Additional skill directories to load from, in addition to the default data/skills/.
     * Each entry can be an absolute path or a path relative to the project root.
     */
    skillDirs?: string[]
  }
  /**
   * Runtime environment configurations (Python interpreter, etc.)
   * Map keyed by runtime type: { python: { path } }
   */
  runtime?: Record<string, RuntimeRawConfig>
  finder?: {
    /** Root directory for the file finder browser */
    root?: string
  }
}

/** A single proxy server entry */
interface ProxyRawConfig {
  name: string
  type?: 'http' | 'socks5'
  host?: string
  port?: string
  username?: string
  password?: string
}

/** Runtime environment configuration item (Python, etc.) */
interface RuntimeRawConfig {
  path?: string
  version?: string
}

/** Exported runtime environment config item */
export interface RuntimeConfig {
  path: string
  version: string
}

/** Exported parsed proxy config item */
export interface ProxyConfig {
  name: string
  type: 'http' | 'socks5'
  host: string
  port: string
  username?: string
  password?: string
}

export function getConfigFilePath(): string {
  return findConfigFile()
}

function randomAlnum(len: number): string {
  return crypto
    .randomBytes(Math.ceil(len / 2))
    .toString('hex')
    .slice(0, len)
}

export function generateRandomPassword(): string {
  return randomAlnum(16)
}

function normalizeConfigTemplateToText(input: unknown): string {
  if (typeof input === 'string') return input
  if (Buffer.isBuffer(input)) return input.toString('utf-8')

  if (input && typeof input === 'object') {
    const maybeModule = input as { default?: unknown }
    if (typeof maybeModule.default === 'string') return maybeModule.default
    if (Buffer.isBuffer(maybeModule.default))
      return maybeModule.default.toString('utf-8')
    return yaml.dump(input, { lineWidth: -1 })
  }

  throw new Error('Embedded config.example.yaml content is invalid')
}

function buildInitialConfigContent(
  username?: string,
  password?: string,
  options?: { dataPath?: string; port?: number }
): string {
  const templateText = normalizeConfigTemplateToText(configExampleContent)
  const parsed = yaml.load(templateText)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return templateText
  }

  const cfg = parsed as Record<string, unknown>
  const auth =
    cfg.auth && typeof cfg.auth === 'object' && !Array.isArray(cfg.auth)
      ? (cfg.auth as Record<string, unknown>)
      : {}
  const jwt =
    cfg.jwt && typeof cfg.jwt === 'object' && !Array.isArray(cfg.jwt)
      ? (cfg.jwt as Record<string, unknown>)
      : {}

  auth.username = username ?? `user_${randomAlnum(8)}`
  auth.password = password ?? randomAlnum(16)
  cfg.auth = auth

  jwt.secret = randomAlnum(48)
  cfg.jwt = jwt

  if (options?.port !== undefined) cfg.port = options.port
  if (options?.dataPath) cfg.dataPath = options.dataPath

  return yaml.dump(cfg, { lineWidth: -1 })
}

/**
 * Resolve the data directory with the following priority:
 * 1. DATA_PATH environment variable
 * 2. Walk up from CWD looking for a local data/ directory (monorepo dev support)
 * 3. Default: ~/.clawgoal/data
 */
function resolveDataDir(): string {
  if (process.env.DATA_PATH) {
    const raw = process.env.DATA_PATH
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
  }
  const localData = path.join(process.cwd(), 'data')
  if (fs.existsSync(localData) && fs.statSync(localData).isDirectory()) {
    return localData
  }
  return expandTilde(`~/.${AppConfig.name}/data`)
}

/**
 * Returns true if the daemon depends on the current working directory to resolve
 * its data path (i.e. uses a local data/ directory in CWD rather than an
 * absolute DATA_PATH or the default ~/.clawgoal/data).
 */
export function isDependOnWorkingDirectory(): boolean {
  if (process.env.DATA_PATH) return false
  const localData = path.join(process.cwd(), 'data')
  return fs.existsSync(localData) && fs.statSync(localData).isDirectory()
}

function findConfigFile(): string {
  const dataDir = resolveDataDir()
  const configPath = path.join(dataDir, 'config.yaml')
  if (fs.existsSync(configPath)) return configPath

  // In binary/production mode, refuse to auto-create — user must run `setup` first.
  if (!isSourceRuntime) {
    throw new Error(
      `配置文件不存在: ${configPath}\n请先运行 '${AppConfig.name} setup' 进行初始化。`
    )
  }

  // Dev/source mode: auto-generate from the embedded config.example.yaml content
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(configPath, buildInitialConfigContent(), 'utf-8')
  console.log(`Auto-generated config file to ${configPath}`)
  return configPath
}

/**
 * Returns true if a config file already exists (same search logic as findConfigFile,
 * but without creating anything).
 */
export function configFileExists(): boolean {
  try {
    return fs.existsSync(path.join(resolveDataDir(), 'config.yaml'))
  } catch {
    return false
  }
}

/**
 * Creates the initial config file with the given credentials.
 * Writes to the standard data directory (or options.dataPath if provided) and returns the config file path.
 */
export function writeInitialConfig(
  username: string,
  password: string,
  options?: { dataPath?: string; port?: number }
): string {
  let dataDir: string
  if (options?.dataPath) {
    const rawPath = expandTilde(options.dataPath)
    dataDir = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(process.cwd(), rawPath)
  } else {
    dataDir = resolveDataDir()
  }
  const configPath = path.join(dataDir, 'config.yaml')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(
    configPath,
    buildInitialConfigContent(username, password, options),
    'utf-8'
  )
  return configPath
}

/**
 * Parse an Model config array into a list of resolved ModelConfig entries.
 * Supports multiple "name" entries for fallback chaining:
 *   - name: providerName|modelName
 *   - name: providerName|modelName
 */
function parseModelConfigList(
  raw: LLMRawSingleConfig[] | undefined,
  providers: ModelProviderConfig[]
): ModelConfig[] {
  if (!raw || !Array.isArray(raw)) {
    // Fallback to first provider or empty config
    if (providers.length > 0) {
      const p = providers[0]
      const fallbackEntry = p.models[0]
      const fallbackModel = fallbackEntry?.name || ''
      return [
        {
          type: p.provider,
          apiBase: p.apiBase,
          apiKey: p.apiKey,
          model: fallbackModel,
          name: p.name,
          nameRef: `${p.name}|${fallbackModel}`,
          ...(fallbackEntry?.imageInputs?.length
            ? { imageInputs: fallbackEntry.imageInputs }
            : {}),
          ...(fallbackEntry?.maxTokens
            ? { maxTokens: fallbackEntry.maxTokens }
            : {}),
          ...(fallbackEntry?.temperature !== undefined
            ? { temperature: fallbackEntry.temperature }
            : {}),
        },
      ]
    }
    throw new Error(
      'No Model config provided and no model providers available for fallback'
    )
  }

  // Extract ALL name entries
  const nameObjs = raw.filter((item) => item.name !== undefined)

  if (nameObjs.length === 0) {
    throw new Error(
      'Model config must contain at least one "name" field in format "providerName|modelName"'
    )
  }

  return nameObjs
    .map((nameObj) => {
      const name = nameObj.name!
      // Parse "providerName|modelName", or treat bare "default" as "default|default"
      const normalized = name === 'default' ? 'default|default' : name
      const parts = normalized.split('|')
      if (parts.length !== 2) {
        throw new Error(
          `Invalid Model name format: "${name}". Expected format: "providerName|modelName"`
        )
      }
      const [providerName, modelName] = parts


      // Resolve 'default' as a special alias for the default provider (isDefault:true or first)
      const resolvedProvider =
        providerName === 'default'
          ? (providers.find((p) => p.isDefault) ?? providers[0])
          : providers.find((p) => p.name === providerName)

      if (!resolvedProvider) {
        // provider 不存在时跳过该条目，避免启动崩溃
        return null
      }
      const provider = resolvedProvider

      // Resolve 'default' model or a model not found in the provider → fall back to first model
      const modelEntry =
        modelName === 'default'
          ? provider.models[0]
          : (provider.models.find((m) => m.name === modelName) ??
            provider.models[0])

      if (!modelEntry) {
        throw new Error(`No models available in provider "${provider.name}"`)
      }

      return {
        type: provider.provider,
        apiBase: provider.apiBase,
        apiKey: provider.apiKey,
        model: modelEntry.name,
        name: provider.name,
        nameRef: name,
        ...(modelEntry.imageInputs?.length
          ? { imageInputs: modelEntry.imageInputs }
          : {}),
        ...(modelEntry.maxTokens ? { maxTokens: modelEntry.maxTokens } : {}),
        ...(modelEntry.contextWindow
          ? { contextWindow: modelEntry.contextWindow }
          : {}),
        ...(modelEntry.temperature !== undefined
          ? { temperature: modelEntry.temperature }
          : {}),
      }
    })
    .filter((entry): entry is Required<ModelConfig> => entry !== null)
}

export interface ModelConfig {
  type: string
  apiBase: string
  apiKey: string
  model: string
  /** modelProvider 的 name（配置中 providerName，如 openai / my-deepseek） */
  name: string
  /** Original 'providerName|modelName' reference string from config */
  nameRef: string
  /** Per-model image input formats from provider config. Undefined = all formats supported. */
  imageInputs?: string[]
  /** Per-model max tokens limit from provider config */
  maxTokens?: number
  /** Per-model context window size from provider config */
  contextWindow?: number
  /** Per-model default temperature from provider config */
  temperature?: number
}

/**
 * Build a proxy URL string from a ProxyConfig, or return undefined if the proxy has no host/port.
 */
export function buildProxyUrl(proxy: ProxyConfig): string | undefined {
  if (!proxy.host || !proxy.port) return undefined
  const proto = proxy.type === 'socks5' ? 'socks5' : 'http'
  const auth =
    proxy.username && proxy.password
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : proxy.username
        ? `${encodeURIComponent(proxy.username)}@`
        : ''
  return `${proto}://${auth}${proxy.host}:${proxy.port}`
}

/**
 * Normalize legacy provider strings to the canonical types.
 * - 'anthropic'                  → 'claude'
 * - 'google'                     → 'gemini'
 * - 'openai-compatible'/'custom'/'deepseek'/'ollama'/'azureopenai'/etc. → 'custom'
 * - 'openai'                     → 'openai' (unchanged)
 * - 'gemini'/'claude'            → unchanged (already canonical)
 */
export function normalizeProviderType(raw?: string, format?: string): string {
  const val = raw ?? format ?? 'openai'
  if (
    val === 'openai' ||
    val === 'custom' ||
    val === 'gemini' ||
    val === 'claude'
  ) {
    return val
  }
  if (val === 'anthropic') return 'claude'
  if (val === 'google') return 'gemini'
  // Named OpenAI-compatible providers → 'openai' (uses stored apiBase)
  if (
    val === 'deepseek' ||
    val === 'qwen' ||
    val === 'alibaba' ||
    val === 'moonshot' ||
    val === 'kimi' ||
    val === 'zhipu' ||
    val === 'glm' ||
    val === 'openrouter'
  ) {
    return 'openai'
  }
  // 'openai-compatible' and all other legacy values map to 'custom'
  return 'custom'
}

function parseModelProviders(
  raw: ModelProviderRawConfig[] | undefined
): ModelProviderConfig[] {
  const NAMED_API_BASES: Record<string, string> = {
    deepseek: 'https://api.deepseek.com/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    moonshot: 'https://api.moonshot.cn/v1',
    kimi: 'https://api.moonshot.cn/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    glm: 'https://open.bigmodel.cn/api/paas/v4',
    openrouter: 'https://openrouter.ai/api/v1',
  }
  if (!raw || !Array.isArray(raw)) return []
  return raw.map((p) => {
    if (p.name === 'default') {
      throw new Error(
        `modelProviders: name "default" is reserved and cannot be used as a provider name`
      )
    }
    const rawProvider = p.provider ?? ''
    const providerType = normalizeProviderType(rawProvider, p.format)
    const defaultApiBase =
      NAMED_API_BASES[rawProvider] ??
      (providerType === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta'
        : providerType === 'claude'
          ? 'https://api.anthropic.com'
          : 'https://api.openai.com/v1')
    const rawModels = p.models ?? []
    return {
      name: p.name,
      provider: providerType,
      // For 'custom' type, default format to 'openai'; otherwise mirror provider type
      format: p.format ?? (providerType === 'custom' ? 'openai' : providerType),
      apiBase: p.apiBase ?? defaultApiBase,
      apiKey: p.apiKey ?? '',
      isDefault: p.isDefault ?? false,
      proxyName: p.proxyName,
      models: rawModels,
    }
  })
}

function loadRawConfig(): RawConfig {
  const configPath = findConfigFile()
  const content = fs.readFileSync(configPath, 'utf-8')
  const ext = path.extname(configPath).toLowerCase()
  if (ext === '.yaml' || ext === '.yml') {
    return yaml.load(content) as RawConfig
  }
  return jsonParse(content) as RawConfig
}

// ─── Lazy config init ───────────────────────────────────────────────────────
function _buildConfig() {
  const raw = loadRawConfig()

  // Resolve data sub-paths: config.dataPath takes priority, otherwise use resolveDataDir()
  const rawDataPath = raw.dataPath
  const dataPath = rawDataPath
    ? path.isAbsolute(rawDataPath)
      ? rawDataPath
      : resolvePath(expandTilde(rawDataPath))
    : resolveDataDir()
  const resolveDataSubPath = (subPath: string) => {
    const base = path.isAbsolute(dataPath) ? dataPath : resolvePath(dataPath)
    return path.join(base, subPath)
  }

  // Set the database provider (mysql or sqlite), consumed by the Prisma schema and migrate.ts
  const dbProvider = (raw.database?.provider ?? 'mysql').toLowerCase()

  if (dbProvider !== 'sqlite' && dbProvider !== 'mysql') {
    throw new Error(
      `Unsupported database provider: "${dbProvider}". Use "mysql" or "sqlite".`
    )
  }
  process.env.DATABASE_PROVIDER = dbProvider

  // Parse model providers first (needed for Model config resolution)
  const modelProviders = parseModelProviders(raw.modelProviders)

  // Parse Model configurations (depends on modelProviders)
  // Each named entry now stores a list of configs for fallback chaining.
  const llmConfigs: Record<string, Required<ModelConfig>[]> = {}
  if (raw.model) {
    for (const [name, cfg] of Object.entries(raw.model)) {
      llmConfigs[name] = parseModelConfigList(cfg, modelProviders)
    }
  }
  // Ensure 'default' always exists (but allow empty when no providers or model config)
  if (!llmConfigs.default) {
    llmConfigs.default = modelProviders.length > 0
      ? parseModelConfigList(undefined, modelProviders)
      : []
  }

  // Set process.env.TZ so all native Date operations use the configured offset.
  // Note: Etc/GMT uses the opposite sign convention (Etc/GMT-8 = UTC+8).
  {
    const tz = raw.timezone ?? 8
    process.env.TZ = `Etc/GMT${tz <= 0 ? '+' + -tz : '-' + tz}`
  }

  return {
    dataPath,
    port: process.env.PORT
      ? parseInt(process.env.PORT, 10)
      : (raw.port ?? 53001),
    /** Public access URL configured by the user. Empty string means auto-detect from browser. */
    url: raw.url ?? '',
    env: process.env.NODE_ENV || 'development',
    apiPrefix: '/api',
    logPath: raw.log?.path ?? resolveDataSubPath('logs/'),
    auth: {
      type: raw.auth?.type ?? 'fixed',
      userId: Number(raw.auth?.userId ?? 1),
      tenantId: Number(raw.auth?.tenantId ?? 1),
      username: raw.auth?.username ?? 'user',
      password: raw.auth?.password ?? 'password',
    },
    jwt: {
      secret: raw.jwt?.secret ?? 'default-secret-key',
      expiresIn: '24h',
    },
    upload: {
      type: raw.upload?.type ?? 'local',
      url: raw.upload?.url ?? 'http://localhost:53001/uploads/',
      local: {
        path: pickNonEmptyString(
          raw.upload?.local?.path,
          resolveDataSubPath('uploads/')
        ),
      },
      limitExt: raw.upload?.limitExt ?? 'jpg,png,gif,svg,doc,docx,xls,xlsx',
      limitSize: raw.upload?.limitSize ?? 1024000,
      aliyunOss: {
        accessKeyId: raw.upload?.aliyunOss?.accessKeyId ?? '',
        accessKeySecret: raw.upload?.aliyunOss?.accessKeySecret ?? '',
        bucket: raw.upload?.aliyunOss?.bucket ?? '',
        region: raw.upload?.aliyunOss?.region ?? 'oss-cn-hangzhou',
        endpoint: raw.upload?.aliyunOss?.endpoint ?? '',
      },
      tencentCos: {
        secretId: raw.upload?.tencentCos?.secretId ?? '',
        secretKey: raw.upload?.tencentCos?.secretKey ?? '',
        bucket: raw.upload?.tencentCos?.bucket ?? '',
        region: raw.upload?.tencentCos?.region ?? 'ap-guangzhou',
      },
      qiniu: {
        accessKey: raw.upload?.qiniu?.accessKey ?? '',
        secretKey: raw.upload?.qiniu?.secretKey ?? '',
        bucket: raw.upload?.qiniu?.bucket ?? '',
        region: raw.upload?.qiniu?.region ?? 'z0',
      },
      awsS3: {
        accessKeyId: raw.upload?.awsS3?.accessKeyId ?? '',
        secretAccessKey: raw.upload?.awsS3?.secretAccessKey ?? '',
        bucket: raw.upload?.awsS3?.bucket ?? '',
        region: raw.upload?.awsS3?.region ?? 'us-east-1',
        endpoint: raw.upload?.awsS3?.endpoint ?? '',
      },
      azureBlob: {
        accountName: raw.upload?.azureBlob?.accountName ?? '',
        accountKey: raw.upload?.azureBlob?.accountKey ?? '',
        containerName: raw.upload?.azureBlob?.containerName ?? '',
        endpoint: raw.upload?.azureBlob?.endpoint ?? '',
      },
      modstart: {
        baseUrl: raw.upload?.modstart?.baseUrl ?? '',
        apiMemberSecret: raw.upload?.modstart?.apiMemberSecret ?? '',
      },
    },
    /** Named model config map, always includes a "default" entry as fallback */
    model: llmConfigs,
    /** Named model providers for the bot subsystem */
    modelProviders,
    /** Optional dedicated embedding model (overrides default fallback to first modelProvider) */
    embeddingModel: raw.embeddingModel ?? null,
    /** Named proxy server configurations */
    proxy: (raw.proxy ?? []).map((p) => ({
      name: p.name,
      type: (p.type ?? 'http') as 'http' | 'socks5',
      host: p.host ?? '',
      port: p.port ?? '',
      ...(p.username ? { username: p.username } : {}),
      ...(p.password ? { password: p.password } : {}),
    })),
    agentTask: {
      path: raw.agent?.taskPath ?? resolveDataSubPath('agentTasks/'),
      maxConcurrent: raw.agent?.maxConcurrent ?? 3,
      maxRevisions: 3, // Prevent infinite revision loops
    },
    /**
     * UTC offset in hours used for cron scheduling and Model time injection.
     * Defaults to 8 (Asia/Shanghai, UTC+8).
     */
    timezone: raw.timezone ?? 8,
    /**
     * Default system language. Last-resort fallback for locale resolution.
     * Priority: Accept-Language header > user param 'UserLang' > this value.
     */
    lang: raw.lang as LocaleKey,
    write: {
      extension: {
        logPath:
          raw.write?.extension?.logPath ?? resolveDataSubPath('extensionLogs/'),
        id: raw.write?.extension?.id ?? '',
      },
    },
    finder: {
      root: expandTilde(raw.finder?.root ?? '/'),
    },
    claw: {
      skillDirs: [
        resolveDataSubPath('skills'),
        ...(raw.claw?.skillDirs ?? []).map((d) =>
          path.isAbsolute(expandTilde(d))
            ? expandTilde(d)
            : resolvePath(expandTilde(d))
        ),
      ],
    },
    /**
     * Extra environment variables to inject into shell / python subprocesses.
     * $VAR and ${VAR} references are expanded from the current process environment.
     */
    shellEnv: expandEnvVars(raw.env ?? {}),
    /**
     * Default user ID for system-level operations: setup.yaml seeding, API token auth,
     * and any place where a userId context is required but none is explicitly provided.
     * Defaults to 1.
     */
    supervisorUserId: Number(raw.supervisorUserId ?? 1),
    /** Default corp ID for system-level operations. Defaults to 1. */
    supervisorTenantId: Number(raw.supervisorTenantId ?? 1),
    /**
     * Optional URL to report system-level errors. When configured, uncaught exceptions
     * and unhandled promise rejections will be sent as GET requests:
     *   GET <reportUrl>?data=<url-encoded JSON payload>
     */
    reportUrl: raw.reportUrl ?? null,
    /** Automatic database backup configuration */
    backup: {
      enable: raw.backup?.enable ?? false,
      cron: raw.backup?.cron ?? '0 2 * * *',
      keepDays: raw.backup?.keepDays ?? 30,
    },
    /**
     * View mode: 'webComponent' (web-component embedded), 'client' (Electron client), '' (standalone web app).
     * Backend endpoints for security, API tokens, proxy, and upload are disabled in 'webComponent' mode.
     */
    viewMode: (raw.viewMode as string) || (process.env.IS_CLIENT === '1' ? 'client' : ''),
    /** When true, all debug-level logs are emitted. Defaults to false. */
    debug: raw.debug ?? false,
    /** Runtime environment configurations (Python, etc.) */
    runtime: Object.fromEntries(
      Object.entries(raw.runtime ?? {}).map(([key, r]) => [
        key,
        {
          path: r.path ?? '',
          version: r.version ?? '',
        } satisfies RuntimeConfig,
      ])
    ) as Record<string, RuntimeConfig>,
  }
}

type AppConfig = ReturnType<typeof _buildConfig>
let _appConfig: AppConfig | null = null

function _getConfig(): AppConfig {
  if (!_appConfig) _appConfig = _buildConfig()
  return _appConfig
}

export function reloadConfig() {
  _appConfig = null
}

export const config = new Proxy({} as AppConfig, {
  get(_, key: string | symbol) {
    return _getConfig()[key as keyof AppConfig]
  },
})

/**
 * Check if the file extension is allowed
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase().replace('.', '')
  const allowedExts = config.upload.limitExt
    .split(',')
    .map((e) => e.trim().toLowerCase())
  return allowedExts.includes(ext)
}

/**
 * Check if the file size is within the limit
 */
export function isAllowedSize(size: number): boolean {
  return size <= config.upload.limitSize
}

/** Expand $VAR / ${VAR} placeholders inside env values using the current process.env. */
function expandEnvVars(raw: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[key] = value.replace(
      /\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (_, braced, bare) => {
        const name = braced ?? bare
        return process.env[name] ?? ''
      }
    )
  }
  return result
}


/**
 * 获取 ModelConfig 列表。
 * 每次从 user.apiData（内置 provider 凭证）和 param（启用配置）实时读取，无内存缓存。
 *
 * - `providerName|modelName`：从 config.modelProviders 或内置 provider（name='builtin'）解析
 * - `default` / 其他命名 key：先查 config.model 预配置；无配置时从内置 provider + param 拼接默认模型
 */
export async function getModelConfigList(
  userId: number,
  tenantId: number,
  name: string
): Promise<ModelConfig[]> {
  // ── 读取当前用户的内置 provider 凭证（来自 user.apiData）──────────────────────

  // ── 合并所有可用 providers（config.yaml 自定义 + 当前用户内置）──────────────
  let allProviders: ModelProviderConfig[] = config.modelProviders

  // ── providerName|modelName 直接解析 ──────────────────────────────────────────
  if (name && name.includes('|')) {
    const sepIdx = name.indexOf('|')
    const providerName = name.slice(0, sepIdx)
    const modelName = name.slice(sepIdx + 1)
    const provider = allProviders.find((p) => p.name === providerName)
    if (provider) {
      // builtin provider 直接用 modelName，其他 provider 从 models 列表匹配
      const resolvedModel =
        provider.name === 'builtin'
          ? modelName
          : (
              provider.models.find((m) => m.name === modelName) ??
              provider.models[0]
            )?.name
      if (resolvedModel) {
        const modelEntry = provider.models.find((m) => m.name === resolvedModel)
        return [
          {
            type: provider.provider,
            apiBase: provider.apiBase,
            apiKey: provider.apiKey,
            model: resolvedModel,
            name: provider.name,
            nameRef: name,
            ...(modelEntry?.imageInputs?.length
              ? { imageInputs: modelEntry.imageInputs }
              : {}),
            ...(modelEntry?.maxTokens
              ? { maxTokens: modelEntry.maxTokens }
              : {}),
            ...(modelEntry?.contextWindow
              ? { contextWindow: modelEntry.contextWindow }
              : {}),
            ...(modelEntry?.temperature !== undefined
              ? { temperature: modelEntry.temperature }
              : {}),
          },
        ]
      }
    }
    return []
  }

  // ── 命名 key（default / router / ...）：先查 config.model 预配置 ─────────────
  const staticList = config.model[name] || config.model['default'] || []
  if (staticList.length > 0) return staticList

  // ── default：无自定义配置时，从内置 provider + param 拼接默认模型 ──────────────

  // ── 自动配置默认模型：当 name==='default' 且没有任何可用配置时 ─────────────────
  if (name === 'default') {
    // 优先：自定义 provider（config.yaml）
    const firstCustomProvider = config.modelProviders.find(
      (p) => p.models.length > 0
    )
    if (firstCustomProvider) {
      try {
        const { syncConfigProviders } =
          await import('../model/modelProvider.js')
        firstCustomProvider.isDefault = true
        config.modelProviders
          .filter((p) => p.name !== firstCustomProvider.name)
          .forEach((p) => {
            p.isDefault = false
          })
        syncConfigProviders()
      } catch {
        // 写入失败不影响本次调用
      }
      const modelEntry = firstCustomProvider.models[0]
      return [
        {
          type: firstCustomProvider.provider,
          apiBase: firstCustomProvider.apiBase,
          apiKey: firstCustomProvider.apiKey,
          model: modelEntry.name,
          name: firstCustomProvider.name,
          nameRef: `${firstCustomProvider.name}|${modelEntry.name}`,
          ...(modelEntry.imageInputs?.length
            ? { imageInputs: modelEntry.imageInputs }
            : {}),
          ...(modelEntry.maxTokens ? { maxTokens: modelEntry.maxTokens } : {}),
          ...(modelEntry.contextWindow
            ? { contextWindow: modelEntry.contextWindow }
            : {}),
          ...(modelEntry.temperature !== undefined
            ? { temperature: modelEntry.temperature }
            : {}),
        },
      ]
    }

  }

  return staticList
}
