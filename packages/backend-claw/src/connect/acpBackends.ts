/**
 * ACP Stdio 后端定义
 *
 * 所有支持 ACP（Agent Communication Protocol）stdio 协议的 CLI 工具配置。
 * 参考：https://agentcommunicationprotocol.dev/
 *
 * 新增工具只需在 ACP_STDIO_BACKENDS 数组末尾添加一条记录即可，
 * discoverRunners 和 runRunnerTool 会自动识别。
 */

export interface AcpBackendDef {
  /** 唯一标识，在 discoverRunners / runRunnerTool 中作为 runner name 使用 */
  name: string
  /** 界面显示名称 */
  title: string
  /** 用于 `which` 检测本地是否已安装的可执行文件名 */
  detectCmd: string
  /** spawn 时的主命令（直接二进制或 'npx'） */
  acpCmd: string
  /** ACP 模式参数（追加在 acpCmd 之后） */
  acpArgs: string[]
}

export const ACP_STDIO_BACKENDS: AcpBackendDef[] = [
  // ─── 直接命令 ────────────────────────────────────────────────────────────
  {
    name: 'opencode',
    title: 'OpenCode',
    detectCmd: 'opencode',
    acpCmd: 'opencode',
    acpArgs: ['acp'],
  },
  {
    // Claude Code 原生 ACP（--experimental-acp 标志）
    name: 'claudeCode',
    title: 'Claude Code',
    detectCmd: 'claude',
    acpCmd: 'claude',
    acpArgs: ['--experimental-acp'],
  },
  {
    // GitHub Copilot 原生 ACP CLI（copilot --acp --stdio）
    // 区别于旧的 `gh copilot suggest` spawn 方式（githubCopilot）
    name: 'copilot',
    title: 'GitHub Copilot',
    detectCmd: 'copilot',
    acpCmd: 'copilot',
    acpArgs: ['--acp', '--stdio'],
  },
  {
    // Kiro CLI ACP（kiro-cli acp）
    name: 'kiroCli',
    title: 'Kiro CLI',
    detectCmd: 'kiro-cli',
    acpCmd: 'kiro-cli',
    acpArgs: ['acp'],
  },
  {
    name: 'goose',
    title: 'Goose',
    detectCmd: 'goose',
    acpCmd: 'goose',
    acpArgs: ['acp'],
  },
  {
    name: 'auggie',
    title: 'Augment Code',
    detectCmd: 'auggie',
    acpCmd: 'auggie',
    acpArgs: ['--acp'],
  },
  {
    name: 'kimi',
    title: 'Kimi CLI',
    detectCmd: 'kimi',
    acpCmd: 'kimi',
    acpArgs: ['acp'],
  },
  {
    name: 'droid',
    title: 'Factory Droid',
    detectCmd: 'droid',
    acpCmd: 'droid',
    acpArgs: ['exec', '--output-format', 'acp'],
  },
  {
    name: 'qoder',
    title: 'Qoder',
    detectCmd: 'qodercli',
    acpCmd: 'qodercli',
    acpArgs: ['--acp'],
  },
  {
    name: 'vibe',
    title: 'Mistral Vibe',
    detectCmd: 'vibe-acp',
    acpCmd: 'vibe-acp',
    acpArgs: [],
  },
  {
    name: 'iflow',
    title: 'iFlow CLI',
    detectCmd: 'iflow',
    acpCmd: 'iflow',
    acpArgs: ['--experimental-acp'],
  },
  {
    name: 'nanobot',
    title: 'Nano Bot',
    detectCmd: 'nanobot',
    acpCmd: 'nanobot',
    acpArgs: ['--experimental-acp'],
  },

  // ─── npx 包（需本地安装对应 CLI 才会出现在发现列表中）─────────────────
  {
    // 检测本地 qwen CLI；运行时通过 npx 启动 ACP 模式
    name: 'qwen',
    title: 'Qwen Code',
    detectCmd: 'qwen',
    acpCmd: 'npx',
    acpArgs: ['-y', '@qwen-code/qwen-code', '--acp'],
  },
  {
    // 检测本地 codex CLI；运行时通过 npx codex-acp bridge 启动
    name: 'codex',
    title: 'Codex',
    detectCmd: 'codex',
    acpCmd: 'npx',
    acpArgs: ['-y', '@zed-industries/codex-acp@latest'],
  },
  {
    // Claude Code ACP bridge（通过 npx 启动，无需本地安装 claude，需有 claude-code-acp）
    // 使用 claude-code-acp 作为检测命令；运行时通过 npx 启动
    name: 'claudeCodeAcp',
    title: 'Claude Code (ACP Bridge)',
    detectCmd: 'claude-code-acp',
    acpCmd: 'npx',
    acpArgs: ['-y', '@zed-industries/claude-agent-acp@latest'],
  },
  {
    // 检测本地 codebuddy CLI；运行时通过 npx 启动 ACP 模式
    name: 'codebuddy',
    title: 'CodeBuddy',
    detectCmd: 'codebuddy',
    acpCmd: 'npx',
    acpArgs: ['-y', '@tencent-ai/codebuddy-code', '--acp'],
  },
]

/** 名称 → 配置 快速查找表 */
export const ACP_STDIO_BACKEND_MAP = new Map<string, AcpBackendDef>(
  ACP_STDIO_BACKENDS.map((b) => [b.name, b])
)
