/**
 * clawgoal connector --url <ws-url>
 *
 * Standalone connector client that does NOT start the backend HTTP server.
 * Connects to a remote backend via WebSocket, discovers local runner
 * tools and executes runRunner requests on demand.
 *
 * Protocol (socket.io events):
 *   Server → Client:  connected, pong, syncRunner, runRunner
 *   Client → Server:  ping, syncRunner, runRunnerStarted,
 *                     runRunnerProgress, runRunnerSuccess, runRunnerFail
 */

import { spawnSync, execSync } from 'child_process'
import { readdirSync, existsSync } from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Command } from 'commander'
import { io, type Socket } from 'socket.io-client'
import {
  discoverRunners,
  runRunnerTool,
  type RunnerInfo,
} from '../connect/index.js'

export type { RunnerInfo }

// ─── Runtime Client ─────────────────────────────────────────────────────────

class RuntimeCli {
  private socket: Socket | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private readonly baseUrl: string
  private readonly path: string
  private readonly token: string

  constructor(rawUrl: string, token: string) {
    const u = new URL(rawUrl)
    this.baseUrl = `${u.protocol}//${u.host}`
    this.path = u.pathname || '/api/websocket/runtime'
    this.token = token
  }

  start(): void {
    this.stopped = false
    this._connect()
  }

  private _connect(): void {
    if (this.stopped) return

    console.log(`[runtime] Connecting to ${this.baseUrl}${this.path} ...`)

    this.socket = io(this.baseUrl, {
      path: this.path,
      transports: ['websocket'],
      reconnection: false,
    })

    this.socket.on('connect', () => {
      console.log(`[runtime] Socket connected (id=${this.socket?.id})`)
      this.socket?.emit('auth', { token: this.token })
    })

    this.socket.on('authSuccess', () => {
      console.log('[runtime] Auth success')
    })

    this.socket.on(
      'connected',
      (data: { runtimeId: number; title: string }) => {
        console.log(
          `[runtime] Registered as runtime id=${data.runtimeId} title="${data.title}"`
        )
        console.log('[runtime] Status: ONLINE')
        this._startPing()
      }
    )

    // Server → client: request runner list
    this.socket.on('syncRunner', async () => {
      const runners = await discoverRunners()
      console.log(
        `[runtime] Discovered ${runners.length} runner(s): ${runners.map((c) => c.name).join(', ') || '(none)'}`
      )
      this.socket?.emit('syncRunner', { runners })
    })

    // Server → client: pong response
    this.socket.on('pong', () => {
      // heartbeat acknowledged — no-op
    })

    // Server → client: run a runner
    this.socket.on(
      'runRunner',
      async (data: {
        sessionId: string
        name: string
        prompt: string
        sessionContinueId?: string
        cwd?: string
      }) => {
        const { sessionId, name, prompt, sessionContinueId, cwd } = data
        console.log(
          `[runtime] runRunner: sessionId=${sessionId} name=${name} prompt=${(prompt ?? '').slice(0, 80)}`
        )

        if (!prompt || !prompt.trim()) {
          const errMsg = `Runner "${name}" requires a non-empty prompt`
          console.error(
            `[runtime] runRunner rejected: sessionId=${sessionId} ${errMsg}`
          )
          this.socket?.emit('runRunnerFail', { sessionId, message: errMsg })
          return
        }

        this.socket?.emit('runRunnerStarted', { sessionId })

        try {
          const output = await runRunnerTool({
            name,
            prompt,
            cwd,
            sessionContinueId,
            onProgress: (msg) => {
              if (!msg) return
              if (msg.stageEvent) {
                let progressType: 'fileRead' | 'fileWrite' | 'other' = 'other'
                let filePath: string | undefined
                const readMatch = msg.stageEvent.title.match(/^读取文件 (.+)$/)
                const writeMatch = msg.stageEvent.title.match(/^写入文件 (.+)$/)
                if (readMatch) {
                  progressType = 'fileRead'
                  filePath = readMatch[1]
                } else if (writeMatch) {
                  progressType = 'fileWrite'
                  filePath = writeMatch[1]
                }
                this.socket?.emit('runRunnerProgress', {
                  sessionId,
                  progressType,
                  message: msg.stageEvent.title,
                  fileOp: msg.stageEvent.type,
                  filePath,
                  fileSuccess: msg.stageEvent.success,
                })
              } else if (msg.contentType === 'think') {
                this.socket?.emit('runRunnerProgress', {
                  sessionId,
                  progressType: 'think',
                  message: msg.content,
                })
              } else if (msg.contentType === 'model') {
                this.socket?.emit('runRunnerProgress', {
                  sessionId,
                  progressType: 'model',
                  message: msg.content,
                })
              } else if (msg.contentType === 'prompt') {
                this.socket?.emit('runRunnerProgress', {
                  sessionId,
                  progressType: 'prompt',
                  message: msg.content,
                })
              } else {
                console.log(
                  `[runtime][${name}][${msg.source}][${msg.level}] ${msg.content}`
                )
                this.socket?.emit('runRunnerProgress', {
                  sessionId,
                  progressType: 'message',
                  message: msg.content,
                  level: msg.level,
                  source: msg.source,
                })
              }
            },
          })
          // 生成 git diff，让服务端知道本次执行改动了哪些文件
          // codespace 下可能含多个 git 仓库子目录，需逐一采集
          try {
            const rootCwd = cwd ?? process.cwd()
            let repoDirs: { name: string; path: string }[]
            try {
              const entries = readdirSync(rootCwd, { withFileTypes: true })
              const gitSubdirs = entries
                .filter((e) => e.isDirectory())
                .filter((e) => existsSync(path.join(rootCwd, e.name, '.git')))
              if (gitSubdirs.length > 0) {
                // 有子仓库时扫描子仓库；若 rootCwd 本身也是 git 仓库则一并包含
                repoDirs = gitSubdirs.map((e) => ({
                  name: e.name,
                  path: path.join(rootCwd, e.name),
                }))
                if (existsSync(path.join(rootCwd, '.git'))) {
                  repoDirs.unshift({
                    name: '<codespace>',
                    path: rootCwd,
                  })
                }
              } else {
                repoDirs = [{ name: '<codespace>', path: rootCwd }]
              }
            } catch {
              repoDirs = [{ name: '<codespace>', path: rootCwd }]
            }
            const diffs: Record<string, string> = {}
            for (const repo of repoDirs) {
              const diffResult = spawnSync('git', ['diff', 'HEAD'], {
                cwd: repo.path,
                encoding: 'utf8',
                timeout: 10_000,
              })
              const content =
                diffResult.status === 0 ? (diffResult.stdout ?? '') : ''
              if (content.trim()) {
                diffs[repo.name] = content
              }
            }
            if (Object.keys(diffs).length > 0) {
              const totalChars = Object.values(diffs).reduce(
                (s, d) => s + d.length,
                0
              )
              this.socket?.emit('runRunnerProgress', {
                sessionId,
                progressType: 'diff',
                message: JSON.stringify(diffs),
              })
              console.log(
                `[runtime] runRunner diff sent: ${Object.keys(diffs).length} repos, ${totalChars} chars total`
              )
            }
          } catch {
            // git diff 失败时静默忽略（非 git 目录等情况）
          }

          const summary = output.trim().slice(0, 2000)
          this.socket?.emit('runRunnerSuccess', {
            sessionId,
            message: summary,
          })
          console.log(`[runtime] runRunner success: sessionId=${sessionId}`)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          this.socket?.emit('runRunnerFail', {
            sessionId,
            message: message.slice(0, 500),
          })
          console.error(
            `[runtime] runRunner fail: sessionId=${sessionId} ${message}`
          )
        }
      }
    )

    // Server → client: query system information
    this.socket.on('systemInfoRequest', (data: { requestId: string }) => {
      const requestId = data?.requestId
      try {
        const cpus = os.cpus()
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const toMB = (b: number) => (b / 1024 / 1024).toFixed(1)
        const info = [
          `hostname: ${os.hostname()}`,
          `platform: ${os.platform()} (${os.type()} ${os.release()})`,
          `arch: ${os.arch()}`,
          `uptime: ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
          `cpus: ${cpus.length}x ${cpus[0]?.model ?? 'unknown'}`,
          `memory: total=${toMB(totalMem)}MB free=${toMB(freeMem)}MB used=${toMB(totalMem - freeMem)}MB`,
        ].join('\n')
        this.socket?.emit('systemInfoResult', { requestId, info })
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        this.socket?.emit('systemInfoResult', { requestId, error })
      }
    })

    // Server → client: execute shell command
    this.socket.on(
      'shellRequest',
      (data: { requestId: string; command: string; cwd?: string }) => {
        const { requestId, command, cwd } = data ?? {}
        try {
          const isWindows = process.platform === 'win32'
          const shell = isWindows ? 'cmd' : 'sh'
          const shellArgs = isWindows ? ['/c', command] : ['-c', command]
          const result = spawnSync(shell, shellArgs, {
            cwd: cwd ?? process.cwd(),
            encoding: 'utf8',
            timeout: 60_000,
            maxBuffer: 2 * 1024 * 1024,
          })
          const rawOutput = (result.stdout ?? '') + (result.stderr ?? '')
          const MAX = 10_000
          let output =
            rawOutput.length > MAX
              ? rawOutput.slice(0, MAX) +
                `\n... (truncated, ${rawOutput.length} chars total)`
              : rawOutput
          if (!output || output.trim() === '') {
            output = 'Command executed successfully. (No output)'
          }
          this.socket?.emit('shellResult', {
            requestId,
            output,
            exitCode: result.status ?? 0,
          })
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          this.socket?.emit('shellResult', { requestId, error })
        }
      }
    )

    this.socket.on('connect_error', (err: Error) => {
      console.warn(`[runtime] Connection error: ${err.message}`)
      this._scheduleReconnect()
    })

    this.socket.on('disconnect', (reason: string) => {
      console.warn(`[runtime] Disconnected: ${reason}`)
      console.log('[runtime] Status: OFFLINE')
      this._stopPing()
      this._scheduleReconnect()
    })
  }

  private _startPing(): void {
    this._stopPing()
    this.pingTimer = setInterval(() => {
      this.socket?.emit('ping', {})
    }, 30_000)
  }

  private _stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private _scheduleReconnect(): void {
    if (this.stopped) return
    if (this.reconnectTimer !== null) return
    console.log('[runtime] Reconnecting in 5s ...')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this._connect()
    }, 5_000)
  }

  stop(): void {
    this.stopped = true
    this._stopPing()
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    console.log('[runtime] Stopped')
  }
}

// ─── Standalone entry (for interactive menu) ────────────────────────────────

export function performConnect(url: string, token: string): void {
  const client = new RuntimeCli(url, token)
  client.start()

  const shutdown = () => {
    client.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  process.stdin.resume()
}

// ─── Commander Registration ───────────────────────────────────────────────────

export function registerRuntimeCommand(program: Command): void {
  program
    .command('connect <url>')
    .description(
      'Connect to backend (no local server needed). e.g. clawgoal --token <token> connect http://host/api/websocket/runtime'
    )
    .option('--list-runners', 'Print discovered local runners and exit')
    .action(
      async (url: string, opts: { listRunners?: boolean }, cmd: Command) => {
        // --list-runners: just print discovered tools and exit
        if (opts.listRunners) {
          const runners = await discoverRunners()
          if (runners.length === 0) {
            console.log('No runner tools found.')
          } else {
            console.log('Discovered runners:')
            for (const c of runners) {
              console.log(`  ${c.name.padEnd(18)} ${c.title}`)
            }
          }
          process.exit(0)
        }

        const token: string = cmd.parent?.opts()?.token ?? ''
        if (!token) {
          console.error(
            'Error: --token <token> is required. e.g. clawgoal --token <token> connect <url>'
          )
          process.exit(1)
        }
        performConnect(url, token)
      }
    )
}
