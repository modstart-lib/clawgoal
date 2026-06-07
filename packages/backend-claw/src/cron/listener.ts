/**
 * Cron event listener.
 *
 * Subscribes to `cron:start` and `cron:end` events on the clawEventBus and
 * forwards them as outgoing messages from the Supervisor agent so that
 * operators receive real-time notifications about cron task lifecycle:
 *
 *   cron:start  → deferred ⏰ Cron task started (sent only if task takes > 10 s)
 *   cron:end    → ✅ / ❌ Cron task finished/failed with result summary
 *
 * Fast-task optimisation:
 *   If a task completes successfully within 10 seconds the start message is
 *   suppressed and a single compact success message is sent instead of two
 *   separate notifications.
 *
 * This module must be initialised once during system boot via initCronListener().
 */

import { agentManager } from '../agent/index.js'
import type { CronEndEvent, CronStartEvent } from '../kernel/eventBus.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import type { AgentContext } from '../types/index.js'
import { clawMessage } from '../types/index.js'
import { getAgentLogger } from '../utils/logger.js'
import { config } from '../../../backend/src/config/index.js'

const logger = createLogger('cron:listener')

/** chatId used for internal cron-triggered messages (no real channel conversation) */
const CRON_CHAT_ID = 0

/** Threshold: tasks completing within this duration are merged into a single message */
const FAST_TASK_THRESHOLD_MS = 10_000

/** Delay before sending the "task started" notification (must be > FAST_TASK_THRESHOLD_MS) */
const START_NOTIFICATION_DELAY_MS = 12_000

interface PendingStart {
  evt: CronStartEvent
  timer: ReturnType<typeof setTimeout>
}

/** Tracks start events whose notification has not yet been sent */
const pendingStarts = new Map<number, PendingStart>()

function getSupervisor() {
  return agentManager.listAll().find((w) => w.roleName === 'supervisor')
}

function sendMessage(text: string, isError = false): void {
  const supervisor = getSupervisor()
  if (!supervisor) {
    logger.warn('no supervisor agent found, skipping cron notification')
    return
  }
  // DB 持久化由 agentLog.ts 通过 message:outgoing 事件驱动
  clawEventBus.emit('message:outgoing', {
    agentId: supervisor.id,
    chatId: CRON_CHAT_ID,
    content: clawMessage.text(text),
    userId: supervisor.userId,
    source: 'cron',
    ...(isError ? { isError: true } : {}),
    agentContext: {
      logger: getAgentLogger(supervisor.roleName, supervisor.id, '0'),
      tenantId: supervisor.tenantId,
      userId: supervisor.userId,
      agentId: Number(supervisor.id),
      sessionId: 0,
    } satisfies AgentContext,
  })
}

function onCronStart(evt: CronStartEvent): void {
  // Schedule the start notification — it will be cancelled if the task
  // finishes quickly (within FAST_TASK_THRESHOLD_MS).
  const timer = setTimeout(() => {
    pendingStarts.delete(evt.cronId)
    const isZh = config.lang !== 'en-US'
    const text = isZh
      ? `⏰ 定时任务启动：「${evt.cronTitle}」(id=${evt.cronId})`
      : `⏰ Cron task started: "${evt.cronTitle}" (id=${evt.cronId})`
    logger.debug({ cronId: evt.cronId }, 'cron:start notification (delayed)')
    sendMessage(text)
  }, START_NOTIFICATION_DELAY_MS)

  pendingStarts.set(evt.cronId, { evt, timer })
  logger.debug(
    { cronId: evt.cronId },
    'cron:start queued (waiting for fast-finish check)'
  )
}

function onCronEnd(evt: CronEndEvent): void {
  const pending = pendingStarts.get(evt.cronId)
  const duration = (evt.durationMs / 1000).toFixed(1)

  if (pending) {
    // Task finished before the deferred start notification fired → cancel it.
    clearTimeout(pending.timer)
    pendingStarts.delete(evt.cronId)

    if (evt.status === 'success' && evt.durationMs <= FAST_TASK_THRESHOLD_MS) {
      // Fast success → single compact message, only if successNotify is enabled.
      if (!evt.successNotify) {
        logger.debug(
          { cronId: evt.cronId },
          'cron:end fast-success suppressed (successNotify=false)'
        )
        return
      }
      const isZh = config.lang !== 'en-US'
      const text = isZh
        ? `✅ 定时任务完成：「${evt.cronTitle}」(id=${evt.cronId}, ${duration}s)\n\n${evt.result}`
        : `✅ Cron task done: "${evt.cronTitle}" (id=${evt.cronId}, ${duration}s)\n\n${evt.result}`
      logger.debug(
        { cronId: evt.cronId },
        'cron:end fast-success notification (merged)'
      )
      sendMessage(text)
      return
    }

    // Slow task or error → send the start notification retroactively, then the end notification.
    const isZhRetro = config.lang !== 'en-US'
    const startText = isZhRetro
      ? `⏰ 定时任务启动：「${evt.cronTitle}」(id=${evt.cronId})`
      : `⏰ Cron task started: "${evt.cronTitle}" (id=${evt.cronId})`
    logger.debug(
      { cronId: evt.cronId },
      'cron:start notification (retroactive)'
    )
    sendMessage(startText)
  }

  // For success events, only send notification if successNotify is enabled.
  if (evt.status === 'success' && !evt.successNotify) {
    logger.debug(
      { cronId: evt.cronId },
      'cron:end success notification suppressed (successNotify=false)'
    )
    return
  }

  // Normal end notification.
  const isZhEnd = config.lang !== 'en-US'
  const icon = evt.status === 'success' ? '✅' : '❌'
  const label =
    evt.status === 'success'
      ? isZhEnd
        ? '完成'
        : 'done'
      : isZhEnd
        ? '失败'
        : 'failed'
  let metaLines = ''
  if (evt.status === 'error') {
    if (evt.shell !== undefined)
      metaLines += isZhEnd
        ? `\n🔧 命令：${evt.shell}`
        : `\n🔧 Command: ${evt.shell}`
    if (evt.workdir !== undefined)
      metaLines += isZhEnd
        ? `\n📁 工作目录：${evt.workdir}`
        : `\n📁 Working dir: ${evt.workdir}`
  }
  const cronLabel = isZhEnd ? '定时任务' : 'Cron task'
  const text = isZhEnd
    ? `${icon} ${cronLabel}${label}：「${evt.cronTitle}」(id=${evt.cronId}, ${duration}s)${metaLines}\n\n${evt.result}`
    : `${icon} ${cronLabel} ${label}: "${evt.cronTitle}" (id=${evt.cronId}, ${duration}s)${metaLines}\n\n${evt.result}`

  logger.debug(
    { cronId: evt.cronId, status: evt.status },
    'cron:end notification'
  )
  sendMessage(text, evt.status === 'error')
}

/**
 * Register cron lifecycle event listeners.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
let _initialized = false
export function initCronListener(): void {
  if (_initialized) return
  _initialized = true

  clawEventBus.on('cron:start', onCronStart)
  clawEventBus.on('cron:end', onCronEnd)

  logger.info('Cron listener registered (cron:start, cron:end)')
}
