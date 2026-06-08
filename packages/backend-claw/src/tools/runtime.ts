/**
 * Runtime management tools.
 *
 * Six tools expose runtime capabilities to agents:
 *
 *   runtime_list        — list all runtimes with id, name, title, status and available runners
 *   runtime_execute     — dispatch a runner task to a specific runtime and wait for result
 *   runtime_system_info — get system information from a runtime
 *   runtime_shell       — execute a shell command on a runtime
 *   runtime_file_read   — read a file from a runtime
 *   runtime_file_write  — write a file to a runtime
 */

import * as os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { generateId } from '../../../backend/src/utils/utils.js'
import { safeJsonParse } from '../../../backend/src/utils/json.js'
import { getClawRuntimeWs } from '../index.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { localRuntimeController } from '../runtime/localController.js'
import { WsRuntimeController } from '../runtime/wsController.js'
import { clawDb } from '../storage/store/index.js'
import type { RunnerInfo, RuntimeRow } from '../storage/store/types.js'
import {
  type ToolContext,
  type ToolDefinition,
  type ToolResult,
} from '../types/index.js'

/** 将可能含换行的字符串序列化为单行日志（JSON 转义，避免打断日志行） */
function logSnippet(s: string | undefined | null, maxLen?: number): string {
  const t = s ?? ''
  return JSON.stringify(maxLen !== undefined ? t.slice(0, maxLen) : t)
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`
}

type RuntimeShellExecResult = {
  success: boolean
  output: string
  exitCode: number
  error?: string
}

async function executeRuntimeShellCommand(
  runtime_name: string,
  command: string,
  context: ToolContext,
  options?: {
    cwd?: string
    timeout_seconds?: number
    maxOutputChars?: number
  }
): Promise<RuntimeShellExecResult> {
  const { cwd, timeout_seconds, maxOutputChars } = options ?? {}

  if (runtime_name === 'local') {
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'cmd' : 'sh'
    const shellArgs = isWindows ? ['/c', command] : ['-c', command]
    const result = spawnSync(shell, shellArgs, {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf8',
      timeout: (timeout_seconds ?? 60) * 1_000,
      maxBuffer: 2 * 1024 * 1024,
    })
    const rawOutput = (result.stdout ?? '') + (result.stderr ?? '')
    const output =
      maxOutputChars !== undefined && rawOutput.length > maxOutputChars
        ? rawOutput.slice(0, maxOutputChars) +
          `\n... (truncated, ${rawOutput.length} chars total)`
        : rawOutput
    const exitCode = result.status ?? 0
    return {
      success: exitCode === 0,
      output,
      exitCode,
      ...(exitCode !== 0 ? { error: `exit code: ${exitCode}` } : {}),
    }
  }

  const dbRuntime = clawDb.findRuntimeByName(
    context.agentContext.tenantId,
    context.agentContext.userId,
    runtime_name
  )
  if (!dbRuntime) {
    return {
      success: false,
      output: '',
      exitCode: 1,
      error: `Runtime "${runtime_name}" not found.`,
    }
  }
  if (dbRuntime.status !== 'online') {
    return {
      success: false,
      output: '',
      exitCode: 1,
      error: `Runtime "${dbRuntime.title}" (name=${runtime_name}) is currently offline.`,
    }
  }

  const result = await getClawRuntimeWs().requestShell(
    dbRuntime.id,
    command,
    cwd,
    (timeout_seconds ?? 60) * 1_000
  )
  if (result.error && result.output === undefined) {
    return {
      success: false,
      output: '',
      exitCode: result.exitCode ?? 1,
      error: result.error,
    }
  }

  const rawOutput = result.output ?? ''
  const output =
    maxOutputChars !== undefined && rawOutput.length > maxOutputChars
      ? rawOutput.slice(0, maxOutputChars) +
        `\n... (truncated, ${rawOutput.length} chars total)`
      : rawOutput
  const exitCode = result.exitCode ?? 0
  return {
    success: exitCode === 0,
    output,
    exitCode,
    ...(exitCode !== 0 ? { error: `exit code: ${exitCode}` } : {}),
  }
}

async function collectGitRepos(
  cwd: string,
  runtime_name: string,
  context: ToolContext
): Promise<Array<{ repoKey: string; repoPath: string }>> {
  const repoCmd = [
    `ROOT=${shellQuote(cwd)}`,
    'if [ -d "$ROOT/.git" ]; then printf "<codespace>\\t%s\\n" "$ROOT"; fi',
    'find "$ROOT" -mindepth 1 -maxdepth 1 -type d | while IFS= read -r d; do',
    '  if [ -d "$d/.git" ]; then printf "%s\\t%s\\n" "$(basename "$d")" "$d"; fi',
    'done',
  ].join('\n')
  const result = await executeRuntimeShellCommand(
    runtime_name,
    repoCmd,
    context,
    {
      cwd,
      timeout_seconds: 30,
    }
  )
  if (!result.success || !result.output.trim()) return []

  return result.output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [repoKey, repoPath] = line.split('\t')
      return repoKey && repoPath ? { repoKey, repoPath } : null
    })
    .filter((entry): entry is { repoKey: string; repoPath: string } =>
      Boolean(entry)
    )
}

// ─── runtime_list ───────────────────────────────────────────────────────────

async function runtimeList(
  args: { status?: string },
  context: ToolContext
): Promise<ToolResult> {
  const { userId, tenantId } = context.agentContext
  const dbRuntimes = clawDb.findAllRuntimes(tenantId, userId)

  // 本机运行环境始终排第一
  const localRow = await localRuntimeController.getRuntimeRow(tenantId, userId)
  const allRuntimes: RuntimeRow[] = [localRow, ...dbRuntimes]

  const filtered = args.status
    ? allRuntimes.filter((c) => c.status === args.status)
    : allRuntimes

  if (filtered.length === 0) {
    const hint = args.status
      ? `No ${args.status} runtimes found.`
      : 'No runtimes configured yet.'
    return { success: true, output: hint }
  }

  const cell = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-'
  const header = '| name | title | status | active_at | runners |'
  const sep = '|---|---|---|---|---|'
  const rows = filtered.map((c) => {
    const statusIcon = c.status === 'online' ? '🟢' : '🔴'
    const activeAt =
      c.id === 0
        ? '本机'
        : c.active_at
          ? new Date(c.active_at).toLocaleString()
          : '-'
    let runnerStr = '(not synced)'
    if (c.runners) {
      const runners: RunnerInfo[] = safeJsonParse(
        c.runners,
        [],
        'runtime.runners'
      )
      runnerStr =
        runners.length > 0
          ? runners
              .filter((e) => e.enable !== false)
              .map((e) => `${e.name}(${e.title})`)
              .join(', ') || '(all disabled)'
          : '(none)'
    }
    return `| ${cell(c.name)} | ${cell(c.title)} | ${statusIcon} | ${activeAt} | ${cell(runnerStr)} |`
  })

  return {
    success: true,
    output: [
      `Found ${filtered.length} runtime(s):`,
      '',
      header,
      sep,
      ...rows,
    ].join('\n'),
  }
}

// ─── runtime_execute ───────────────────────────────────────────────────────

async function runtimeExecute(
  args: {
    runtime_name: string
    runner_name: string
    prompt: string
    session_id?: string
    cwd: string
    timeout_seconds?: number
  },
  context: ToolContext
): Promise<ToolResult> {
  const {
    runtime_name,
    runner_name,
    prompt,
    session_id,
    cwd,
    timeout_seconds,
  } = args

  context.agentContext.logger.debug(
    `runtime_execute called: runner=${runner_name} runtime_name=${runtime_name} cwd=${cwd} prompt_len=${(prompt ?? '').length} prompt_preview=${logSnippet(prompt, 120)}`
  )

  // 校验 cwd 非空
  if (!cwd || !cwd.trim()) {
    return {
      success: false,
      output: '',
      error:
        'cwd (working directory) must not be empty. Please provide the absolute path to the project directory.',
    }
  }

  // 校验 prompt 非空
  if (!prompt || !prompt.trim()) {
    return {
      success: false,
      output: '',
      error:
        'prompt must not be empty. Please provide a task description or message for the runner.',
    }
  }

  // 扫描 codespace 的 git 仓库并注入 prompt 头部
  const repoEntries = await collectGitRepos(cwd, runtime_name, context)
  const repoLines = repoEntries.map(
    (repo) =>
      `- ${repo.repoKey === '<codespace>' ? '(root)' : repo.repoKey}: ${repo.repoPath}`
  )

  // 如果当前处于任务上下文，将任务 title 和 description 拼接到 prompt 前面
  let fullPrompt = prompt
  if (repoLines.length > 0) {
    const repoBlock = [
      '## Codespace Git Repositories',
      'Work inside the appropriate repository below based on the task.',
      'Do NOT write files directly to the codespace root unless no subdirectory repo matches.',
      ...repoLines,
      '---',
    ].join('\n')
    fullPrompt = repoBlock + '\n' + fullPrompt
  }

  if (context.agentContext.taskId) {
    const taskRow = clawDb.findTaskById(context.agentContext.taskId)
    if (taskRow) {
      const headerLines: string[] = [`任务：${taskRow.title}`]
      if (taskRow.description) headerLines.push(`描述：${taskRow.description}`)
      headerLines.push('---')
      fullPrompt = headerLines.join('\n') + '\n' + fullPrompt
    }
  }

  // 解析目标运行环境
  let runtime: RuntimeRow
  let controller: WsRuntimeController | typeof localRuntimeController

  if (runtime_name === 'local') {
    runtime = await localRuntimeController.getRuntimeRow(
      context.agentContext.tenantId,
      context.agentContext.userId
    )
    controller = localRuntimeController
  } else {
    const dbRuntime = clawDb.findRuntimeByName(
      context.agentContext.tenantId,
      context.agentContext.userId,
      runtime_name
    )
    if (!dbRuntime) {
      return {
        success: false,
        output: '',
        error: `Runtime "${runtime_name}" not found.`,
      }
    }
    if (dbRuntime.status !== 'online') {
      return {
        success: false,
        output: '',
        error: `Runtime "${dbRuntime.title}" (name=${runtime_name}) is currently offline.`,
      }
    }
    runtime = dbRuntime
    controller = new WsRuntimeController(dbRuntime.id)
  }

  // 检查 runner 是否存在且已启用
  let runners: RunnerInfo[] = []
  if (runtime.runners) {
    runners = safeJsonParse(runtime.runners, [], 'runtime.runners')
  }
  const runner = runners.find((e) => e.name === runner_name)
  if (!runner) {
    const available = runners.map((e) => e.name).join(', ') || '(none)'
    return {
      success: false,
      output: '',
      error: `Runner "${runner_name}" not found on runtime "${runtime.title}". Available: ${available}`,
    }
  }

  const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const timeoutMs = (timeout_seconds ?? 3600 * 10) * 1_000

  // 下发任务
  context.agentContext.logger.debug(
    `Dispatching runner task: sessionId=${sessionId} runner=${runner_name} runtime=${runtime.title} cwd=${cwd ?? '(unset)'} prompt=${logSnippet(fullPrompt, 200)}`
  )
  const sent = await controller.sendExecute(sessionId, {
    name: runner_name,
    prompt: fullPrompt,
    sessionContinueId: session_id,
    cwd,
    agentLogger: context.agentContext.logger,
  })
  if (!sent) {
    return {
      success: false,
      output: '',
      error: `Failed to send task to runtime "${runtime.title}" (name=${runtime_name}). Socket may have disconnected.`,
    }
  }

  // 累积 prompt / message 内容，合并到最终输出
  let promptContent = ''
  let messageContent = ''

  // ── 执行过程步骤追踪（推送到 UI 的 steps 字段）──────────────────────────
  const agentId = context.agentContext.agentId
  const chatId = context.agentContext.taskId ?? 0
  const toolCallId = context.toolCallId ?? ''
  type StepItem = {
    id: string
    title: string
    status: 'running' | 'success' | 'error'
    content: string
  }
  const steps: StepItem[] = []
  // 思考内容累积缓冲区（合并碎片，避免每个词片段都触发 UI 更新）
  let thinkBuffer = ''
  let thinkLastEmitLen = 0
  const emitProgress = (step: StepItem, meta?: Record<string, any>) => {
    if (!agentId) return
    void clawEventBus.emit('tool:progress', {
      agentId,
      chatId,
      toolName: 'runtime',
      toolCallId,
      stepId: step.id,
      stepTitle: step.title,
      stepStatus: step.status,
      stepContent: step.content,
      meta,
    })
  }

  // 立即发送会话步骤，并将 sessionId 写入 stageItem.meta
  {
    const isNewSession = !session_id
    const sessionNote = isNewSession
      ? `开启会话 ID=${sessionId}`
      : `恢复会话 ID=${session_id}`
    const sessionStep: StepItem = {
      id: generateId(),
      title: sessionNote,
      status: 'success',
      content: '',
    }
    steps.push(sessionStep)
    emitProgress(sessionStep, { sessionId })
  }

  try {
    await getClawRuntimeWs().waitForSession(
      sessionId,
      (event) => {
        if (event.type === 'started') {
          context.agentContext.logger.debug(
            `Runner started: sessionId=${sessionId} name=${runner_name}`
          )
          steps.push({
            id: generateId(),
            title: `${runner_name} 已启动`,
            status: 'success',
            content: runtime.title,
          })
          emitProgress(steps[steps.length - 1]!)
        } else if (event.type === 'progress') {
          if (event.progressType === 'prompt' && event.message) {
            promptContent = event.message
          } else if (event.progressType === 'think' && event.message) {
            // 累积思考内容到缓冲区（合并碎片），节流推送到 UI
            thinkBuffer += event.message
            let thinkIdx = -1
            for (let i = steps.length - 1; i >= 0; i--) {
              if (steps[i]!.title === 'AI 思考中') {
                thinkIdx = i
                break
              }
            }
            // 使用完整缓冲内容（实时追加展示，不截断）
            const thinkPreview = thinkBuffer
            if (thinkIdx >= 0) {
              steps[thinkIdx] = {
                ...steps[thinkIdx]!,
                status: 'running',
                content: thinkPreview,
              }
              // 每积累 80+ 字符才推送一次，避免逐词刷新 UI
              if (thinkBuffer.length - thinkLastEmitLen >= 80) {
                thinkLastEmitLen = thinkBuffer.length
                emitProgress(steps[thinkIdx]!)
              }
            } else {
              steps.push({
                id: generateId(),
                title: 'AI 思考中',
                status: 'running',
                content: thinkPreview,
              })
              thinkLastEmitLen = thinkBuffer.length
              emitProgress(steps[steps.length - 1]!)
            }
          } else if (event.progressType === 'model' && event.message) {
            context.agentContext.logger.info(
              `[${runner_name}] model: ${event.message}`
            )
            const modelStep: StepItem = {
              id: generateId(),
              title: `使用模型: ${event.message}`,
              status: 'success',
              content: event.message,
            }
            steps.push(modelStep)
            emitProgress(modelStep)
          } else if (event.progressType === 'message' && event.message) {
            messageContent += event.message
          } else if (event.progressType === 'fileRead' && event.message) {
            if (event.fileOp === 'start') {
              context.agentContext.logger.info(
                `Runner file op start: sessionId=${sessionId} title=${logSnippet(event.message)}`
              )
              steps.push({
                id: generateId(),
                title: '读取文件',
                status: 'running',
                content: event.message,
              })
              emitProgress(steps[steps.length - 1]!)
            } else if (event.fileOp === 'end') {
              context.agentContext.logger.info(
                `Runner file op end: sessionId=${sessionId} title=${logSnippet(event.message)} success=${event.fileSuccess}`
              )
              for (let i = steps.length - 1; i >= 0; i--) {
                if (
                  steps[i]!.title === '读取文件' &&
                  steps[i]!.content === event.message &&
                  steps[i]!.status === 'running'
                ) {
                  steps[i] = {
                    ...steps[i]!,
                    status: event.fileSuccess !== false ? 'success' : 'error',
                    content: event.message,
                  }
                  emitProgress(steps[i]!)
                  break
                }
              }
            }
          } else if (event.progressType === 'fileWrite' && event.message) {
            if (event.fileOp === 'start') {
              context.agentContext.logger.info(
                `Runner file op start: sessionId=${sessionId} title=${logSnippet(event.message)}`
              )
              steps.push({
                id: generateId(),
                title: '写入文件',
                status: 'running',
                content: event.message,
              })
              emitProgress(steps[steps.length - 1]!)
            } else if (event.fileOp === 'end') {
              context.agentContext.logger.info(
                `Runner file op end: sessionId=${sessionId} title=${logSnippet(event.message)} success=${event.fileSuccess}`
              )
              for (let i = steps.length - 1; i >= 0; i--) {
                if (
                  steps[i]!.title === '写入文件' &&
                  steps[i]!.content === event.message &&
                  steps[i]!.status === 'running'
                ) {
                  steps[i] = {
                    ...steps[i]!,
                    status: event.fileSuccess !== false ? 'success' : 'error',
                    content: event.message,
                  }
                  emitProgress(steps[i]!)
                  break
                }
              }
            }
          } else if (event.progressType === 'other' && event.message) {
            messageContent += event.message
          }
        } else if (event.type === 'success') {
          // event.message 为 runner 返回的最终消息内容
          if (event.message && !messageContent) {
            messageContent = event.message
          }
          context.agentContext.logger.info(
            `Runner success: sessionId=${sessionId} name=${runner_name}`
          )
          if (thinkBuffer) {
            context.agentContext.logger.debug(
              `[${runner_name}] think: ${logSnippet(thinkBuffer, 300)}`
            )
          }
          if (messageContent) {
            context.agentContext.logger.info(
              `[${runner_name}] output: ${logSnippet(messageContent, 300)}`
            )
          }
          // 将所有 running 步骤标记为成功，think 步骤写入完整缓冲内容
          for (let i = 0; i < steps.length; i++) {
            if (steps[i]!.status === 'running') {
              const isThink = steps[i]!.title === 'AI 思考中'
              steps[i] = {
                ...steps[i]!,
                status: 'success',
                content: isThink ? thinkBuffer : steps[i]!.content,
              }
              emitProgress(steps[i]!)
            }
          }
        } else if (event.type === 'fail') {
          context.agentContext.logger.warn(
            `Runner fail: sessionId=${sessionId} name=${runner_name} message=${logSnippet(event.message ?? '')}`
          )
          // 将所有 running 步骤标记为错误，think 步骤写入完整缓冲内容
          for (let i = 0; i < steps.length; i++) {
            if (steps[i]!.status === 'running') {
              const isThink = steps[i]!.title === 'AI 思考中'
              steps[i] = {
                ...steps[i]!,
                status: 'error',
                content: isThink ? thinkBuffer : steps[i]!.content,
              }
              emitProgress(steps[i]!)
            }
          }
        }
      },
      timeoutMs
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    context.agentContext.logger.error(
      `Runner session error: sessionId=${sessionId} error=${logSnippet(msg)}`
    )
    return {
      success: false,
      output: '',
      error: `Runner "${runner_name}" 超时或异常: ${msg}`,
    }
  }

  const outputLines: string[] = []
  outputLines.push(
    `**Session ID** (pass as \`session_id\` to resume this session): ${sessionId}`
  )
  if (promptContent) {
    outputLines.push(`**Prompt:**\n${promptContent}`)
  }
  if (messageContent) {
    outputLines.push(messageContent)
  }

  if (outputLines.length === 1) {
    outputLines.push(
      `✅ Runner "${runner_name}" 在运行环境 "${runtime.title}" 执行完成。`
    )
  }

  return {
    success: true,
    output: outputLines.join('\n\n'),
  }
}

// ─── runtime_system_info ────────────────────────────────────────────────────────

async function runtimeSystemInfo(
  args: { runtime_name: string },
  context: ToolContext
): Promise<ToolResult> {
  const { runtime_name } = args

  if (runtime_name === 'local') {
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
    return { success: true, output: info }
  }

  const dbRuntime = clawDb.findRuntimeByName(
    context.agentContext.tenantId,
    context.agentContext.userId,
    runtime_name
  )
  if (!dbRuntime) {
    return {
      success: false,
      output: '',
      error: `Runtime "${runtime_name}" not found.`,
    }
  }
  if (dbRuntime.status !== 'online') {
    return {
      success: false,
      output: '',
      error: `Runtime "${dbRuntime.title}" (name=${runtime_name}) is currently offline.`,
    }
  }

  const result = await getClawRuntimeWs().requestSystemInfo(dbRuntime.id)
  if (result.error) {
    return { success: false, output: '', error: result.error }
  }
  return { success: true, output: result.info ?? '' }
}

// ─── runtime_shell ───────────────────────────────────────────────────────────────

async function runtimeShell(
  args: {
    runtime_name: string
    command: string
    cwd?: string
    timeout_seconds?: number
  },
  context: ToolContext
): Promise<ToolResult> {
  const { runtime_name, command, cwd, timeout_seconds } = args

  if (!command || !command.trim()) {
    return { success: false, output: '', error: 'command must not be empty.' }
  }

  const result = await executeRuntimeShellCommand(
    runtime_name,
    command,
    context,
    {
      cwd,
      timeout_seconds,
      maxOutputChars: 10_000,
    }
  )
  let output = result.output
  if (!output || output.trim() === '') {
    output = 'Command executed successfully. (No output)'
  }
  return {
    success: result.success,
    output,
    ...(result.success
      ? {}
      : { error: result.error ?? `exit code: ${result.exitCode}` }),
  }
}

// ─── runtime_file_read ───────────────────────────────────────────────────────

const MAX_FILE_SIZE = 256 * 1024 // 256 KB

async function runtimeFileRead(
  args: {
    runtime_name: string
    path: string
    startLine?: number
    endLine?: number
    maxLimits?: number
  },
  context: ToolContext
): Promise<ToolResult> {
  const { runtime_name, path: filePath, startLine, endLine, maxLimits } = args

  if (!filePath || !filePath.trim()) {
    return { success: false, output: '', error: 'path must not be empty.' }
  }

  if (runtime_name === 'local') {
    try {
      const resolvedPath = path.resolve(filePath)
      const stat = await fs.stat(resolvedPath)
      const sl = startLine ?? -1
      const el = endLine ?? -1
      const ml =
        maxLimits !== undefined ? Math.min(maxLimits, 10000) : undefined
      const useLineRange = sl !== -1 || el !== -1

      if (!useLineRange && stat.size > MAX_FILE_SIZE) {
        return {
          success: false,
          output: '',
          error: `File too large: ${stat.size} bytes. Use startLine/endLine to read in parts.`,
        }
      }

      let content: string
      if (useLineRange) {
        const raw = await fs.readFile(resolvedPath, 'utf8')
        const lines = raw.split('\n')
        const from = sl !== -1 ? sl - 1 : 0
        const to = el !== -1 ? el : lines.length
        content = lines.slice(from, to).join('\n')
      } else {
        content = await fs.readFile(resolvedPath, 'utf8')
      }

      if (ml !== undefined && content.length > ml) {
        return {
          success: false,
          output: '',
          error: `Content length ${content.length} exceeds maxLimits ${ml}. Use startLine/endLine to read in parts.`,
        }
      }
      return { success: true, output: content }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        output: '',
        error: `runtime_file_read failed: ${msg}`,
      }
    }
  }

  const dbRuntime = clawDb.findRuntimeByName(
    context.agentContext.tenantId,
    context.agentContext.userId,
    runtime_name
  )
  if (!dbRuntime) {
    return {
      success: false,
      output: '',
      error: `Runtime "${runtime_name}" not found.`,
    }
  }
  if (dbRuntime.status !== 'online') {
    return {
      success: false,
      output: '',
      error: `Runtime "${dbRuntime.title}" (name=${runtime_name}) is currently offline.`,
    }
  }

  const result = await getClawRuntimeWs().requestFileRead(
    dbRuntime.id,
    filePath,
    { startLine, endLine, maxLimits }
  )
  if (result.error) {
    return { success: false, output: '', error: result.error }
  }
  return { success: true, output: result.content ?? '' }
}

// ─── runtime_file_write ──────────────────────────────────────────────────────

async function runtimeFileWrite(
  args: {
    runtime_name: string
    path: string
    content: string
    append?: string
  },
  context: ToolContext
): Promise<ToolResult> {
  const { runtime_name, path: filePath, content, append } = args

  if (!filePath || !filePath.trim()) {
    return { success: false, output: '', error: 'path must not be empty.' }
  }
  if (content === undefined || content === null) {
    return { success: false, output: '', error: 'content must not be null.' }
  }

  const isAppend = append === 'true'

  if (runtime_name === 'local') {
    try {
      const resolvedPath = path.resolve(filePath)
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true })
      const flag = isAppend ? 'a' : 'w'
      await fs.writeFile(resolvedPath, content, { encoding: 'utf8', flag })
      const action = isAppend ? 'appended' : 'written'
      return {
        success: true,
        output: `Successfully ${action} ${content.length} characters to ${resolvedPath}`,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        output: '',
        error: `runtime_file_write failed: ${msg}`,
      }
    }
  }

  const dbRuntime = clawDb.findRuntimeByName(
    context.agentContext.tenantId,
    context.agentContext.userId,
    runtime_name
  )
  if (!dbRuntime) {
    return {
      success: false,
      output: '',
      error: `Runtime "${runtime_name}" not found.`,
    }
  }
  if (dbRuntime.status !== 'online') {
    return {
      success: false,
      output: '',
      error: `Runtime "${dbRuntime.title}" (name=${runtime_name}) is currently offline.`,
    }
  }

  const result = await getClawRuntimeWs().requestFileWrite(
    dbRuntime.id,
    filePath,
    content,
    isAppend
  )
  if (result.error) {
    return { success: false, output: '', error: result.error }
  }
  const action = isAppend ? 'appended' : 'written'
  return {
    success: true,
    output: `Successfully ${action} ${content.length} characters to ${filePath}`,
  }
}

// ─── runtime_grep ───────────────────────────────────────────────────────────

const GREP_MAX_LINES = 50

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/\?/g, '[^/\\\\]')
  return new RegExp(escaped + '$', 'i')
}

async function collectFiles(
  dir: string,
  recursive: boolean,
  includeRegex: RegExp | null,
  results: string[]
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && recursive) {
      await collectFiles(full, recursive, includeRegex, results)
    } else if (entry.isFile()) {
      if (!includeRegex || includeRegex.test(entry.name)) {
        results.push(full)
      }
    }
  }
}

async function runtimeGrep(
  args: {
    runtime_name: string
    pattern: string
    path: string
    recursive?: string
    ignoreCase?: string
    include?: string
  },
  context: ToolContext
): Promise<ToolResult> {
  const {
    runtime_name,
    pattern,
    path: searchPath,
    recursive,
    ignoreCase,
    include,
  } = args

  if (!pattern || !searchPath) {
    return {
      success: false,
      output: '',
      error: 'pattern and path are required.',
    }
  }

  if (runtime_name === 'local') {
    try {
      const resolvedPath = path.resolve(searchPath)
      const isRecursive = recursive !== 'false'
      const flags = ignoreCase === 'true' ? 'i' : ''
      const regex = new RegExp(pattern, flags)
      const includeRegex = include ? globToRegex(include) : null

      const stat = await fs.stat(resolvedPath)
      const files: string[] = []
      if (stat.isFile()) {
        files.push(resolvedPath)
      } else if (stat.isDirectory()) {
        await collectFiles(resolvedPath, isRecursive, includeRegex, files)
      }

      const results: string[] = []
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i]!)) {
              results.push(`${file}:${i + 1}:${lines[i]}`)
            }
          }
        } catch {
          // skip unreadable files
        }
      }

      if (results.length === 0) {
        return { success: true, output: '(no matches)' }
      }

      if (results.length > GREP_MAX_LINES) {
        return {
          success: true,
          output: `Results truncated to ${GREP_MAX_LINES} lines (${results.length} total):\n${results.slice(0, GREP_MAX_LINES).join('\n')}`,
        }
      }

      return { success: true, output: results.join('\n') }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        output: '',
        error: `runtime_grep failed: ${msg}`,
      }
    }
  }

  const dbRuntime = clawDb.findRuntimeByName(
    context.agentContext.tenantId,
    context.agentContext.userId,
    runtime_name
  )
  if (!dbRuntime) {
    return {
      success: false,
      output: '',
      error: `Runtime "${runtime_name}" not found.`,
    }
  }
  if (dbRuntime.status !== 'online') {
    return {
      success: false,
      output: '',
      error: `Runtime "${dbRuntime.title}" (name=${runtime_name}) is currently offline.`,
    }
  }

  const result = await getClawRuntimeWs().requestGrep(
    dbRuntime.id,
    pattern,
    searchPath,
    {
      recursive: recursive !== 'false',
      ignoreCase: ignoreCase === 'true',
      include,
    }
  )
  if (result.error) {
    return { success: false, output: '', error: result.error }
  }
  return { success: true, output: result.output ?? '(no matches)' }
}

// ─── Individual tool definitions ─────────────────────────────────────────────

export const runtimeListDefinition: ToolDefinition = {
  name: 'runtime_list',
  description:
    'List all runtimes with id, name, title, status and available runners.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter: online / offline / omit=all',
      },
    },
    required: [],
  },
}

export const runtimeExecuteDefinition: ToolDefinition = {
  name: 'runtime_execute',
  description:
    'Delegate ALL coding/file tasks to an AI Studio. Set prompt with full requirements; set runner_name to an AI Studio name from runtime_list (e.g. opencode, claudeCode). NEVER set command here.',
  parameters: {
    type: 'object',
    properties: {
      runtime_name: {
        type: 'string',
        description: "Runtime name (from runtime_list; 'local' = localhost)",
      },
      runner_name: {
        type: 'string',
        description:
          'AI Studio runner name from runtime_list (e.g. opencode, claudeCode, githubCopilot). Must match an available runner — NEVER use bash/sh/shell.',
      },
      prompt: {
        type: 'string',
        description:
          'Full task description for the AI Studio. Include all file paths, requirements and context. Do NOT set command when using runtime_execute.',
      },
      session_id: {
        type: 'string',
        description: 'Session ID (opencode only); omit for new',
      },
      cwd: {
        type: 'string',
        description:
          'Absolute working directory path (the project root to run the task in)',
      },
      timeout_seconds: {
        type: 'number',
        description: 'Timeout seconds (default 300)',
      },
    },
    required: ['runtime_name', 'runner_name', 'prompt', 'cwd'],
  },
}

export const runtimeSystemInfoDefinition: ToolDefinition = {
  name: 'runtime_system_info',
  description: 'Get system information (OS, CPU, memory, disk) from a runtime.',
  parameters: {
    type: 'object',
    properties: {
      runtime_name: {
        type: 'string',
        description: "Runtime name (from runtime_list; 'local' = localhost)",
      },
    },
    required: ['runtime_name'],
  },
}

export const runtimeShellDefinition: ToolDefinition = {
  name: 'runtime_shell',
  description:
    'Run git and process commands on a runtime (e.g. git status, git commit, npm install). ' +
    'NEVER use this tool to read files — use runtime_file_read instead. ' +
    'NEVER use this tool to write files — use runtime_file_write instead. ' +
    'NEVER use this tool to search for strings in files — use runtime_grep instead.',
  parameters: {
    type: 'object',
    properties: {
      runtime_name: {
        type: 'string',
        description: "Runtime name (from runtime_list; 'local' = localhost)",
      },
      command: {
        type: 'string',
        description: 'Shell command to run on the runtime',
      },
      cwd: { type: 'string', description: 'Working directory (optional)' },
      timeout_seconds: {
        type: 'number',
        description: 'Timeout seconds (default 60)',
      },
    },
    required: ['runtime_name', 'command'],
  },
}

export const runtimeFileReadDefinition: ToolDefinition = {
  name: 'runtime_file_read',
  description:
    'Read a file from a runtime. Use startLine/endLine to read a specific range when the file is large.',
  parameters: {
    type: 'object',
    properties: {
      runtime_name: {
        type: 'string',
        description: "Runtime name (from runtime_list; 'local' = localhost)",
      },
      path: {
        type: 'string',
        description: 'Absolute file path on the runtime',
      },
      startLine: {
        type: 'number',
        description: 'Start line number (1-based, omit to read from beginning)',
      },
      endLine: {
        type: 'number',
        description: 'End line number (1-based, omit to read to end)',
      },
      maxLimits: {
        type: 'number',
        description:
          'Max characters to return (capped at 10000 when set). Omit to return full content without character limit.',
      },
    },
    required: ['runtime_name', 'path'],
  },
}

export const runtimeFileWriteDefinition: ToolDefinition = {
  name: 'runtime_file_write',
  description:
    'Write or append content to a file on a runtime. Use for configuration/text files only. For code changes use runtime_execute.',
  parameters: {
    type: 'object',
    properties: {
      runtime_name: {
        type: 'string',
        description: "Runtime name (from runtime_list; 'local' = localhost)",
      },
      path: {
        type: 'string',
        description: 'Absolute file path on the runtime',
      },
      content: {
        type: 'string',
        description: 'Content to write',
      },
      append: {
        type: 'string',
        description: "'true' to append instead of overwrite",
        enum: ['true', 'false'],
      },
    },
    required: ['runtime_name', 'path', 'content'],
  },
}

export const runtimeGrepDefinition: ToolDefinition = {
  name: 'runtime_grep',
  description:
    'Search for a pattern in files on a runtime. Returns file:line:content matches.',
  parameters: {
    type: 'object',
    properties: {
      runtime_name: {
        type: 'string',
        description: "Runtime name (from runtime_list; 'local' = localhost)",
      },
      pattern: {
        type: 'string',
        description: 'Search pattern (regex or literal string)',
      },
      path: {
        type: 'string',
        description: 'Absolute file or directory path to search in',
      },
      recursive: {
        type: 'string',
        description: "'true' to search recursively in directory (default true)",
        enum: ['true', 'false'],
      },
      ignoreCase: {
        type: 'string',
        description: "'true' to ignore case (default false)",
        enum: ['true', 'false'],
      },
      include: {
        type: 'string',
        description: "Glob pattern for files to include (e.g. '*.ts')",
      },
    },
    required: ['runtime_name', 'pattern', 'path'],
  },
}

export {
  runtimeList,
  runtimeExecute,
  runtimeSystemInfo,
  runtimeShell,
  runtimeFileRead,
  runtimeFileWrite,
  runtimeGrep,
}
