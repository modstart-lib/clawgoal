import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import type pino from 'pino'
import * as acp from './acp.js'
import { AcpStdioConnector } from './acpStdio.js'
import type { AcpStageEvent } from './acpStdio.js'

const execFileAsync = promisify(execFile)
import { ACP_STDIO_BACKENDS, ACP_STDIO_BACKEND_MAP } from './acpBackends.js'

export interface RunnerInfo {
  name: string
  title: string
  status?: string
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    // Try bash login shell first to load user environment paths (like ~/.local/bin)
    const bashResult = await execFileAsync(
      'bash',
      ['-l', '-c', `command -v ${cmd}`],
      {
        timeout: 3000,
      }
    )
    if ((bashResult.stdout?.trim().length ?? 0) > 0) return true
  } catch {
    /* ignore */
  }

  try {
    // Fallback to plain sh command -v (POSIX compliant, avoids depending on 'which')
    const r2 = await execFileAsync('sh', ['-c', `command -v ${cmd}`], {
      timeout: 3000,
    })
    if ((r2.stdout?.trim().length ?? 0) > 0) return true
  } catch {
    /* ignore */
  }

  try {
    // Fallback to which
    const r = await execFileAsync('which', [cmd], { timeout: 3000 })
    return (r.stdout?.trim().length ?? 0) > 0
  } catch {
    return false
  }
}

async function shellCheck(shellCmd: string): Promise<boolean> {
  try {
    await execFileAsync('bash', ['-l', '-c', shellCmd], { timeout: 5000 })
    return true
  } catch {
    /* ignore */
  }

  try {
    await execFileAsync('sh', ['-c', shellCmd], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export async function discoverRunners(): Promise<RunnerInfo[]> {
  const found: RunnerInfo[] = []

  // ACP stdio 后端：并行检测所有 CLI 是否已安装
  const backendResults = await Promise.all(
    ACP_STDIO_BACKENDS.map(async (backend) => ({
      backend,
      exists: await commandExists(backend.detectCmd),
    }))
  )
  for (const { backend, exists } of backendResults) {
    if (exists) {
      found.push({
        name: backend.name,
        title: backend.title,
        status: 'online',
      })
    }
  }

  // 非 ACP 工具（spawn 方式），并行检测
  const [ghExists, ghCopilotOk, geminiExists, aiderExists, cursorExists] =
    await Promise.all([
      commandExists('gh'),
      shellCheck('gh copilot --version 2>/dev/null'),
      commandExists('gemini'),
      commandExists('aider'),
      process.platform === 'darwin'
        ? shellCheck('test -d /Applications/Cursor.app')
        : Promise.resolve(false),
    ])

  if (ghExists && ghCopilotOk) {
    found.push({
      name: 'githubCopilot',
      title: 'GitHub Copilot (gh)',
      status: 'online',
    })
  }
  if (geminiExists)
    found.push({ name: 'geminiCli', title: 'Gemini CLI', status: 'online' })
  if (aiderExists)
    found.push({ name: 'aider', title: 'Aider', status: 'online' })
  if (cursorExists)
    found.push({ name: 'cursor', title: 'Cursor', status: 'online' })

  // HTTP ACP server — discover agents from ACP server
  const acpBaseUrl = process.env['ACP_BASE_URL'] ?? acp.DEFAULT_BASE_URL
  if (await acp.detect(acpBaseUrl)) {
    try {
      const agents = await acp.listAgents(acpBaseUrl)
      for (const agent of agents) {
        found.push({
          name: `acp:${agent.name}`,
          title: `ACP: ${agent.description ?? agent.name}`,
          status: 'online',
        })
      }
    } catch {
      // ACP server reachable but agent listing failed — skip
    }
  }

  return found
}

export interface ProgressMessage {
  /** 消息级别：error=包含"error/fail/fatal"关键词，warning=包含"warn"，info=包含"info/success/done"，log=其余 */
  level: 'log' | 'info' | 'warning' | 'error'
  /** 数据来源：stdout 或 stderr */
  source: 'stdout' | 'stderr'
  /** 消息内容（已截断至 500 字符） */
  content: string
  /** ACP 规范化阶段事件（仅 ACP stdio 执行器有值） */
  stageEvent?: AcpStageEvent
  /** ACP stdio 内容类型（undefined=普通日志，prompt=提示词，think=思考内容，model=模型名称） */
  contentType?: 'prompt' | 'think' | 'model'
}

function detectLevel(line: string): ProgressMessage['level'] {
  const l = line.toLowerCase()
  if (/\berror\b|fail(ed|ure)?|\bfatal\b|\bexception\b/.test(l)) return 'error'
  if (/\bwarn(ing)?\b/.test(l)) return 'warning'
  if (/\binfo\b|\bsuccess\b|\bdone\b|\bcomplete\b/.test(l)) return 'info'
  return 'log'
}

export interface RunRunnerOptions {
  name: string
  prompt: string
  cwd?: string
  sessionContinueId?: string
  onProgress?: (msg: ProgressMessage) => void
  /** ACP server base URL，仅对 acp:* 执行器有效，默认 http://localhost:8000 */
  acpBaseUrl?: string
  /** agent 专属日志记录器，用于将 ACP-STDIO 通信记录同步写入 logs/agent/ */
  agentLogger?: pino.Logger
}

export async function runRunnerTool(opts: RunRunnerOptions): Promise<string> {
  if (process.env.MOCK_LLM === '1') {
    opts.onProgress?.({
      level: 'info',
      source: 'stdout',
      content: '[mock runner output]',
    })
    return '[mock runner result]'
  }

  const {
    name,
    prompt,
    cwd = process.cwd(),
    sessionContinueId,
    onProgress,
    acpBaseUrl,
    agentLogger,
  } = opts

  if (!prompt || !prompt.trim()) {
    throw new Error(`Runner "${name}" requires a non-empty prompt`)
  }

  // HTTP ACP runner: name format is "acp:<agent-name>"
  if (name.startsWith('acp:')) {
    const agentName = name.slice(4)
    const baseUrl =
      acpBaseUrl ?? process.env['ACP_BASE_URL'] ?? acp.DEFAULT_BASE_URL
    return acp.run(
      baseUrl,
      agentName,
      prompt,
      onProgress
        ? (chunk) =>
            onProgress({
              level: detectLevel(chunk),
              source: 'stdout',
              content: chunk.slice(0, 500),
            })
        : undefined
    )
  }

  // ACP stdio runner: 统一走 AcpStdioConnector
  const acpBackend = ACP_STDIO_BACKEND_MAP.get(name)
  if (acpBackend) {
    const conn = new AcpStdioConnector()
    if (agentLogger) conn.agentLogger = agentLogger
    await conn.connect({
      cmd: acpBackend.acpCmd,
      args: acpBackend.acpArgs,
      cwd,
    })
    conn.onStageEvent = (evt) => {
      onProgress?.({
        level: evt.type === 'end' && evt.success === false ? 'error' : 'info',
        source: 'stdout',
        content: evt.title,
        stageEvent: evt,
      })
    }
    conn.onThink = (text) => {
      onProgress?.({
        level: 'info',
        source: 'stdout',
        content: text,
        contentType: 'think',
      })
    }
    conn.onModelDetected = (modelId, modelName) => {
      onProgress?.({
        level: 'info',
        source: 'stdout',
        content: modelName ?? modelId,
        contentType: 'model',
      })
    }
    await conn.newSession(cwd, sessionContinueId)
    onProgress?.({
      level: 'info',
      source: 'stdout',
      content: prompt,
      contentType: 'prompt',
    })
    const result = await conn.sendPrompt(prompt, (text) => {
      onProgress?.({
        level: detectLevel(text),
        source: 'stdout',
        content: text,
      })
    })
    await conn.disconnect()
    return result
  }

  // 非 ACP 工具（spawn 方式）
  let cmd: string
  let args: string[]

  switch (name) {
    case 'githubCopilot': {
      cmd = 'gh'
      args = ['copilot', 'suggest', '-t', 'shell', prompt]
      break
    }
    case 'geminiCli': {
      cmd = 'gemini'
      args = ['-p', prompt]
      break
    }
    case 'aider': {
      cmd = 'aider'
      args = ['--message', prompt, '--yes']
      break
    }
    default:
      throw new Error(`Unknown runner: ${name}`)
  }

  return new Promise((resolve, reject) => {
    const chunks: string[] = []
    const proc = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })

    const onData = (source: ProgressMessage['source']) => (data: Buffer) => {
      const text = data.toString()
      chunks.push(text)
      const lines = text.split(/\r?\n/)
      for (const line of lines) {
        if (!line) continue
        onProgress?.({ level: detectLevel(line), source, content: line })
      }
    }

    proc.stdout?.on('data', onData('stdout'))
    proc.stderr?.on('data', onData('stderr'))

    proc.on('close', (code) => {
      const output = chunks.join('')
      if (code === 0) resolve(output)
      else
        reject(
          new Error(`${cmd} exited with code ${code}:\n${output.slice(-500)}`)
        )
    })

    proc.on('error', (err) => reject(err))
  })
}
