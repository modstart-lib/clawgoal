/**
 * ACP Stdio Connector
 *
 * 通过 stdio 管道与 ACP（Agent Communication Protocol）兼容的 CLI 工具通信。
 * 基于 @agentclientprotocol/sdk 的 ClientSideConnection + ndJsonStream 实现，
 * 支持 fs/read_text_file、fs/write_text_file、terminal 等全部协议能力。
 *
 * 调用流程：connect() → newSession() → sendPrompt() → disconnect()
 */

import { spawn, type ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { Readable, Writable } from 'stream'
import type pino from 'pino'
import { config } from '../../../backend/src/config/index.js'
import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type SessionNotification,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
  type CreateTerminalRequest,
  type CreateTerminalResponse,
  type TerminalOutputRequest,
  type TerminalOutputResponse,
  type WaitForTerminalExitRequest,
  type WaitForTerminalExitResponse,
  type KillTerminalRequest,
  type KillTerminalResponse,
  type ReleaseTerminalRequest,
  type ReleaseTerminalResponse,
  TerminalHandle,
} from '@agentclientprotocol/sdk'
import { createNamedLogger } from '../../../backend/src/utils/logger.js'

const logger = createNamedLogger('connect')

/** 剥离 ANSI/VT 转义序列（终端颜色、光标控制等）
 *  按 ECMA-48 完整覆盖：CSI / OSC / 其他双字节 ESC 序列
 *  参数字节范围 [\x30-\x3f] 包含 < = > ? 等所有合法字节
 */
function stripAnsi(str: string): string {
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /\x1b(?:\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g,
    ''
  )
}

export type AcpUpdateCallback = (text: string) => void

export interface AcpStageEvent {
  type: 'start' | 'end'
  title: string
  success?: boolean
}

export type AcpStageEventCallback = (evt: AcpStageEvent) => void
export type AcpThinkCallback = (text: string) => void

export interface AcpSpawnOptions {
  /** CLI 可执行文件，如 'opencode' 或 'claude' */
  cmd: string
  /** ACP 模式参数，如 ['acp'] 或 ['--experimental-acp'] */
  args: string[]
  /** 子进程工作目录 */
  cwd: string
  /** 附加环境变量（合并到 process.env） */
  env?: Record<string, string>
}

// ─── 终端管理 ────────────────────────────────────────────────────────────────

type ManagedTerminal = {
  process: ChildProcess
  outputChunks: Buffer[]
  exitCode: number | null
  signal: string | null
  resolve: (resp: WaitForTerminalExitResponse) => void
}

// ─── 主类 ────────────────────────────────────────────────────────────────────

export class AcpStdioConnector {
  private child: ChildProcess | null = null
  private connection: ClientSideConnection | null = null
  private sessionId: string | null = null
  private accumulatedText = ''
  private onUpdate: AcpUpdateCallback | null = null
  private toolCallTitles = new Map<string, string>()
  private terminals = new Map<string, ManagedTerminal>()
  /** think token watchdog: accumulated total think chars in current prompt */
  private _thinkCharTotal = 0
  /** think token watchdog: last 200 chars seen, used for repetition detection */
  private _thinkTail = ''
  /** Max think chars before treating as stuck and disconnecting (default 20 KB) */
  static MAX_THINK_CHARS = 20_000

  onStageEvent: AcpStageEventCallback | null = null
  onThink: AcpThinkCallback | null = null
  onModelDetected: ((modelId: string, modelName?: string) => void) | null = null
  agentLogger: pino.Logger | null = null

  /** 启动 ACP CLI 子进程并完成 initialize 握手。 */
  async connect(opts: AcpSpawnOptions): Promise<void> {
    const env = { ...process.env, ...(opts.env ?? {}) }

    let finalCmd: string
    let finalArgs: string[]

    if (process.platform === 'win32') {
      finalCmd = opts.cmd
      finalArgs = opts.args
    } else {
      // Use bash -l to ensure user profile paths (like ~/.local/bin) are loaded
      finalCmd = 'bash'
      const bashScript = `exec ${opts.cmd} "$@"`
      finalArgs = ['-l', '-c', bashScript, '--', ...opts.args]
    }

    const child = spawn(finalCmd, finalArgs, {
      cwd: opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    })

    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve)
      child.once('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          const isZhAcp = config.lang !== 'en-US'
          reject(
            new Error(
              `'${opts.cmd}' ${isZhAcp ? '命令未找到，请先安装该工具。' : 'command not found, please install the tool first.'}`
            )
          )
        } else {
          reject(err)
        }
      })
    })

    child.stderr?.on('data', (data: Buffer) => {
      const msg = `[ACP ${opts.cmd}] ${data.toString().trimEnd()}`
      logger.warn(msg)
      this.agentLogger?.warn(msg)
    })

    const input = Writable.toWeb(child.stdin!)
    const output = Readable.toWeb(child.stdout!) as ReadableStream<Uint8Array>
    const stream = ndJsonStream(input, output)

    const connection = new ClientSideConnection(
      () => ({
        sessionUpdate: async (params: SessionNotification) => {
          this._handleSessionUpdate(params)
        },
        requestPermission: async (
          params: RequestPermissionRequest
        ): Promise<RequestPermissionResponse> => {
          // 自动允许所有权限（yolo 模式）
          const allowOpt =
            params.options.find((o) => o.kind === 'allow_once') ??
            params.options[0]
          return {
            outcome: {
              outcome: 'selected',
              optionId: allowOpt?.optionId ?? 'allow_once',
            },
          }
        },
        readTextFile: async (
          params: ReadTextFileRequest
        ): Promise<ReadTextFileResponse> => {
          const filePath = params.path
          const isZhRead = config.lang !== 'en-US'
          const readTitle = `${isZhRead ? '读取文件' : 'Read file'} ${filePath}`
          this.onStageEvent?.({ type: 'start', title: readTitle })
          try {
            let content = await fs.readFile(filePath, 'utf-8')
            if (
              typeof params.line === 'number' &&
              typeof params.limit === 'number'
            ) {
              const lines = content.split('\n')
              content = lines
                .slice(params.line - 1, params.line - 1 + params.limit)
                .join('\n')
            }
            this.onStageEvent?.({
              type: 'end',
              title: readTitle,
              success: true,
            })
            return { content }
          } catch (err) {
            this.onStageEvent?.({
              type: 'end',
              title: readTitle,
              success: false,
            })
            throw err
          }
        },
        writeTextFile: async (
          params: WriteTextFileRequest
        ): Promise<WriteTextFileResponse> => {
          const filePath = params.path
          const isZhWrite = config.lang !== 'en-US'
          const writeTitle = `${isZhWrite ? '写入文件' : 'Write file'} ${filePath}`
          this.onStageEvent?.({ type: 'start', title: writeTitle })
          try {
            await fs.mkdir(path.dirname(filePath), { recursive: true })
            await fs.writeFile(filePath, params.content, 'utf-8')
            this.onStageEvent?.({
              type: 'end',
              title: writeTitle,
              success: true,
            })
            return {}
          } catch (err) {
            this.onStageEvent?.({
              type: 'end',
              title: writeTitle,
              success: false,
            })
            throw err
          }
        },
        createTerminal: async (
          params: CreateTerminalRequest
        ): Promise<CreateTerminalResponse> => {
          return this._createTerminal(params)
        },
        terminalOutput: async (
          params: TerminalOutputRequest
        ): Promise<TerminalOutputResponse> => {
          return this._terminalOutput(params)
        },
        waitForTerminalExit: async (
          params: WaitForTerminalExitRequest
        ): Promise<WaitForTerminalExitResponse> => {
          return this._waitForTerminalExit(params)
        },
        killTerminal: async (
          params: KillTerminalRequest
        ): Promise<KillTerminalResponse> => {
          return this._killTerminal(params)
        },
        releaseTerminal: async (
          params: ReleaseTerminalRequest
        ): Promise<ReleaseTerminalResponse> => {
          return this._releaseTerminal(params)
        },
      }),
      stream
    )

    await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
    })

    this.child = child
    this.connection = connection
  }

  // ─── session/update 分发 ──────────────────────────────────────────────────

  private _handleSessionUpdate(params: SessionNotification): void {
    const update = params.update
    if (!('sessionUpdate' in update)) return

    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        if (update.content?.type === 'text') {
          const text = stripAnsi(update.content.text)
          this.accumulatedText += text
          this.onUpdate?.(text)
        }
        break
      }
      case 'agent_thought_chunk': {
        if (update.content?.type === 'text') {
          const text = stripAnsi(update.content.text)
          // ── think watchdog: detect infinite-loop token repetition ──
          this._thinkCharTotal += text.length
          this._thinkTail = (this._thinkTail + text).slice(-200)
          if (this._thinkCharTotal >= AcpStdioConnector.MAX_THINK_CHARS) {
            logger.warn(
              `[ACP think-watchdog] think output exceeded ${AcpStdioConnector.MAX_THINK_CHARS} chars — killing stuck process`
            )
            this.agentLogger?.warn(
              `[ACP think-watchdog] think output exceeded ${AcpStdioConnector.MAX_THINK_CHARS} chars — killing stuck process`
            )
            void this.disconnect()
            return
          }
          this.onThink?.(text)
        }
        break
      }
      case 'tool_call':
      case 'tool_call_update': {
        const toolCallId = update.toolCallId
        const status = update.status ?? undefined
        const kind = update.kind ?? ''
        const title = update.title ?? ''
        const locations = (update.locations ?? []) as Array<{ path: string }>
        const rawInput = (update.rawInput ?? {}) as Record<string, unknown>

        if ((status === 'in_progress' || status === 'pending') && toolCallId) {
          const stageTitle = this._buildToolCallTitle(
            kind,
            title,
            locations,
            rawInput
          )
          this.toolCallTitles.set(toolCallId, stageTitle)
          this.onStageEvent?.({ type: 'start', title: stageTitle })
        } else if (
          (status === 'completed' || status === 'failed') &&
          toolCallId
        ) {
          const stageTitle = this.toolCallTitles.get(toolCallId) ?? title
          this.toolCallTitles.delete(toolCallId)
          this.onStageEvent?.({
            type: 'end',
            title: stageTitle,
            success: status === 'completed',
          })
        }
        break
      }
      default:
        break
    }
  }

  private _buildToolCallTitle(
    kind: string,
    title: string,
    locations: Array<{ path: string }>,
    rawInput: Record<string, unknown>
  ): string {
    const p =
      locations[0]?.path ??
      (rawInput['filePath'] as string | undefined) ??
      title
    const isZhStage = config.lang !== 'en-US'
    if (kind === 'read') return `${isZhStage ? '读取文件' : 'Read file'} ${p}`
    if (kind === 'edit') return `${isZhStage ? '写入文件' : 'Write file'} ${p}`
    if (kind === 'run')
      return `${isZhStage ? '执行命令' : 'Run command'} ${title}`
    return title || kind
  }

  // ─── 终端处理 ────────────────────────────────────────────────────────────

  private async _createTerminal(
    params: CreateTerminalRequest
  ): Promise<CreateTerminalResponse> {
    const terminalId = TerminalHandle.generate()
    const env: NodeJS.ProcessEnv = { ...process.env }
    for (const e of params.env ?? []) {
      env[e.name] = e.value
    }
    const proc = spawn(params.command, params.args ?? [], {
      cwd: this.child
        ? (this.child as ChildProcess & { spawnargs?: string[] }).spawnargs?.[0]
        : process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const terminal: ManagedTerminal = {
      process: proc,
      outputChunks: [],
      exitCode: null,
      signal: null,
      resolve: () => {},
    }
    const exitPromise = new Promise<WaitForTerminalExitResponse>((resolve) => {
      terminal.resolve = resolve
    })

    const onData = (chunk: Buffer) => terminal.outputChunks.push(chunk)
    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)
    proc.once('close', (code, signal) => {
      terminal.exitCode = code
      terminal.signal = signal
      terminal.resolve({
        exitCode: code ?? -1,
        signal: signal ?? undefined,
      })
    })

    terminal['_exitPromise'] = exitPromise
    this.terminals.set(terminalId, terminal)
    await new Promise<void>((r) => setImmediate(r))
    return { terminalId }
  }

  private async _terminalOutput(
    params: TerminalOutputRequest
  ): Promise<TerminalOutputResponse> {
    const terminal = this.terminals.get(params.terminalId)
    if (!terminal) return { output: '' }
    const output = Buffer.concat(terminal.outputChunks).toString('utf-8')
    terminal.outputChunks = []
    return { output: output.slice(-(params.maxBytes ?? 65536)) }
  }

  private async _waitForTerminalExit(
    params: WaitForTerminalExitRequest
  ): Promise<WaitForTerminalExitResponse> {
    const terminal = this.terminals.get(params.terminalId)
    if (!terminal) return { exitCode: -1 }
    const result = await (terminal[
      '_exitPromise'
    ] as Promise<WaitForTerminalExitResponse>)
    return result
  }

  private async _killTerminal(
    params: KillTerminalRequest
  ): Promise<KillTerminalResponse> {
    const terminal = this.terminals.get(params.terminalId)
    if (terminal && !terminal.process.killed) {
      terminal.process.kill('SIGTERM')
    }
    return {}
  }

  private async _releaseTerminal(
    params: ReleaseTerminalRequest
  ): Promise<ReleaseTerminalResponse> {
    const terminal = this.terminals.get(params.terminalId)
    if (terminal) {
      if (!terminal.process.killed) terminal.process.kill('SIGTERM')
      this.terminals.delete(params.terminalId)
    }
    return {}
  }

  // ─── 会话 API ────────────────────────────────────────────────────────────

  /** 创建新会话（或恢复已有会话）。 */
  async newSession(cwd: string, resumeSessionId?: string): Promise<void> {
    if (!this.connection)
      throw new Error(
        config.lang !== 'en-US'
          ? 'ACP 连接未建立，请先调用 connect()'
          : 'ACP connection not established, call connect() first'
      )
    const params: Record<string, unknown> = { cwd, mcpServers: [] }
    if (resumeSessionId) params.resumeSessionId = resumeSessionId
    const resp = await this.connection.newSession(
      params as Parameters<typeof this.connection.newSession>[0]
    )
    this.sessionId = resp.sessionId

    // 提取当前模型信息并通知调用方
    const models = resp.models
    if (models?.currentModelId) {
      const currentModelId = models.currentModelId
      const modelInfo = models.availableModels?.find(
        (m) => m.modelId === currentModelId
      )
      this.onModelDetected?.(currentModelId, modelInfo?.name)
    }
  }

  /** 向当前会话发送提示词，等待完成并返回累积的文本输出。 */
  async sendPrompt(
    prompt: string,
    onUpdate?: AcpUpdateCallback
  ): Promise<string> {
    if (!this.connection || !this.sessionId)
      throw new Error(
        config.lang !== 'en-US'
          ? '没有活跃的 ACP 会话，请先调用 newSession()'
          : 'No active ACP session, call newSession() first'
      )

    this.onUpdate = onUpdate ?? null
    this.accumulatedText = ''
    this._thinkCharTotal = 0
    this._thinkTail = ''

    try {
      await this.connection.prompt({
        sessionId: this.sessionId,
        prompt: [{ type: 'text', text: prompt }],
      })
    } finally {
      this.onUpdate = null
    }

    return this.accumulatedText
  }

  /** 终止子进程并清理所有状态。 */
  async disconnect(): Promise<void> {
    for (const terminal of this.terminals.values()) {
      if (!terminal.process.killed) terminal.process.kill('SIGTERM')
    }
    this.terminals.clear()

    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM')
    }
    this.child = null
    this.connection = null
    this.sessionId = null
    this.accumulatedText = ''
    this.toolCallTitles.clear()
  }

  get isConnected(): boolean {
    return this.child !== null && !this.child.killed
  }
}
