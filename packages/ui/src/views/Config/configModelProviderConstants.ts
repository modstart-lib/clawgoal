import { i18n } from '@/locale'
/** Default API base URLs for canonical provider types */
export const PROVIDER_DEFAULTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  custom: '',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  claude: 'https://api.anthropic.com',
  // 国内主流
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  // 聚合中转
  openrouter: 'https://openrouter.ai/api/v1',
}

export const PROVIDER_COLORS: Record<string, string> = {
  openai: 'green',
  custom: 'default',
  gemini: 'blue',
  claude: 'orange',
  deepseek: 'geekblue',
  qwen: 'gold',
  moonshot: 'purple',
  zhipu: 'cyan',
  openrouter: 'magenta',
}

export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  custom: 'Custom',
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
  deepseek: 'DeepSeek',
  qwen: 'Alibaba Cloud Qwen',
  moonshot: 'Moonshot AI',
  zhipu: 'Zhipu GLM',
  openrouter: 'OpenRouter',
}

/** Canonical provider type options shown in the UI */
export const PROVIDER_TYPES = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'claude', label: 'Anthropic Claude' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'qwen', label: 'Alibaba Cloud Qwen' },
  { value: 'moonshot', label: 'Moonshot AI' },
  { value: 'zhipu', label: 'Zhipu GLM' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: 'Custom' },
] as const

export type ProviderType =
  | 'openai'
  | 'custom'
  | 'gemini'
  | 'claude'
  | 'deepseek'
  | 'qwen'
  | 'moonshot'
  | 'zhipu'
  | 'openrouter'

/**
 * Interface format / sub-protocol options for the 'custom' provider type.
 * Determines which API format is used when communicating with the endpoint.
 */
export const CUSTOM_FORMAT_OPTIONS = [
  { value: 'openai', labelKey: 'config.providerFormatOpenai' },
  { value: 'gemini', labelKey: 'config.providerFormatGemini' },
  { value: 'anthropic', labelKey: 'config.providerFormatAnthropic' },
  { value: 'ollama', labelKey: 'config.providerFormatOllama' },
] as const

/** Built-in model suggestions for each provider type */
export const BUILTIN_MODELS: Record<string, string[]> = {
  openai: [
    'gpt-5',
    'gpt-5-codex',
    'gpt-5-codex-mini',
    'gpt-5.1',
    'gpt-5.1-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o3',
    'o3-mini',
    'o1',
    'o1-mini',
    'o1-preview',
  ],
  /** Popular models from common relay stations / custom endpoints */
  custom: [
    // DeepSeek
    'deepseek-chat',
    'deepseek-reasoner',
    // Moonshot
    'moonshot-v1-8k',
    'moonshot-v1-32k',
    'moonshot-v1-128k',
    // Zhipu GLM
    'glm-4-plus',
    'glm-4-air',
    'glm-4-flash',
    // SiliconFlow
    'Qwen/Qwen2.5-72B-Instruct',
    'Qwen/Qwen2.5-Coder-32B-Instruct',
    'deepseek-ai/DeepSeek-V3',
    'deepseek-ai/DeepSeek-R1',
    // Doubao
    'doubao-pro-4k',
    'doubao-pro-32k',
    'doubao-pro-128k',
    // Baidu Qianfan
    'ERNIE-4.0-8K',
    'ERNIE-3.5-8K',
  ],
  gemini: [
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-3-pro-image-preview',
    'gemini-3.1-flash-image-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-image',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
  ],
  claude: [
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-sonnet-4-5',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-5-20250929-thinking',
    'claude-haiku-4-5',
    'claude-haiku-4-5-20251001',
    'claude-opus-4-5',
    'claude-opus-4-5-20251101',
    'claude-opus-4-1',
    'claude-opus-4-1-20250805',
    'claude-opus-4-1-20250805-thinking',
    'claude-sonnet-4',
    'claude-sonnet-4-20250514',
    'claude-sonnet-4-20250514-thinking',
    'claude-opus-4',
    'claude-opus-4-20250514',
    'claude-opus-4-20250514-thinking',
    'claude-haiku-3-5',
    'claude-3-7-sonnet',
    'claude-3-7-sonnet-20250219',
    'claude-3-7-sonnet-20250219-thinking',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
    'deepseek-coder',
    'deepseek-coder-v2',
  ],
  qwen: [
    'qwen-turbo',
    'qwen-plus',
    'qwen-max',
    'qwen-long',
    'qwen2.5-72b-instruct',
    'qwen2.5-32b-instruct',
    'qwen2.5-coder-32b-instruct',
    'qwen3-235b-a22b',
    'qwen3-30b-a3b',
  ],
  moonshot: [
    'moonshot-v1-8k',
    'moonshot-v1-32k',
    'moonshot-v1-128k',
    'kimi-k2',
    'kimi-k1.5',
  ],
  zhipu: [
    'glm-4-plus',
    'glm-4-air',
    'glm-4-flash',
    'glm-4',
    'glm-4v',
    'glm-4v-plus',
    'glm-z1-flash',
    'glm-z1-air',
  ],
  openrouter: [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'anthropic/claude-sonnet-4-5',
    'anthropic/claude-3-5-haiku',
    'google/gemini-2.0-flash',
    'google/gemini-2.5-pro',
    'deepseek/deepseek-chat',
    'deepseek/deepseek-r1',
    'meta-llama/llama-4-scout',
    'meta-llama/llama-4-maverick',
    'meta-llama/llama-3.3-70b-instruct',
  ],
}

/** Grouped model options for displaying in the UI select with opt-group */
export const BUILTIN_MODEL_GROUPS: Record<
  string,
  Array<{ label: string; models: string[] }>
> = {
  openai: [
    {
      get label() {
        return i18n.global.t('config.modelGroupGpt51')
      },
      models: [
        'gpt-5.1',
        'gpt-5.1-codex',
        'gpt-5.1-codex-max',
        'gpt-5.1-codex-mini',
      ],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupGpt5')
      },
      models: ['gpt-5', 'gpt-5-codex', 'gpt-5-codex-mini'],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupGpt4o')
      },
      models: ['gpt-4o', 'gpt-4o-mini'],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupO3O1')
      },
      models: ['o3', 'o3-mini', 'o1', 'o1-mini', 'o1-preview'],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupGpt4')
      },
      models: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    },
  ],
  gemini: [
    {
      label: 'Gemini 3.x',
      models: [
        'gemini-3-flash-preview',
        'gemini-3-pro-preview',
        'gemini-3-pro-image-preview',
        'gemini-3.1-flash-image-preview',
      ],
    },
    {
      label: 'Gemini 2.5',
      models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-image'],
    },
    {
      label: 'Gemini 2.0',
      models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    },
    {
      label: 'Gemini 1.x',
      models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    },
  ],
  claude: [
    {
      label: 'Claude 4.6',
      models: ['claude-sonnet-4-6', 'claude-opus-4-6'],
    },
    {
      label: 'Claude 4.5',
      models: [
        'claude-sonnet-4-5',
        'claude-sonnet-4-5-20250929',
        'claude-sonnet-4-5-20250929-thinking',
        'claude-haiku-4-5',
        'claude-haiku-4-5-20251001',
        'claude-opus-4-5',
        'claude-opus-4-5-20251101',
      ],
    },
    {
      label: 'Claude 4.1',
      models: [
        'claude-opus-4-1',
        'claude-opus-4-1-20250805',
        'claude-opus-4-1-20250805-thinking',
      ],
    },
    {
      label: 'Claude 4',
      models: [
        'claude-sonnet-4',
        'claude-sonnet-4-20250514',
        'claude-sonnet-4-20250514-thinking',
        'claude-opus-4',
        'claude-opus-4-20250514',
        'claude-opus-4-20250514-thinking',
      ],
    },
    {
      label: 'Claude 3.7',
      models: [
        'claude-3-7-sonnet',
        'claude-3-7-sonnet-20250219',
        'claude-3-7-sonnet-20250219-thinking',
      ],
    },
    {
      label: 'Claude 3.5',
      models: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-haiku-3-5',
      ],
    },
    {
      label: 'Claude 3',
      models: ['claude-3-opus-20240229'],
    },
  ],
  deepseek: [
    {
      label: 'DeepSeek V3 / R1',
      models: ['deepseek-chat', 'deepseek-reasoner'],
    },
    {
      label: 'DeepSeek Coder',
      models: ['deepseek-coder', 'deepseek-coder-v2'],
    },
  ],
  qwen: [
    {
      get label() {
        return i18n.global.t('config.modelGroupQwen3')
      },
      models: ['qwen3-235b-a22b', 'qwen3-30b-a3b'],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupQwen25')
      },
      models: [
        'qwen2.5-72b-instruct',
        'qwen2.5-32b-instruct',
        'qwen2.5-coder-32b-instruct',
      ],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupQwenGeneral')
      },
      models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'],
    },
  ],
  moonshot: [
    {
      get label() {
        return i18n.global.t('config.modelGroupKimi')
      },
      models: ['kimi-k2', 'kimi-k1.5'],
    },
    {
      label: 'Moonshot V1',
      models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    },
  ],
  zhipu: [
    {
      label: 'GLM-Z1',
      models: ['glm-z1-flash', 'glm-z1-air'],
    },
    {
      label: 'GLM-4',
      models: [
        'glm-4-plus',
        'glm-4-air',
        'glm-4-flash',
        'glm-4',
        'glm-4v',
        'glm-4v-plus',
      ],
    },
  ],
  openrouter: [
    {
      label: 'OpenAI',
      models: ['openai/gpt-4o', 'openai/gpt-4o-mini'],
    },
    {
      label: 'Anthropic',
      models: ['anthropic/claude-sonnet-4-5', 'anthropic/claude-3-5-haiku'],
    },
    {
      label: 'Google',
      models: ['google/gemini-2.0-flash', 'google/gemini-2.5-pro'],
    },
    {
      label: 'DeepSeek',
      models: ['deepseek/deepseek-chat', 'deepseek/deepseek-r1'],
    },
    {
      label: 'Meta Llama',
      models: [
        'meta-llama/llama-4-scout',
        'meta-llama/llama-4-maverick',
        'meta-llama/llama-3.3-70b-instruct',
      ],
    },
  ],
  custom: [
    {
      label: 'DeepSeek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
    },
    {
      label: 'Moonshot / Kimi',
      models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupZhipu')
      },
      models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupSiliconFlow')
      },
      models: [
        'Qwen/Qwen2.5-72B-Instruct',
        'Qwen/Qwen2.5-Coder-32B-Instruct',
        'deepseek-ai/DeepSeek-V3',
        'deepseek-ai/DeepSeek-R1',
      ],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupDoubao')
      },
      models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-pro-128k'],
    },
    {
      get label() {
        return i18n.global.t('config.modelGroupErnie')
      },
      models: ['ERNIE-4.0-8K', 'ERNIE-3.5-8K'],
    },
  ],
}

/**
 * Normalize a legacy provider string to one of the canonical types.
 * Used to migrate existing configs when loading them in the UI.
 */
export function normalizeProviderType(provider?: string): ProviderType {
  if (!provider) return 'openai'
  if (provider === 'openai') return 'openai'
  if (provider === 'custom') return 'custom'
  // Legacy alias
  if (provider === 'openai-compatible') return 'custom'
  if (provider === 'gemini' || provider === 'google') return 'gemini'
  if (provider === 'claude' || provider === 'anthropic') return 'claude'
  // Named providers
  if (provider === 'deepseek') return 'deepseek'
  if (provider === 'qwen' || provider === 'alibaba') return 'qwen'
  if (provider === 'moonshot' || provider === 'kimi') return 'moonshot'
  if (provider === 'zhipu' || provider === 'glm') return 'zhipu'
  if (provider === 'openrouter') return 'openrouter'
  // Everything else (ollama, azureopenai, ...) → custom
  return 'custom'
}
