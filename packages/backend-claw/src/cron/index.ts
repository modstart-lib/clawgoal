/**
 * Cron scheduler for the bot system.
 *
 * Task definitions are persisted in the SQLite database (claw_cron table).
 *
 * Supported cron expression syntax (5-part):
 *   minute  hour  dayOfMonth  month  dayOfWeek
 *   e.g.  "0 9 * * *"       = 9:00am every day
 *         "*\/5 * * * *"   = every 5 minutes
 *         "0 9,18 * * 1"   = 9am and 6pm every Monday
 *
 * Each tick resolves at the start of every minute — the scheduler fires all
 * tasks whose cron expression matches the current wall-clock minute.
 */

import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolvePath } from '../../../backend/src/config/env.js'
import {
  config,
  getModelConfigList,
} from '../../../backend/src/config/index.js'
import { modelCall } from '../../../backend/src/model/model/index.js'
import { matchesCron } from '../../../backend/src/utils/cron.js'
import { jsonParse } from '../../../backend/src/utils/json.js'
import { summaryFile } from '../../../backend/src/utils/file.js'
import { generateTempLogPath } from '../../../backend/src/utils/logger.js'
import {
  buildShellEnv,
  getShellEnvMeta,
} from '../../../backend/src/utils/shellEnv.js'
import { agentManager } from '../agent/index.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import { processMessage } from '../kernel/model.js'
import type { CronRow, UpdateCronInput } from '../storage/store/index.js'
import { clawDb } from '../storage/store/index.js'
import type { AgentContext } from '../types/index.js'
import { clawMessage } from '../types/index.js'
import { getAgentLogger } from '../utils/logger.js'
import { createNewSession } from '../storage/sessionManager.js'
import { t } from '../locale/index.js'

const logger = createLogger('cron')

// ─── Types ─────────────────────────────────────────────────────────────────────────────

/** cron 任务执行配置 */
export interface CronConfig {
  /** 执行类型: shell=直接运行命令, agent=发送给 Agent Agent */
  type: 'shell' | 'agent'
  /** type=shell 时的 shell 命令 */
  shell?: string
  /** type=shell 时的工作目录（可选） */
  workdir?: string
  /** type=agent 时发送给 Agent 的工作记录 */
  agent?: string
}

export interface CronTask {
  /** Unique task ID (database autoincrement) */
  id: number
  /** Corp/tenant id this cron task belongs to */
  tenantId: number
  /** SaaS user id this cron task belongs to */
  userId: number
  /** Human-readable display name */
  title: string
  /** Optional description of what this task does */
  description: string | null
  /**
   * Standard 5-part cron expression:  min hour dom month dow
   * Examples:
   *   "0 9 * * *"     — 9:00am every day
   *   "0,30 * * * *"  — every 30 minutes
   *   "0 8 * * 1-5"   — 8am Monday–Friday
   */
  cron: string
  /**
   * Agent id，对应 claw_agent 表的 id
   */
  agentId: number
  /** Prompt sent to the bot member at execution time. */
  prompt: string
  /** 执行配置（type=shell|agent） */
  config: CronConfig | null
  /** Whether this task is active */
  enable: boolean
  /** Fire once then auto-disable (run_once=true means one-time reminder) */
  runOnce: boolean
  /** Whether this task should run; one-time tasks are set to false after execution */
  shouldRun: boolean
  /** UTC ISO 8601 timestamp of the next scheduled execution */
  nextRunAt: string | null
  /** ISO 8601 timestamp of the last execution */
  lastRunAt: string | null
  /** 上次执行结果（由大模型汇总） */
  lastResult: string | null
  /** 成功时是否发送消息通知 */
  successNotify: boolean
  /** ISO 8601 timestamp when this task was created */
  createdAt: string
}

/** Map a raw DB row to the CronTask view */
function rowToTask(row: CronRow): CronTask {
  let cronConfig: CronConfig | null = null
  if (row.config) {
    try {
      cronConfig = jsonParse(row.config) as CronConfig
    } catch {
      /* ignore */
    }
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    cron: row.cron,
    agentId: row.agent_id,
    prompt: row.prompt,
    config: cronConfig,
    enable: row.enable === 1,
    runOnce: row.run_once === 1,
    shouldRun: row.should_run === 1,
    successNotify: row.success_notify === 1,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastResult: row.last_result,
    createdAt: row.created_at,
  }
}

// ─── Cron log file helpers ───────────────────────────────────────────────────

/** Sanitize a task title for use as a filename segment */
function sanitizeForFilename(name: string): string {
  return name
    .replace(/[^\w\u4e00-\u9fa5-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50)
}

/**
 * Write full cron execution log to data/logs/cron/<name>_YYYYMMDDHHmmss.log
 * Returns the resolved file path.
 */
function writeCronLogFile(
  taskTitle: string,
  taskId: number,
  logLines: string[],
  now: Date
): string {
  const logDir = resolvePath(config.logPath, 'cron')
  mkdirSync(logDir, { recursive: true })
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const safeName = sanitizeForFilename(taskTitle)
  const filePath = join(logDir, `${safeName}_${ts}.log`)
  const header =
    `# Cron Task Log\n` +
    `# Task  : ${taskTitle} (id=${taskId})\n` +
    `# Time  : ${now.toISOString()}\n\n`
  writeFileSync(filePath, header + logLines.join('\n'), 'utf8')
  return filePath
}

// ─── Cron expression helpers ──────────────────────────────────────────────────

// matchesCron is imported from shared backend utils (packages/backend/src/utils/cron.ts)
// and re-exported here for backwards compatibility with other claw modules.
export { matchesCron } from '../../../backend/src/utils/cron.js'

/**
 * Compute the next UTC execution time for the given cron expression, starting
 * AFTER `fromUtc`.  The expression is evaluated in the user's configured local
 * time (config.timezone offset).  Returns a UTC ISO 8601 string, or null if no
 * match is found within one year.
 */
export function nextRunDateUtc(
  expression: string,
  fromUtc: Date
): string | null {
  const tzOffsetMs = config.timezone * 60 * 60 * 1000
  // Convert to local time and advance to the next full minute
  const fromLocal = new Date(fromUtc.getTime() + tzOffsetMs)
  fromLocal.setUTCSeconds(0, 0)
  fromLocal.setUTCMinutes(fromLocal.getUTCMinutes() + 1)

  const limitLocal = new Date(fromLocal.getTime() + 366 * 24 * 60 * 60 * 1000)
  const candidate = new Date(fromLocal.getTime())
  while (candidate <= limitLocal) {
    if (matchesCron(expression, candidate)) {
      // Convert the matching local time back to UTC
      return new Date(candidate.getTime() - tzOffsetMs).toISOString()
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)
  }
  return null
}

// ─── CronManager ─────────────────────────────────────────────────────────────

export class CronManager {
  private intervalId?: ReturnType<typeof setInterval>
  /** Tracks the last minute we ticked so we never double-fire within the same minute */
  private lastTickMinute = -1

  /** cronId → true: currently executing */
  private runningCronIds = new Set<number>()
  /** cronId → shell log file path (only for shell-type tasks during execution) */
  private runningShellLogFiles = new Map<number, string>()

  isRunning(cronId: number): boolean {
    return this.runningCronIds.has(cronId)
  }

  getRunningLogFile(cronId: number): string | null {
    return this.runningShellLogFiles.get(cronId) ?? null
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  /** No-op: tasks are persisted in the DB; just log task count on startup. */
  async load(): Promise<void> {
    const tasks = clawDb.findAllEnabledCrons()
    logger.info(`Cron: found ${tasks.length} task(s) in database`)
  }

  // ─── Scheduler lifecycle ─────────────────────────────────────────────────

  /** Start the per-minute tick loop. Call after load(). */
  start(): void {
    if (this.intervalId) {
      logger.warn('CronManager already started')
      return
    }
    const msUntilNextMinute =
      (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds()
    setTimeout(() => {
      this._tick()
      this.intervalId = setInterval(() => this._tick(), 60_000)
    }, msUntilNextMinute)
    logger.info(
      `Cron scheduler started — first tick in ${Math.round(msUntilNextMinute / 1000)}s`
    )
  }

  /** Stop the tick loop. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      logger.info('Cron scheduler stopped')
    }
  }

  // ─── Task CRUD ───────────────────────────────────────────────────────────

  listTasks(tenantId: number, userId: number): CronTask[] {
    return clawDb.findAllCrons(tenantId, userId).map(rowToTask)
  }

  listTasksByAgentId(
    tenantId: number,
    userId: number,
    agentId: number
  ): CronTask[] {
    return clawDb.findCronsByAgentId(tenantId, userId, agentId).map(rowToTask)
  }

  getTask(id: number): CronTask | undefined {
    const row = clawDb.findCronById(id)
    return row ? rowToTask(row) : undefined
  }

  /** Add a new cron task. Returns the created task. */
  async addTask(
    tenantId: number,
    userId: number,
    opts: Omit<
      CronTask,
      | 'id'
      | 'tenantId'
      | 'userId'
      | 'createdAt'
      | 'lastRunAt'
      | 'lastResult'
      | 'nextRunAt'
      | 'shouldRun'
      | 'successNotify'
    > & { enable?: boolean; successNotify?: boolean }
  ): Promise<CronTask> {
    const nextRunAt = nextRunDateUtc(opts.cron, new Date())
    const row = clawDb.insertCron({
      tenantId,
      userId,
      title: opts.title,
      cron: opts.cron,
      enable: opts.enable !== false,
      agentId: opts.agentId,
      description: opts.description ?? undefined,
      prompt: opts.prompt,
      config: opts.config ?? undefined,
      runOnce: opts.runOnce,
      nextRunAt: nextRunAt ?? undefined,
      successNotify: opts.successNotify,
    })
    const task = rowToTask(row)
    logger.info(
      `Cron task added: "${task.title}" (id=${task.id}) cron="${task.cron}" runOnce=${task.runOnce} nextRunAt=${task.nextRunAt}`
    )
    return task
  }

  /**
   * Update fields on an existing task (partial patch).
   * Returns the updated task, or null if not found.
   */
  async updateTask(
    id: number,
    updates: Partial<Omit<CronTask, 'id' | 'createdAt'>>
  ): Promise<CronTask | null> {
    const existing = clawDb.findCronById(id)
    if (!existing) return null

    const dbUpdates: UpdateCronInput = {}
    if (updates.title !== undefined) dbUpdates.title = updates.title
    if (updates.cron !== undefined) {
      dbUpdates.cron = updates.cron
      // Recalculate next_run_at when cron expression changes
      dbUpdates.nextRunAt = nextRunDateUtc(updates.cron, new Date())
    }
    if (updates.enable !== undefined) dbUpdates.enable = updates.enable
    if (updates.agentId !== undefined) dbUpdates.agentId = updates.agentId
    if (updates.description !== undefined)
      dbUpdates.description = updates.description ?? undefined
    if (updates.prompt !== undefined) dbUpdates.prompt = updates.prompt
    if (updates.config !== undefined)
      dbUpdates.config = updates.config ?? undefined
    if (updates.lastRunAt !== undefined)
      dbUpdates.lastRunAt = updates.lastRunAt ?? undefined
    if (updates.nextRunAt !== undefined) dbUpdates.nextRunAt = updates.nextRunAt
    if (updates.shouldRun !== undefined) dbUpdates.shouldRun = updates.shouldRun
    if (updates.successNotify !== undefined)
      dbUpdates.successNotify = updates.successNotify
    if (updates.lastResult !== undefined)
      dbUpdates.lastResult = updates.lastResult ?? undefined

    clawDb.updateCron(id, dbUpdates)
    const updated = clawDb.findCronById(id)!
    logger.info(`Cron task updated: "${updated.title}" (id=${id})`)
    return rowToTask(updated)
  }

  /** Delete a task. Returns true if it existed. */
  async deleteTask(id: number): Promise<boolean> {
    const row = clawDb.findCronById(id)
    if (!row) return false
    clawDb.deleteCron(id)
    logger.info(`Cron task deleted: "${row.title}" (id=${id})`)
    return true
  }

  /**
   * Immediately trigger a task once, ignoring its cron schedule and enable status.
   * Returns false if the task is not found.
   */
  async runTaskNow(id: number): Promise<boolean> {
    const row = clawDb.findCronById(id)
    if (!row) return false
    logger.info(`Manual trigger: "${row.title}" (id=${id})`)
    this._runTask(rowToTask(row), new Date()).catch((err) =>
      logger.error({ err }, `Manual trigger "${row.title}" (id=${id}) failed`)
    )
    return true
  }

  // ─── Execution ───────────────────────────────────────────────────────────

  /** Called every minute — checks which tasks should run and fires them. */
  private _tick(): void {
    const nowUtc = new Date()
    // Adjust to configured timezone so cron expressions match the user's local time.
    const tzOffsetMs = config.timezone * 60 * 60 * 1000
    const now = new Date(nowUtc.getTime() + tzOffsetMs)
    const currentMinute = now.getUTCHours() * 60 + now.getUTCMinutes()

    logger.debug(
      `Cron tick — utc=${nowUtc.toISOString()} local=${now.toISOString()} ` +
        `localH=${now.getUTCHours()} localM=${now.getUTCMinutes()} ` +
        `timezone=+${config.timezone} currentMinute=${currentMinute} lastTickMinute=${this.lastTickMinute}`
    )

    if (currentMinute === this.lastTickMinute) {
      logger.debug('Cron tick skipped (same minute as last tick)')
      return
    }
    this.lastTickMinute = currentMinute

    const nowUtcStr = nowUtc.toISOString()
    const tasks = clawDb.findAllEnabledCrons()
    logger.debug(`Cron: ${tasks.length} enabled task(s) to evaluate`)

    let fired = 0
    for (const row of tasks) {
      // 判断 next_run_at 是否已到期（而不是匹配 cron 表达式），避免 tick 延迟导致任务漏执行
      const shouldRun = row.next_run_at !== null && row.next_run_at <= nowUtcStr
      logger.debug(
        `Cron task id=${row.id} title="${row.title}" cron="${row.cron}" enable=${row.enable} runOnce=${row.run_once}` +
          ` nextRunAt=${row.next_run_at} nowUtc=${nowUtcStr} shouldRun=${shouldRun}` +
          (row.next_run_at
            ? ` (diff=${((new Date(row.next_run_at).getTime() - nowUtc.getTime()) / 1000).toFixed(1)}s)`
            : '')
      )
      if (shouldRun) {
        fired++
        // 立即更新 next_run_at，防止同一 tick 重复触发
        if (!row.run_once) {
          // 循环任务：计算下次执行时间
          const newNextRun = nextRunDateUtc(row.cron, nowUtc)
          clawDb.updateCron(row.id, { nextRunAt: newNextRun })
        } else {
          // 一次性任务：清空下次执行时间，防止重复触发
          clawDb.updateCron(row.id, { nextRunAt: null })
        }
        this._runTask(rowToTask(row), nowUtc).catch((err) =>
          logger.error(
            { err },
            `Cron task "${row.title}" (id=${row.id}) execution failed`
          )
        )
      }
    }
    logger.debug(`Cron tick done: fired ${fired} / ${tasks.length} task(s)`)
  }

  /** Execute a single cron task: run shell cmd or send prompt to agent, then summarize with Model. */
  private async _runTask(task: CronTask, now: Date): Promise<void> {
    logger.info(
      `Executing cron task: "${task.title}" (id=${task.id}) type=${task.config?.type ?? 'agent(prompt)'}`
    )

    const startAt = now.toISOString()
    const startMs = Date.now()
    const logLines: string[] = []
    const logAppend = (line: string) => {
      logLines.push(line)
    }

    let taskStatus: 'success' | 'error' = 'success'
    let statusRemark: string | undefined
    let agentId: number | undefined
    let logFilePath: string | undefined

    // 标记为运行中
    this.runningCronIds.add(task.id)

    try {
      // Notify listeners that the task has started
      clawEventBus.emit('cron:start', {
        cronId: task.id,
        cronTitle: task.title,
        agentId: task.agentId,
      })

      // ─── 执行任务 ─────────────────────────────────────────────────────────────

      if (task.config?.type === 'shell') {
        // Shell 模式：直接在服务器上执行命令
        const shellCmd = task.config.shell ?? ''
        if (!shellCmd) {
          taskStatus = 'error'
          statusRemark = 'shell command is empty'
          logAppend(`[ERROR] shell command is empty`)
        } else {
          const workdir = task.config.workdir
          const shellEnv = await buildShellEnv()
          const effectiveCwd = workdir ?? process.cwd()
          const { extraPaths, userEnvKeys } = await getShellEnvMeta(task.userId)
          logAppend(`[INFO] Executing shell command: ${shellCmd}`)
          logAppend(`[INFO] Working directory: ${workdir ?? '(default)'}`)
          logAppend(
            `[INFO] Extra PATH: ${extraPaths.length > 0 ? extraPaths.join(':') : '(none)'}`
          )
          const maskedEnvEntries = [...userEnvKeys]
            .filter((k) => k)
            .map((k) => `${k}=**`)
            .join('\n  ')
          logAppend(`[INFO] Env vars:\n  ${maskedEnvEntries || '(none)'}`)
          logger.info(
            `Cron shell exec — id=${task.id} cmd="${shellCmd}" cwd="${effectiveCwd}" PATH="${shellEnv.PATH ?? ''}"`
          )
          // 提前创建日志文件，后续 stdout/stderr 直接流式写入，避免大输出撑爆内存
          logFilePath = generateTempLogPath('cron')
          this.runningShellLogFiles.set(task.id, logFilePath)
          const _header =
            `# Cron Task Log\n` +
            `# Task  : ${task.title} (id=${task.id})\n` +
            `# Time  : ${now.toISOString()}\n\n` +
            logLines.join('\n') +
            '\n\n'
          writeFileSync(logFilePath, _header, 'utf8')
          try {
            await new Promise<void>((resolve, reject) => {
              const outStream = createWriteStream(logFilePath!, { flags: 'a' })
              const child = spawn(shellCmd, [], {
                shell: true,
                cwd: workdir ?? process.cwd(),
                env: shellEnv,
                timeout: 24 * 60 * 60_000,
              })
              child.stdout?.on('data', (chunk: Buffer) =>
                outStream.write(chunk)
              )
              child.stderr?.on('data', (chunk: Buffer) =>
                outStream.write(chunk)
              )
              child.on('close', (code) => {
                const exitNote =
                  code !== 0 && code !== null ? `\n[exit code: ${code}]` : ''
                outStream.end(exitNote, () => {
                  if (code === 0 || code === null) resolve()
                  else reject(new Error(`Process exited with code ${code}`))
                })
              })
              child.on('error', (err) => {
                outStream.end(`\n[spawn error: ${err.message}]`, () =>
                  reject(err)
                )
              })
            })
            logAppend(`[INFO] ${t('claw.cronShellCompleted')}`)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            logAppend(`[ERROR] ${t('claw.cronShellFailed')}: ${msg}`)
            taskStatus = 'error'
            statusRemark = msg
          }
        }
        clawDb.updateCron(task.id, { lastRunAt: now.toISOString() })
      } else {
        // Agent 模式（含旧 prompt 模式）：发送给 Agent 处理
        const prompt =
          task.config?.type === 'agent'
            ? (task.config.agent ?? task.prompt)
            : task.prompt

        const allAgents = agentManager.listActive()
        logger.info(
          `Cron task "${task.title}": allActiveAgents=[${allAgents.map((w) => `id=${w.id} title="${w.title}"`).join(', ')}] ` +
            `looking for agentId=${task.agentId}`
        )
        const targets = allAgents.filter((m) => m.id === task.agentId)
        logger.info(
          `Cron task "${task.title}": matched ${targets.length} target agent(s)`
        )

        if (targets.length === 0) {
          logger.warn(
            `Cron task "${task.title}": no active agent found for agentId=${task.agentId}. ` +
              `Active agent ids=[${allAgents.map((w) => w.id).join(', ')}]`
          )
          const retryNextRun = nextRunDateUtc(task.cron, now)
          clawDb.updateCron(task.id, {
            lastRunAt: now.toISOString(),
            lastStatus: 'error',
            lastStatusRemark: `No active agent for agentId=${task.agentId}`,
            nextRunAt: retryNextRun,
          })
          clawDb.insertCronLog({
            tenantId: task.tenantId,
            userId: task.userId,
            cronId: task.id,
            title: task.title,
            startAt,
            endAt: new Date().toISOString(),
            status: 'error',
            statusRemark: `No active agent for agentId=${task.agentId}`,
            result: `${t('claw.cronExecFailed')}: No active agent for agentId=${task.agentId}`,
          })
          return
        }

        clawDb.updateCron(task.id, { lastRunAt: now.toISOString() })

        for (const agent of targets) {
          agentId = agent.id
          const cronChatId = 0
          logger.info(
            `Cron task "${task.title}": agent "${agent.title}" (id=${agent.id})`
          )
          // 每次 cron 执行新建一个 session，title 直接使用任务名称
          const cronSessionId = createNewSession(
            agent.tenantId,
            agent.userId,
            agent.id,
            0,
            task.title
          )
          const cronAgentContext: AgentContext = {
            logger: getAgentLogger(
              agent.roleName,
              agent.id,
              String(cronSessionId)
            ),
            tenantId: agent.tenantId,
            userId: agent.userId,
            agentId: agent.id,
            sessionId: cronSessionId,
          }
          try {
            const augmentedPrompt =
              `[CRON] Task: ${task.title}\n` +
              (task.description ? `Description: ${task.description}\n` : '') +
              `Triggered at: ${now.toISOString()}\n\n${prompt}`

            // 通过 message:incoming 事件持久化用户消息（由 agentLog.ts 写 DB）
            clawEventBus.emit('message:incoming', {
              agentId: agent.id,
              chatId: cronChatId,
              content: clawMessage.text(augmentedPrompt),
              userId: agent.userId,
              messageId: 0,
              timestamp: new Date(),
              source: 'cron',
              sessionId: cronSessionId,
              channelId: 0,
            })

            logAppend(`[INFO] agent="${agent.title}" cron prompt sent`)
            const reply = await processMessage(
              agent,
              cronChatId,
              clawMessage.text(augmentedPrompt),
              'default',
              undefined,
              undefined,
              task.id,
              cronAgentContext
            )
            logger.info(
              `Cron task "${task.title}": processMessage returned replyLen=${reply.length}`
            )
            logAppend(
              `[INFO] reply received (${reply.length} chars): ${reply.slice(0, 200)}${reply.length > 200 ? '...' : ''}`
            )

            // DB 持久化由 agentLog.ts 通过 message:outgoing 事件驱动
            clawEventBus.emit('message:outgoing', {
              agentId: agent.id,
              chatId: cronChatId,
              content: clawMessage.text(reply),
              userId: agent.userId,
              source: 'cron',
              agentContext: cronAgentContext,
            })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            logAppend(`[ERROR] ${msg}`)
            logger.error(
              `Cron task "${task.title}" failed for agent "${agent.title}": ${msg}`
            )
            taskStatus = 'error'
            statusRemark = msg
            const errorText = `⚠️ Cron task "${task.title}" failed: ${msg}`
            // DB 持久化由 agentLog.ts 通过 message:outgoing 事件驱动
            clawEventBus.emit('message:outgoing', {
              agentId: agent.id,
              chatId: cronChatId,
              content: clawMessage.text(errorText),
              userId: agent.userId,
              isError: true,
              source: 'cron',
              agentContext: cronAgentContext,
            })
          }
        }
      }

      // ─── 生成结果摘要 ─────────────────────────────────────────────────────────

      let result: string
      const logsText = logLines.join('\n')

      // shell 模式已在执行前创建日志文件；agent 模式在此写入
      if (!logFilePath && logLines.length > 0) {
        try {
          logFilePath = writeCronLogFile(task.title, task.id, logLines, now)
          logger.info(
            `Cron task "${task.title}": full log written to ${logFilePath}`
          )
        } catch (err) {
          logger.warn(
            `Cron task "${task.title}": failed to write log file: ${err instanceof Error ? err.message : String(err)}`
          )
        }
      }

      const logFileHint = logFilePath ? `\n\n📄 ${logFilePath}` : ''

      if (task.config?.type === 'shell') {
        // Shell 模式：从日志文件提取内容显示，不调用 Model
        let display = ''
        let isTruncated = false
        if (logFilePath) {
          try {
            const fileResult = await summaryFile(logFilePath)
            // 剔除日志文件头部注释行（# Cron Task Log / # Task : / # Time :），避免与通知首行重复
            display = fileResult.display.replace(/^(#[^\n]*\n)*\n*/, '')
            isTruncated = fileResult.isTruncated
          } catch (err) {
            logger.warn(
              `Cron task "${task.title}": failed to read log file: ${err instanceof Error ? err.message : String(err)}`
            )
          }
        }
        const fileSuffix = isTruncated ? `\n\n📄 Full log: ${logFilePath}` : ''
        if (taskStatus === 'success') {
          result = (display || 'Success') + fileSuffix
        } else {
          result = `Failed: ${statusRemark ?? 'Unknown error'}${display ? `\n${display}` : ''}${fileSuffix}`
        }
        logger.info(
          `Cron task "${task.title}": shell result (no Model summary)`
        )
      } else if (logsText) {
        // Agent 模式：调用 Model 汇总结果
        try {
          const summaryResult = await modelCall({
            tenantId: task.tenantId,
            userId: task.userId,
            biz: 'Claw',
            bizId: String(task.id),
            modelConfigList: await getModelConfigList(
              task.userId,
              task.tenantId,
              'default'
            ),
            systemPrompt:
              'You are an execution summary assistant. Briefly summarize task execution results. If successful, describe key outputs; if failed, state reasons. Max 200 characters.',
            userPrompt: `Task Name: ${task.title}\nExecution Type: ${task.config?.type ?? 'agent'}\nExecution Time: ${startAt}\nStatus: ${taskStatus}\n\nExecution Log:\n${logsText}`,
            temperature: 0.3,
            maxRetry: 1,
          })
          result = summaryResult.type === 'text' ? summaryResult.content : ''
          result += logFileHint
          logger.info(
            `Cron task "${task.title}": Model summary generated (${result.length} chars)`
          )
        } catch (err) {
          logger.warn(
            `Cron task "${task.title}": Model summary failed: ${err instanceof Error ? err.message : String(err)}`
          )
          result =
            (taskStatus === 'success'
              ? 'Success'
              : `Failed: ${statusRemark ?? 'Unknown error'}`) + logFileHint
        }
      } else {
        result =
          (taskStatus === 'success'
            ? 'Success'
            : `Failed: ${statusRemark ?? 'Unknown error'}`) + logFileHint
      }

      // ─── 写入日志与状态 ───────────────────────────────────────────────────────

      clawDb.updateCron(task.id, {
        lastStatus: taskStatus,
        lastStatusRemark: statusRemark,
        lastResult: result,
      })
      clawDb.insertCronLog({
        tenantId: task.tenantId,
        userId: task.userId,
        agentId,
        cronId: task.id,
        title: task.title,
        startAt,
        endAt: new Date().toISOString(),
        status: taskStatus,
        statusRemark,
        logs: logsText || undefined,
        result,
      })
      logger.info(
        `Cron task "${task.title}" (id=${task.id}) finished: status=${taskStatus}`
      )

      // Notify listeners that the task has finished
      clawEventBus.emit('cron:end', {
        cronId: task.id,
        cronTitle: task.title,
        agentId: task.agentId,
        status: taskStatus,
        result,
        durationMs: Date.now() - startMs,
        successNotify: task.successNotify,
        shell:
          task.config?.type === 'shell'
            ? (task.config.shell ?? undefined)
            : undefined,
        workdir:
          task.config?.type === 'shell'
            ? (task.config.workdir ?? undefined)
            : undefined,
      })

      // 一次性任务：运行完成后标记为不再运行，并清空下次执行时间
      if (task.runOnce) {
        clawDb.updateCron(task.id, {
          shouldRun: false,
          enable: false,
          nextRunAt: null,
        })
        logger.info(
          `Cron task "${task.title}" (id=${task.id}) is run_once — marked shouldRun=false, auto-disabled, nextRunAt cleared`
        )
      }
    } finally {
      this.runningCronIds.delete(task.id)
      this.runningShellLogFiles.delete(task.id)
    }
  }
}

/** Singleton cron manager — initialized by initBotSystem() */
export const cronManager = new CronManager()
