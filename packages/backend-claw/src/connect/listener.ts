/**
 * Runtime event listener.
 *
 * Subscribes to `runtime:connected` and `runtime:disconnected` events on
 * the clawEventBus and forwards them as outgoing messages from the Supervisor
 * agent so that operators receive real-time notifications about runtime lifecycle:
 *
 *   runtime:connected    → 🔌 Runtime online: "<title>" (id=<id>)
 *   runtime:disconnected → 🔌 Runtime offline: "<title>" (id=<id>)
 *
 * This module must be initialised once during system boot via initRuntimeListener().
 */

import { agentManager } from '../agent/index.js'
import type { RuntimeLifecycleEvent } from '../kernel/eventBus.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import type { AgentContext } from '../types/index.js'
import { clawMessage } from '../types/index.js'
import { getAgentLogger } from '../utils/logger.js'

const logger = createLogger('runtime:listener')

/** chatId used for internal runtime-triggered messages (no real channel conversation) */
const RUNTIME_CHAT_ID = 0

function getSupervisor() {
  return agentManager.listAll().find((w) => w.roleName === 'supervisor')
}

function sendMessage(text: string, isError = false): void {
  const supervisor = getSupervisor()
  if (!supervisor) {
    logger.warn('no supervisor agent found, skipping runtime notification')
    return
  }
  // DB 持久化由 agentLog.ts 通过 message:outgoing 事件驱动
  clawEventBus.emit('message:outgoing', {
    agentId: supervisor.id,
    chatId: RUNTIME_CHAT_ID,
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

function onRuntimeConnected(evt: RuntimeLifecycleEvent): void {
  const text = `🔌 Runtime online: "${evt.runtimeTitle}" (id=${evt.runtimeId})`
  logger.info({ runtimeId: evt.runtimeId }, 'runtime:connected notification')
  sendMessage(text)
}

function onRuntimeDisconnected(evt: RuntimeLifecycleEvent): void {
  const text = `🔌 Runtime offline: "${evt.runtimeTitle}" (id=${evt.runtimeId})`
  logger.info({ runtimeId: evt.runtimeId }, 'runtime:disconnected notification')
  sendMessage(text, true)
}

/**
 * Register runtime lifecycle event listeners.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
let _initialized = false
export function initRuntimeListener(): void {
  if (_initialized) return
  _initialized = true

  clawEventBus.on('runtime:connected', onRuntimeConnected)
  clawEventBus.on('runtime:disconnected', onRuntimeDisconnected)

  logger.info(
    'Runtime listener registered (runtime:connected, runtime:disconnected)'
  )
}
