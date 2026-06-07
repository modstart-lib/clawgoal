/**
 * shell tool: executes a shell command and returns stdout/stderr.
 * Output is streamed directly to a temp file to avoid memory pressure.
 * Only available to roles that have shell in their capabilities.
 */

import { spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { config } from '../../../backend/src/config/index.js'
import {
  buildShellEnv,
  getShellEnvMeta,
} from '../../../backend/src/utils/shellEnv.js'
import {
  generateTempFile,
  summaryFile,
} from '../../../backend/src/utils/file.js'
import { getAgentWorkspacePath } from '../kernel/workspace.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

const TIMEOUT_MS = 30_000

/**
 * 执行命令并将 stdout/stderr 流式写入 logPath，全程不在内存中积累完整输出。
 * 返回进程退出码。
 */
async function execToFile(
  command: string,
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
  logPath: string
): Promise<{ exitCode: number }> {
  return new Promise((resolve, reject) => {
    const outStream = createWriteStream(logPath)
    const child = spawn('sh', ['-c', command], {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout.on('data', (chunk: Buffer) => outStream.write(chunk))
    child.stderr.on('data', (chunk: Buffer) => outStream.write(chunk))

    let timer: ReturnType<typeof setTimeout> | undefined
    if (options.timeoutMs) {
      timer = setTimeout(() => {
        child.kill()
        outStream.end(`\n[timed out after ${options.timeoutMs! / 1000}s]`, () =>
          reject(
            new Error(`Command timed out after ${options.timeoutMs! / 1000}s`)
          )
        )
      }, options.timeoutMs)
    }

    child.on('error', (err) => {
      if (timer) clearTimeout(timer)
      outStream.end(`\n[spawn error: ${err.message}]`, () => reject(err))
    })

    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      const exitNote = code !== 0 ? `\n[exit code: ${code}]` : ''
      outStream.end(exitNote, () => resolve({ exitCode: code ?? 0 }))
    })
  })
}

export const shellExecDefinition: ToolDefinition = {
  name: 'shell',
  description:
    'Execute Shell commands and return the result. Exercise caution for high-risk actions. For file reading use file_read tool, for file writing use file_write tool.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory',
      },
    },
    required: ['command'],
  },
}

export async function shellExec(
  args: { command: string; cwd?: string },
  context?: ToolContext
): Promise<ToolResult> {
  if (args.cwd && !existsSync(args.cwd)) {
    return {
      success: false,
      output: '',
      error: `shell failed: cwd does not exist: ${args.cwd}`,
    }
  }

  try {
    const shellEnv = await buildShellEnv()
    const { extraPaths, userEnvKeys } = await getShellEnvMeta(
      config.supervisorUserId
    )

    const pathInfo = extraPaths.length > 0 ? extraPaths.join(':') : '(none)'
    const maskedEnv = [...userEnvKeys]
      .filter(Boolean)
      .map((k) => `${k}=**`)
      .join(', ')

    const infoLines = [
      `[ENV] cwd: ${args.cwd ?? process.cwd()}`,
      `[ENV] extra PATH: ${pathInfo}`,
      `[ENV] custom env: ${maskedEnv || '(none)'}`,
    ].join('\n')

    const tmpDir = context?.agentContext?.agentId
      ? await getAgentWorkspacePath({
          agentId: context.agentContext.agentId,
          dir: 'tmp',
        })
      : undefined
    const logPath = generateTempFile(tmpDir)
    const { exitCode } = await execToFile(
      args.command,
      { cwd: args.cwd, env: shellEnv, timeoutMs: TIMEOUT_MS },
      logPath
    )

    const { display, isTruncated } = await summaryFile(logPath)

    const suffix = isTruncated ? `\n完整日志 ${logPath}` : ''

    return {
      success: exitCode === 0,
      output: `${infoLines}\n---\n${display}${suffix}`,
      ...(exitCode !== 0 ? { error: `exit code: ${exitCode}` } : {}),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `shell failed: ${msg}` }
  }
}
